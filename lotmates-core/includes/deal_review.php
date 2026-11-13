<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * How a deal gets from an idea to a live deal, with both sides signing off.
 *
 *  Draft              being written (by the team, or by the vendor)
 *  Awaiting vendor    the team wrote it; the vendor must confirm it
 *  Awaiting team      the vendor wrote it; the team must approve it
 *  Changes requested  the reviewer sent it back with a note
 *  Approved           both sides agree; the team opens it for bookings
 *  Live / Closed / Failed   as before
 *
 * The team can also publish without vendor review. Every step is written to lm_dealEvents_c,
 * and a vendor's confirmation keeps a copy of the exact terms they agreed to.
 * Vendors never write to deals_c directly: they use these routes, which only accept deal terms.
 */

const LM_DEAL_TERM_FIELDS = [
    'Name', 'category_c', 'description_c', 'unit_c', 'regularPrice_c',
    'tier1Max_c', 'tier1Price_c', 'tier2Max_c', 'tier2Price_c', 'tier3Max_c', 'tier3Price_c', 'tier4Max_c', 'tier4Price_c',
    'minHomes_c', 'capacity_c', 'deadline_c', 'serviceStart_c', 'serviceEnd_c', 'allowRepeat_c', 'gallery_c', 'video_c',
    'fulfilment_c', 'pickupAddress_c', 'schedule_c', 'timeSlots_c', 'slotCapacity_c', 'locality_c', 'community_c', 'city_c',
];
// What the vendor agrees to (a change to any of these after they agreed asks them to agree again).
const LM_DEAL_AGREED_FIELDS = [
    'Name', 'category_c', 'unit_c', 'regularPrice_c',
    'tier1Max_c', 'tier1Price_c', 'tier2Max_c', 'tier2Price_c', 'tier3Max_c', 'tier3Price_c', 'tier4Max_c', 'tier4Price_c',
    'minHomes_c', 'capacity_c', 'commission_c', 'deadline_c', 'serviceStart_c', 'serviceEnd_c',
    'fulfilment_c', 'pickupAddress_c', 'schedule_c', 'locality_c', 'community_c', 'city_c',
];

function lm_deal_terms($deal)
{
    $t = [];
    foreach (LM_DEAL_AGREED_FIELDS as $f) {
        $t[$f] = $deal[$f] ?? null;
    }
    return $t;
}

function lm_deal_event($deal_id, $kind, $user, $note = '', $terms = null)
{
    global $wpdb;
    $now = gmdate('Y-m-d H:i:s');
    $wpdb->insert(lm_table('dealEvents_c'), [
        'Name' => $kind,
        'Owner' => $user && $user->ID ? (int) $user->ID : null,
        'CreatedOn' => $now,
        'ModifiedOn' => $now,
        'deal_c' => (int) $deal_id,
        'kind_c' => $kind,
        'note_c' => $note !== '' ? mb_substr($note, 0, 1500) : null,
        'role_c' => $user && $user->ID ? (lm_is_admin($user) ? 'Admin' : 'Vendor') : 'System',
        'terms_c' => $terms ? wp_json_encode($terms) : null,
        'ip_c' => isset($_SERVER['REMOTE_ADDR']) ? mb_substr(sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])), 0, 45) : null,
    ]);
}

/** What is still missing before a deal can go for review or be opened. */
function lm_deal_problems($d, $need_deadline = true, $live = false)
{
    $p = [];
    if (trim((string) ($d['Name'] ?? '')) === '') {
        $p[] = 'Give the deal a title.';
    }
    $tiers = [];
    for ($n = 1; $n <= 4; $n++) {
        $mx = $d["tier{$n}Max_c"] ?? null;
        $pr = $d["tier{$n}Price_c"] ?? null;
        if ($mx === null && $pr === null) {
            continue;
        }
        if ($mx === null || $pr === null) {
            $p[] = "Tier $n needs both a size and a price.";
        }
        $tiers[$n] = [(float) $mx, (float) $pr];
    }
    if (!isset($tiers[1])) {
        $p[] = 'Tier 1 needs a size and a price.';
    }
    $prev = null;
    $i = 1;
    foreach ($tiers as $n => $t) {
        if ($n !== $i) {
            $p[] = 'Fill tiers in order without gaps.';
        }
        if ($prev && ($t[0] <= $prev[0] || $t[1] >= $prev[1])) {
            $p[] = "Tier $n must be bigger and cheaper than the one before.";
        }
        $prev = $t;
        $i++;
    }
    $min = (int) ($d['minHomes_c'] ?? 0);
    $cap = $d['capacity_c'] ?? null;
    if ($min < 1) {
        $p[] = 'Set a minimum of at least 1.';
    }
    if ($cap !== null && (int) $cap < $min) {
        $p[] = 'Capacity cannot be below the minimum.';
    }
    if (!empty($d['community_c'])) {
        if (empty($d['locality_c'])) {
            $p[] = 'Pick the locality of the community.';
        }
    } elseif (empty($d['locality_c']) && empty($d['city_c'])) {
        $p[] = 'Say where the deal is open: a community, a locality or a city.';
    }
    $f = $d['fulfilment_c'] ?? '';
    if (in_array($f, ['pickup', 'both'], true) && trim((string) ($d['pickupAddress_c'] ?? '')) === '') {
        $p[] = 'Add the pickup address.';
    }
    if ($need_deadline) {
        if (empty($d['deadline_c'])) {
            $p[] = 'Set when bookings close.';
        } elseif (strtotime($d['deadline_c'] . ' UTC') <= time()) {
            $p[] = 'The closing time has already passed.';
        }
    }
    if (!empty($d['serviceStart_c']) && !empty($d['serviceEnd_c']) && $d['serviceEnd_c'] < $d['serviceStart_c']) {
        $p[] = 'Service must end after it starts.';
    }
    if ($live && lm_category_pending($d['category_c'] ?? '')) {
        $p[] = 'Approve the new category "' . lm_category_label($d['category_c']) . '" first (Admin > Categories), or move the deal to an existing one.';
    }
    return $p;
}

function lm_deal_set($deal_id, $user, $to, $kind, $note, $extra = [], $terms = null)
{
    global $wpdb;
    $before = lm_row('deals_c', $deal_id);
    $row = array_merge(['status_c' => $to, 'ModifiedOn' => gmdate('Y-m-d H:i:s')], $extra);
    $wpdb->update(lm_table('deals_c'), $row, ['Id' => $deal_id]);
    lm_deal_event($deal_id, $kind, $user, $note, $terms);
    do_action('lm_record_changed', 'deals_c', $deal_id, $before, lm_row('deals_c', $deal_id));
    return lm_row('deals_c', $deal_id);
}

function lm_my_vendor($user)
{
    global $wpdb;
    return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . lm_table('vendors_c') . " WHERE user_c = %d AND status_c IN ('Active','Probation') ORDER BY Id LIMIT 1", $user->ID), ARRAY_A);
}

/** The vendor's own create and edit: only deal terms are taken; the rest is set here. */
function lm_route_vendor_deal(WP_REST_Request $r)
{
    global $wpdb;
    $user = wp_get_current_user();
    if (!$user->ID || lm_profile_of($user) !== 'Vendor_c') {
        return lm_err('Sign in with a vendor account.', 403);
    }
    $vendor = lm_my_vendor($user);
    if (!$vendor) {
        return lm_err('Your account is not linked to an active vendor yet. Ask the Lotmates team.', 403);
    }
    $p = $r->get_json_params() ?: [];
    $fields = lm_fields('deals_c');
    $row = [];
    foreach (LM_DEAL_TERM_FIELDS as $k) {
        if (array_key_exists($k, $p)) {
            $row[$k] = lm_db_value($fields[$k] ?? 'text', $p[$k]);
        }
    }
    if (isset($row['Name'])) {
        $row['Name'] = mb_substr($row['Name'], 0, 120);
    }
    if (!empty($row['community_c'])) {
        $c = lm_row('communities_c', (int) $row['community_c']);
        if (!$c) {
            return lm_err('Pick a community from the list.');
        }
        $row['locality_c'] = (int) $c['locality_c'];
        $row['city_c'] = null;
    } elseif (!empty($row['locality_c'])) {
        $row['city_c'] = null;
    }
    $row['ModifiedOn'] = gmdate('Y-m-d H:i:s');
    $id = (int) ($p['id'] ?? 0);
    if ($id) {
        $deal = lm_row('deals_c', $id);
        if (!$deal || (int) $deal['vendor_c'] !== (int) $vendor['Id'] || $deal['origin_c'] !== 'vendor') {
            return lm_err('You can only edit deals you started.', 403);
        }
        if (!in_array($deal['status_c'], ['Draft', 'Changes requested'], true)) {
            return lm_err('This deal is with the team now. Withdraw it first to change it.', 409);
        }
        $wpdb->update(lm_table('deals_c'), $row, ['Id' => $id]);
        return lm_ok(['Id' => $id]);
    }
    if (trim((string) ($row['Name'] ?? '')) === '') {
        return lm_err('Give the deal a title first.');
    }
    $row += [
        'Owner' => (int) $user->ID,
        'CreatedOn' => gmdate('Y-m-d H:i:s'),
        'vendor_c' => (int) $vendor['Id'],
        'origin_c' => 'vendor',
        'status_c' => 'Draft',
        'commission_c' => (float) get_option('lm_default_commission', 15),
        'round_c' => 1,
        'bookedHomes_c' => 0,
        'unlockedTier_c' => 1,
    ];
    if (empty($row['category_c'])) {
        $row['category_c'] = $vendor['category_c'] ?: 'Cleaning';
    }
    $wpdb->insert(lm_table('deals_c'), $row);
    $id = (int) $wpdb->insert_id;
    lm_deal_event($id, 'created', $user, '');
    return lm_ok(['Id' => $id]);
}

/** Every move between states, for the team and for the vendor, checked here. */
function lm_route_deal_action(WP_REST_Request $r)
{
    $user = wp_get_current_user();
    if (!$user->ID) {
        return lm_err('Sign in first.', 401);
    }
    $p = $r->get_json_params() ?: [];
    $deal = lm_row('deals_c', (int) ($p['dealId'] ?? 0));
    if (!$deal) {
        return lm_err('Deal not found.', 404);
    }
    $action = sanitize_key((string) ($p['action'] ?? ''));
    $note = trim(sanitize_textarea_field((string) ($p['note'] ?? '')));
    $id = (int) $deal['Id'];
    $s = $deal['status_c'];
    $now = gmdate('Y-m-d H:i:s');

    if (!lm_is_admin($user)) {
        if (lm_profile_of($user) !== 'Vendor_c' || !in_array((int) $deal['vendor_c'], lm_my_vendor_ids((int) $user->ID), true)) {
            return lm_err('This is not your deal.', 403);
        }
        switch ($action) {
            case 'accept':
                if ($s !== 'Awaiting vendor') {
                    return lm_err('This deal is not waiting for your confirmation.', 409);
                }
                if (empty($p['confirm'])) {
                    return lm_err('Tick the box to confirm you have read the terms.');
                }
                if ($problems = lm_deal_problems($deal)) {
                    return lm_err('The deal is not complete yet: ' . $problems[0]);
                }
                $terms = lm_deal_terms($deal);
                $terms['hash'] = hash('sha256', wp_json_encode($terms));
                $d = lm_deal_set($id, $user, 'Approved', 'accepted', $note, [
                    'agreedBy_c' => (int) $user->ID, 'agreedOn_c' => $now, 'agreedTerms_c' => wp_json_encode($terms), 'reviewNote_c' => null,
                ], $terms);
                return lm_ok(['status' => $d['status_c']]);
            case 'request_changes':
                if ($s !== 'Awaiting vendor') {
                    return lm_err('This deal is not waiting for your review.', 409);
                }
                if ($note === '') {
                    return lm_err('Say what should change.');
                }
                lm_deal_set($id, $user, 'Changes requested', 'changes_requested', $note, ['reviewNote_c' => $note]);
                return lm_ok(['status' => 'Changes requested']);
            case 'submit':
                if (!in_array($s, ['Draft', 'Changes requested'], true) || $deal['origin_c'] !== 'vendor') {
                    return lm_err('This deal cannot be sent for review now.', 409);
                }
                if ($problems = lm_deal_problems($deal)) {
                    return lm_err($problems[0]);
                }
                lm_deal_set($id, $user, 'Awaiting team', 'submitted', $note, ['reviewNote_c' => null, 'approvedBy_c' => null, 'approvedOn_c' => null]);
                return lm_ok(['status' => 'Awaiting team']);
            case 'withdraw':
                if ($s !== 'Awaiting team' || $deal['origin_c'] !== 'vendor') {
                    return lm_err('Only a deal you sent and the team has not decided on can be withdrawn.', 409);
                }
                lm_deal_set($id, $user, 'Draft', 'withdrawn', $note);
                return lm_ok(['status' => 'Draft']);
        }
        return lm_err('That is not something a vendor can do.', 403);
    }

    // The team.
    $reviewable = ['Draft', 'Changes requested', 'Awaiting vendor', 'Awaiting team', 'Approved'];
    switch ($action) {
        case 'send_to_vendor':
            if (!in_array($s, ['Draft', 'Changes requested', 'Awaiting team'], true)) {
                return lm_err('This deal cannot be sent to the vendor from here.', 409);
            }
            if (empty($deal['vendor_c'])) {
                return lm_err('Pick the vendor first.');
            }
            if ($problems = lm_deal_problems($deal)) {
                return lm_err($problems[0]);
            }
            lm_deal_set($id, $user, 'Awaiting vendor', 'sent_to_vendor', $note, ['reviewNote_c' => null, 'agreedBy_c' => null, 'agreedOn_c' => null, 'agreedTerms_c' => null, 'approvedBy_c' => null, 'approvedOn_c' => null]);
            return lm_ok(['status' => 'Awaiting vendor']);
        case 'recall':
            if ($s !== 'Awaiting vendor') {
                return lm_err('This deal is not with the vendor.', 409);
            }
            lm_deal_set($id, $user, 'Draft', 'recalled', $note);
            return lm_ok(['status' => 'Draft']);
        case 'request_changes':
            if ($s !== 'Awaiting team') {
                return lm_err('This deal is not waiting for the team.', 409);
            }
            if ($note === '') {
                return lm_err('Say what the vendor should change.');
            }
            lm_deal_set($id, $user, 'Changes requested', 'changes_requested', $note, ['reviewNote_c' => $note]);
            return lm_ok(['status' => 'Changes requested']);
        case 'approve':
        case 'approve_publish':
            if ($s !== 'Awaiting team') {
                return lm_err('This deal is not waiting for the team.', 409);
            }
            if ($problems = lm_deal_problems($deal, $action === 'approve_publish', $action === 'approve_publish')) {
                return lm_err($problems[0]);
            }
            $to = $action === 'approve_publish' ? 'Live' : 'Approved';
            lm_deal_set($id, $user, $to, 'approved', $note, ['approvedBy_c' => (int) $user->ID, 'approvedOn_c' => $now, 'reviewNote_c' => null]);
            return lm_ok(['status' => $to]);
        case 'go_live':
            if ($s !== 'Approved') {
                return lm_err('Only an approved deal can be opened for bookings.', 409);
            }
            if ($problems = lm_deal_problems($deal, true, true)) {
                return lm_err($problems[0]);
            }
            lm_deal_set($id, $user, 'Live', 'published', $note);
            return lm_ok(['status' => 'Live']);
        case 'publish_direct':
            if (!in_array($s, $reviewable, true)) {
                return lm_err('This deal cannot be published from here.', 409);
            }
            if (empty($deal['vendor_c'])) {
                return lm_err('Pick the vendor first.');
            }
            if ($problems = lm_deal_problems($deal, true, true)) {
                return lm_err($problems[0]);
            }
            $extra = ['skipReview_c' => 1];
            if ($s === 'Awaiting team') {
                $extra = ['approvedBy_c' => (int) $user->ID, 'approvedOn_c' => $now, 'skipReview_c' => 0];
            } elseif ($s === 'Approved') {
                $extra = ['skipReview_c' => 0];
            }
            lm_deal_set($id, $user, 'Live', $extra['skipReview_c'] ? 'published_direct' : 'published', $note, $extra);
            return lm_ok(['status' => 'Live']);
    }
    return lm_err('Unknown action.');
}

function lm_register_deal_review_routes()
{
    $ns = 'lotmates/v1';
    register_rest_route($ns, '/vendor/deal', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'lm_route_vendor_deal']);
    register_rest_route($ns, '/deal/action', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'lm_route_deal_action']);
}

// A deal the team opens without either side's sign-off is marked and logged, whichever screen did it.
// A vendor-confirmed deal whose terms the team then changes goes back for the vendor to confirm again.
add_action('lm_record_changed', function ($table, $id, $before, $after) {
    global $wpdb;
    if ($table !== 'deals_c' || !$after) {
        return;
    }
    if ($before && $after['status_c'] === 'Live' && $before['status_c'] !== 'Live' && empty($after['agreedOn_c']) && empty($after['approvedOn_c']) && empty($after['skipReview_c'])) {
        $wpdb->update(lm_table('deals_c'), ['skipReview_c' => 1], ['Id' => $id]);
        lm_deal_event($id, 'published_direct', wp_get_current_user(), '');
    }
    if ($before && $before['status_c'] === 'Approved' && $after['status_c'] === 'Approved' && !empty($after['agreedOn_c'])) {
        foreach (LM_DEAL_AGREED_FIELDS as $f) {
            if ((string) ($before[$f] ?? '') !== (string) ($after[$f] ?? '')) {
                $wpdb->update(lm_table('deals_c'), ['status_c' => 'Awaiting vendor', 'agreedBy_c' => null, 'agreedOn_c' => null, 'agreedTerms_c' => null], ['Id' => $id]);
                lm_deal_event($id, 'terms_changed', wp_get_current_user(), 'The terms changed after the vendor confirmed them, so they need to confirm again.');
                lm_email_deal_review(lm_row('deals_c', $id), 'Awaiting vendor', 'Approved');
                return;
            }
        }
    }
    if ($before && $before['status_c'] !== $after['status_c']) {
        lm_email_deal_review($after, $after['status_c'], $before['status_c']);
    }
}, 20, 4);

function lm_email_deal_review($deal, $to, $from)
{
    $ctx = lm_email_ctx_base() + lm_email_ctx_deal($deal) + [
        'note' => (string) ($deal['reviewNote_c'] ?: ''),
        'review_link' => LM_SITE_URL . '/vendor/deals/' . $deal['Id'],
    ];
    $team = function ($event) use ($deal, $ctx) {
        foreach (lm_team_recipients() as $addr) {
            lm_send_template($event, $addr, $ctx + ['first_name' => 'team', 'name' => 'Team'], ['ref' => $deal['Id']]);
        }
    };
    $vendor = function ($event) use ($deal, $ctx) {
        foreach (lm_deal_people($deal)['vendor'] as $u) {
            lm_send_template($event, $u->user_email, lm_email_ctx_user($u) + $ctx, ['ref' => $deal['Id'], 'user' => $u->ID]);
        }
    };
    if ($to === 'Awaiting team') {
        $team('t_deal_submitted');
    } elseif ($to === 'Awaiting vendor') {
        $vendor('v_deal_review');
    } elseif ($to === 'Approved' && $from === 'Awaiting vendor') {
        $team('t_deal_accepted');
    } elseif ($to === 'Approved' && $from === 'Awaiting team') {
        $vendor('v_deal_approved');
    } elseif ($to === 'Changes requested' && $from === 'Awaiting vendor') {
        $team('t_deal_changes');
    } elseif ($to === 'Changes requested' && $from === 'Awaiting team') {
        $vendor('v_deal_changes');
    }
}
