<?php
/**
 * The conversation on a proposal: notes from the team and updates from the ambassador,
 * each with a time, plus status and head-count changes, read as one timeline.
 */
if (!defined('ABSPATH')) {
    exit;
}

/** The proposal if this user may see its timeline: the team, or the ambassador who sent it. */
function lm_proposal_for($id, $user)
{
    $p = lm_row('proposals_c', (int) $id);
    if (!$p || !$user || !$user->ID) {
        return null;
    }
    if (lm_is_admin($user) || (int) $p['Owner'] === (int) $user->ID) {
        return $p;
    }
    return null;
}

/** A stored UTC datetime as ISO 8601, the way the rest of the API sends times. */
function lm_iso_utc($v)
{
    return $v ? str_replace(' ', 'T', (string) $v) . 'Z' : null;
}

function lm_user_display($uid)
{
    $u = get_user_by('id', (int) $uid);
    if (!$u) {
        return 'Someone';
    }
    return trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name;
}

/** Timeline entries, oldest first. Older proposals get their first team note from adminNote_c. */
function lm_proposal_thread($p)
{
    global $wpdb;
    $rows = $wpdb->get_results($wpdb->prepare(
        'SELECT * FROM ' . lm_table('proposalNotes_c') . ' WHERE proposal_c = %d ORDER BY CreatedOn ASC, Id ASC',
        (int) $p['Id']
    ), ARRAY_A);
    $out = [];
    foreach ($rows as $r) {
        $out[] = [
            'id' => (string) $r['Id'],
            'author' => lm_user_display($r['Owner']),
            'authorId' => (string) $r['Owner'],
            'role' => $r['authorRole_c'] ?: 'Team',
            'body' => (string) $r['body_c'],
            'status' => $r['newStatus_c'] ?: null,
            'homesFrom' => $r['homesFrom_c'] === null ? null : (int) $r['homesFrom_c'],
            'homesTo' => $r['homesTo_c'] === null ? null : (int) $r['homesTo_c'],
            'at' => lm_iso_utc($r['CreatedOn']),
        ];
    }
    $has_team = (bool) array_filter($out, function ($e) {
        return $e['role'] === 'Team';
    });
    if (!$has_team && trim((string) $p['adminNote_c']) !== '') {
        array_unshift($out, [
            'id' => 'legacy',
            'author' => 'Lotmates team',
            'authorId' => null,
            'role' => 'Team',
            'body' => (string) $p['adminNote_c'],
            'status' => null,
            'homesFrom' => null,
            'homesTo' => null,
            'at' => lm_iso_utc($p['repliedOn_c'] ?: $p['ModifiedOn']),
        ]);
        usort($out, function ($a, $b) {
            return strcmp((string) $a['at'], (string) $b['at']);
        });
    }
    return $out;
}

/**
 * Add to a proposal's timeline. The team may also change the status; the ambassador may
 * update the head count. One email goes to the other side.
 */
function lm_proposal_reply($user, $p, $body, $status, $homes)
{
    global $wpdb;
    $team = lm_is_admin($user);
    $body = trim((string) $body);
    if (mb_strlen($body) > 2000) {
        return lm_err('That note is too long. Keep it under 2,000 characters.');
    }
    $now = gmdate('Y-m-d H:i:s');
    $update = [];

    $new_status = null;
    if ($team && $status !== null && $status !== '' && $status !== $p['status_c']) {
        if (!in_array($status, ['New', 'Reviewing', 'Accepted', 'Declined'], true)) {
            return lm_err('Pick a status.');
        }
        $new_status = $status;
        $update['status_c'] = $status;
    }

    $from = null;
    $to = null;
    if (!$team && $homes !== null && $homes !== '') {
        $h = (int) $homes;
        if ($h < 1 || $h > 100000) {
            return lm_err('Enter how many homes are interested now, at least 1.');
        }
        if ($h !== (int) $p['homesInterested_c']) {
            $from = $p['homesInterested_c'] === null ? null : (int) $p['homesInterested_c'];
            $to = $h;
            $update['homesInterested_c'] = $h;
        }
    }

    if ($body === '' && !$new_status && $to === null) {
        return lm_err($team ? 'Write a note or change the status.' : 'Write an update or change the number of homes.');
    }

    if ($team) {
        $update['repliedOn_c'] = $now;
        if ($body !== '') {
            $update['adminNote_c'] = $body; // The latest team note, for lists and older screens.
        }
    }
    if ($update) {
        $update['ModifiedOn'] = $now;
        $wpdb->update(lm_table('proposals_c'), $update, ['Id' => (int) $p['Id']]);
    }
    $wpdb->insert(lm_table('proposalNotes_c'), [
        'Name' => mb_substr($body !== '' ? $body : ($new_status ? 'Status: ' . $new_status : 'Homes updated'), 0, 120),
        'proposal_c' => (int) $p['Id'],
        'body_c' => $body !== '' ? $body : null,
        'authorRole_c' => $team ? 'Team' : 'Ambassador',
        'newStatus_c' => $new_status,
        'homesFrom_c' => $from,
        'homesTo_c' => $to,
        'Owner' => (int) $user->ID,
        'CreatedOn' => $now,
        'ModifiedOn' => $now,
    ]);

    $after = lm_row('proposals_c', (int) $p['Id']);
    lm_email_proposal_reply($user, $team, $after, $body, $new_status, $from, $to);
    return lm_ok(['proposal' => (string) $p['Id'], 'thread' => lm_proposal_thread($after)]);
}

function lm_email_proposal_reply($user, $team, $p, $body, $new_status, $from, $to)
{
    $ctx = lm_proposal_email_ctx($p);
    if ($team) {
        $owner = get_user_by('id', (int) $p['Owner']);
        if (!$owner || (int) $owner->ID === (int) $user->ID) {
            return;
        }
        $lines = [
            'New' => 'Your proposal is back in the queue. The team will pick it up again soon.',
            'Reviewing' => 'The team is looking into your proposal and talking to vendors about it.',
            'Accepted' => 'Good news: the team is going ahead with your proposal and will set up the deal. We\'ll let you know when it opens.',
            'Declined' => 'The team isn\'t taking this proposal forward this time.',
        ];
        $status = (string) $p['status_c'];
        lm_send_template('a_proposal_update', $owner->user_email, lm_email_ctx_user($owner) + $ctx + [
            'status' => ['New' => 'back in the queue', 'Reviewing' => 'under review', 'Accepted' => 'accepted', 'Declined' => 'declined'][$status] ?? strtolower($status),
            'status_line' => $new_status ? ($lines[$new_status] ?? 'The team updated your proposal.') : 'The team added a note to your proposal.',
            'team_note' => $body !== '' ? "Note from the team:\n" . $body : '',
        ], ['ref' => (int) $p['Id'], 'user' => $owner->ID]);
        return;
    }
    $change = $to !== null ? 'Homes interested: ' . ($from === null ? 'not given' : $from) . ' → ' . $to : '';
    foreach (lm_team_recipients() as $addr) {
        lm_send_template('t_proposal_reply', $addr, $ctx + [
            'proposer_name' => lm_user_display($user->ID),
            'update' => $body,
            'homes_change' => $change,
            'contact' => ucfirst(preg_replace('/^by /', '', $ctx['contact'])),
        ], ['ref' => (int) $p['Id']]);
    }
}

function lm_register_proposal_routes()
{
    $ns = 'lotmates/v1';
    register_rest_route($ns, '/proposal-thread/(?P<id>\d+)', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $p = lm_proposal_for((int) $r['id'], wp_get_current_user());
            return $p ? lm_ok(lm_proposal_thread($p)) : lm_err('Proposal not found.', 404);
        },
    ]);
    register_rest_route($ns, '/fn/proposal-reply', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $user = wp_get_current_user();
            $q = $r->get_json_params() ?: [];
            $p = lm_proposal_for((int) ($q['proposalId'] ?? 0), $user);
            if (!$p) {
                return lm_err('Proposal not found.', 404);
            }
            return lm_proposal_reply($user, $p, $q['body'] ?? '', $q['status'] ?? null, $q['homes'] ?? null);
        },
    ]);
}
