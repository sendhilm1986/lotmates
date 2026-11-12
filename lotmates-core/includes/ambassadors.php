<?php
/**
 * Ambassador applications: anyone can apply from the public page. The team reviews each one,
 * gets in touch, and only then approves it, which gives the person ambassador access.
 */
if (!defined('ABSPATH')) {
    exit;
}

const LM_APP_RELATIONS = ['Resident', 'Association member', 'Building or estate manager', 'Other'];

function lm_app_row_by_email($email, $open_only = true)
{
    global $wpdb;
    $sql = 'SELECT * FROM ' . lm_table('ambassadorApps_c') . ' WHERE email_c = %s';
    if ($open_only) {
        $sql .= " AND status_c IN ('New','Contacted')";
    }
    return $wpdb->get_row($wpdb->prepare($sql . ' ORDER BY Id DESC LIMIT 1', $email), ARRAY_A);
}

function lm_app_email_ctx($app)
{
    $first = strtok(trim((string) $app['Name']), ' ') ?: 'there';
    $community = trim((string) $app['communityName_c']) . ($app['localityName_c'] ? ', ' . trim((string) $app['localityName_c']) : '');
    $phone = trim((string) $app['phone_c']);
    return [
        'first_name' => $first,
        'name' => (string) $app['Name'],
        'email' => (string) $app['email_c'],
        'phone' => $phone,
        'community' => $community,
        'homes' => $app['homes_c'] ? (string) $app['homes_c'] : 'Not given',
        'relation' => (string) $app['relation_c'],
        'about' => (string) $app['about_c'],
        'contact' => $app['contactPref_c'] === 'Email' ? 'by email at ' . $app['email_c'] : 'by phone at ' . $phone,
        'application_link' => LM_SITE_URL . '/admin/ambassador-applications/' . (int) $app['Id'],
        'terms_link' => LM_SITE_URL . '/legal/ambassadors',
        'site_link' => LM_SITE_URL,
    ];
}

/** Public: send an application. */
function lm_ambassador_apply(WP_REST_Request $r)
{
    global $wpdb;
    $q = $r->get_json_params() ?: [];
    // A hidden field people never see. Bots fill it in.
    if (!empty($q['website'])) {
        return lm_ok(['received' => true]);
    }
    $ok = lm_throttle('amb_apply', 5, 3600);
    if (is_wp_error($ok)) {
        return $ok;
    }
    $name = mb_substr(sanitize_text_field((string) ($q['name'] ?? '')), 0, 100);
    $email = strtolower(sanitize_email((string) ($q['email'] ?? '')));
    $phone = lm_clean_phone($q['phone'] ?? '');
    $community = mb_substr(sanitize_text_field((string) ($q['community'] ?? '')), 0, 120);
    $locality = mb_substr(sanitize_text_field((string) ($q['locality'] ?? '')), 0, 120);
    $homes = isset($q['homes']) && $q['homes'] !== '' && $q['homes'] !== null ? (int) $q['homes'] : null;
    $relation = (string) ($q['relation'] ?? '');
    $about = mb_substr(sanitize_textarea_field((string) ($q['about'] ?? '')), 0, 1500);
    $pref = ($q['contactPref'] ?? 'Phone') === 'Email' ? 'Email' : 'Phone';

    if ($name === '') {
        return lm_err('Add your name.');
    }
    if (!is_email($email)) {
        return lm_err('Enter a valid email address.');
    }
    if (!preg_match('/^\+?[\d\s-]{10,16}$/', $phone)) {
        return lm_err('Enter a 10-digit phone number, e.g. 98765 43210.');
    }
    if ($community === '') {
        return lm_err('Tell us which community you\'d represent.');
    }
    if ($locality === '') {
        return lm_err('Add the area or locality.');
    }
    if ($homes !== null && ($homes < 1 || $homes > 100000)) {
        return lm_err('Enter roughly how many homes are in your community.');
    }
    if (!in_array($relation, LM_APP_RELATIONS, true)) {
        return lm_err('Tell us how you\'re connected to the community.');
    }
    if (empty($q['agreed'])) {
        return lm_err('Please confirm you\'ve read the ambassador terms.');
    }
    $existing = get_user_by('email', $email);
    if ($existing && lm_profile_of($existing) === 'Ambassador_c') {
        return lm_err('You\'re already a Lotmates ambassador. Sign in to your account instead.', 409);
    }

    $now = gmdate('Y-m-d H:i:s');
    $row = [
        'Name' => $name,
        'email_c' => $email,
        'phone_c' => $phone,
        'communityName_c' => $community,
        'localityName_c' => $locality,
        'homes_c' => $homes,
        'relation_c' => $relation,
        'about_c' => $about ?: null,
        'contactPref_c' => $pref,
        'agreed_c' => 1,
        'user_c' => $existing ? (int) $existing->ID : null,
        'ModifiedOn' => $now,
    ];
    $open = lm_app_row_by_email($email);
    if ($open) {
        // One open application per email: a second form updates the first.
        $wpdb->update(lm_table('ambassadorApps_c'), $row, ['Id' => (int) $open['Id']]);
        return lm_ok(['received' => true, 'updated' => true]);
    }
    $row += ['status_c' => 'New', 'CreatedOn' => $now, 'Owner' => $existing ? (int) $existing->ID : null];
    $wpdb->insert(lm_table('ambassadorApps_c'), $row);
    $app = lm_row('ambassadorApps_c', (int) $wpdb->insert_id);
    if ($app) {
        $ctx = lm_app_email_ctx($app);
        lm_send_template('a_application_received', $email, $ctx, ['ref' => (int) $app['Id']]);
        foreach (lm_team_recipients() as $to) {
            lm_send_template('t_new_application', $to, $ctx + ['contact' => ucfirst(preg_replace('/^by /', '', $ctx['contact']))], ['ref' => (int) $app['Id']]);
        }
    }
    return lm_ok(['received' => true]);
}

/** Team: move an application along. */
function lm_ambassador_decide(WP_REST_Request $r)
{
    global $wpdb;
    if (!lm_is_admin()) {
        return lm_err('Only the Lotmates team can review applications.', 403);
    }
    $q = $r->get_json_params() ?: [];
    $app = lm_row('ambassadorApps_c', (int) ($q['id'] ?? 0));
    if (!$app) {
        return lm_err('Application not found.', 404);
    }
    $action = (string) ($q['action'] ?? '');
    $note = isset($q['note']) ? mb_substr(sanitize_textarea_field((string) $q['note']), 0, 2000) : null;
    $now = gmdate('Y-m-d H:i:s');
    $update = ['ModifiedOn' => $now];
    if ($note !== null) {
        $update['adminNote_c'] = $note !== '' ? $note : null;
    }
    $message = 'Saved.';

    switch ($action) {
        case 'note':
            break;
        case 'contacted':
            $update['status_c'] = 'Contacted';
            $update['contactedOn_c'] = $app['contactedOn_c'] ?: $now;
            $message = 'Marked as contacted. You can approve it once you\'re happy.';
            break;
        case 'approve':
            if ($app['status_c'] !== 'Contacted') {
                return lm_err('Get in touch with the applicant and mark it as contacted before approving.');
            }
            $acct = get_user_by('email', $app['email_c']);
            if ($acct && in_array(lm_profile_of($acct), ['Vendor_c', 'Admin_c'], true)) {
                return lm_err('This email belongs to a ' . (lm_profile_of($acct) === 'Vendor_c' ? 'vendor' : 'Lotmates team') . ' account. Ask them to apply with a different email.');
            }
            $res = lm_grant_or_invite($app['email_c'], 'Ambassador_c');
            if (is_wp_error($res)) {
                return $res;
            }
            $update['status_c'] = 'Approved';
            $update['decidedOn_c'] = $now;
            if (!empty($res['userId'])) {
                $update['user_c'] = (int) $res['userId'];
                lm_app_copy_details((int) $res['userId'], $app);
                $message = 'Approved. They had an account, so they have ambassador access now and we\'ve emailed them.';
            } else {
                $message = 'Approved. We\'ve emailed them an invite to set up their ambassador account.';
            }
            break;
        case 'decline':
            $update['status_c'] = 'Declined';
            $update['decidedOn_c'] = $now;
            $message = 'Declined.';
            if (!empty($q['notify'])) {
                $ctx = lm_app_email_ctx($app);
                lm_send_template('a_application_declined', $app['email_c'], $ctx + [
                    'team_note' => $note ? "A note from the team:\n" . $note : '',
                ], ['ref' => (int) $app['Id'], 'force' => true]);
                $message = 'Declined, and we\'ve let them know by email.';
            }
            break;
        case 'reopen':
            $update['status_c'] = $app['contactedOn_c'] ? 'Contacted' : 'New';
            $update['decidedOn_c'] = null;
            $message = 'Reopened.';
            break;
        default:
            return lm_err('Unknown action.');
    }
    $wpdb->update(lm_table('ambassadorApps_c'), $update, ['Id' => (int) $app['Id']]);
    return lm_ok(['message' => $message]);
}

/** Carry the phone number over to the new ambassador's profile, if they haven't set one. */
function lm_app_copy_details($uid, $app)
{
    if (!get_user_meta($uid, 'lm_phone', true) && $app['phone_c']) {
        update_user_meta($uid, 'lm_phone', $app['phone_c']);
    }
}

// When an approved applicant accepts their invite, link the account to the application.
add_action('lm_invite_accepted', function ($uid, $inv) {
    global $wpdb;
    if (($inv['profile'] ?? '') !== 'Ambassador_c') {
        return;
    }
    $app = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . lm_table('ambassadorApps_c') . " WHERE email_c = %s AND status_c = 'Approved' ORDER BY Id DESC LIMIT 1", $inv['email']), ARRAY_A);
    if ($app) {
        $wpdb->update(lm_table('ambassadorApps_c'), ['user_c' => (int) $uid], ['Id' => (int) $app['Id']]);
        lm_app_copy_details((int) $uid, $app);
    }
}, 10, 2);

function lm_register_ambassador_routes()
{
    $ns = 'lotmates/v1';
    register_rest_route($ns, '/ambassador/apply', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'lm_ambassador_apply',
    ]);
    register_rest_route($ns, '/fn/ambassador-decide', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'lm_ambassador_decide',
    ]);
}
