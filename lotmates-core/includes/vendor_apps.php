<?php
/**
 * Vendor applications: any local business can apply from the public vendors page. The team
 * gets in touch, runs the quality checks (ID, licences, references, a test job, the bank
 * account), and only then approves. Approval creates the vendor on probation and gives the
 * applicant vendor access.
 */
if (!defined('ABSPATH')) {
    exit;
}

const LM_VENDOR_QA = [
    'id' => ['label' => 'ID proof', 'vendorCheck' => 'ID proof', 'optional' => false],
    'licence' => ['label' => 'Licences for the trade', 'vendorCheck' => 'Licence', 'optional' => true],
    'references' => ['label' => 'References from past customers', 'vendorCheck' => 'References', 'optional' => false],
    'test' => ['label' => 'Test job', 'vendorCheck' => 'Test job', 'optional' => false],
    'bank' => ['label' => 'Bank account verified', 'vendorCheck' => null, 'optional' => false],
];
const LM_VENDOR_CATEGORIES = ['Health', 'Cleaning', 'Solar', 'Products', 'Pest', 'AC', 'Other'];

function lm_vapp_qa($app)
{
    $qa = json_decode((string) ($app['qa_c'] ?? ''), true);
    return is_array($qa) ? $qa : [];
}

function lm_vapp_email_ctx($app)
{
    $labels = ['Health' => 'Health checkups', 'Cleaning' => 'Deep cleaning', 'Solar' => 'Rooftop solar', 'Products' => 'Local products', 'Pest' => 'Pest control', 'AC' => 'AC care'];
    $cat = $app['category_c'] === 'Other' ? trim((string) $app['newCategory_c']) : ($labels[$app['category_c']] ?? (string) $app['category_c']);
    $areas = lm_vapp_area_names($app);
    $first = strtok(trim((string) $app['contactName_c']), ' ') ?: 'there';
    $phone = trim((string) $app['phone_c']);
    return [
        'first_name' => $first,
        'name' => (string) $app['contactName_c'],
        'business' => (string) $app['Name'],
        'email' => (string) $app['email_c'],
        'phone' => $phone,
        'category' => $cat,
        'areas' => $areas ?: 'Not given',
        'services' => (string) $app['services_c'],
        'contact' => $app['contactPref_c'] === 'Email' ? 'by email at ' . $app['email_c'] : 'by phone at ' . $phone,
        'application_link' => LM_SITE_URL . '/admin/vendor-applications/' . (int) $app['Id'],
        'terms_link' => LM_SITE_URL . '/legal/vendors',
        'site_link' => LM_SITE_URL,
    ];
}

function lm_vapp_area_names($app)
{
    global $wpdb;
    $ids = array_filter(array_map('intval', explode(',', (string) $app['localityIds_c'])));
    $names = [];
    if ($ids) {
        $names = $wpdb->get_col('SELECT Name FROM ' . lm_table('localities_c') . ' WHERE Id IN (' . implode(',', $ids) . ') ORDER BY Name');
    }
    if (trim((string) $app['areasOther_c']) !== '') {
        $names[] = trim((string) $app['areasOther_c']);
    }
    return implode(', ', $names);
}

/** Public: send a vendor application. */
function lm_vendor_apply(WP_REST_Request $r)
{
    global $wpdb;
    $q = $r->get_json_params() ?: [];
    if (!empty($q['website_hp'])) {
        return lm_ok(['received' => true]); // Hidden field only bots fill in.
    }
    $ok = lm_throttle('vendor_apply', 5, 3600);
    if (is_wp_error($ok)) {
        return $ok;
    }
    $text = fn($k, $max) => mb_substr(sanitize_text_field((string) ($q[$k] ?? '')), 0, $max);
    $int = fn($k) => isset($q[$k]) && $q[$k] !== '' && $q[$k] !== null ? (int) $q[$k] : null;

    $business = $text('business', 120);
    $name = $text('name', 100);
    $email = strtolower(sanitize_email((string) ($q['email'] ?? '')));
    $phone = lm_clean_phone($q['phone'] ?? '');
    $category = (string) ($q['category'] ?? '');
    $new_category = $text('newCategory', 80);
    $loc_ids = array_values(array_unique(array_filter(array_map('intval', (array) ($q['localityIds'] ?? [])))));
    $areas_other = $text('areasOther', 200);
    $years = $int('years');
    $team = $int('teamSize');
    $capacity = $int('capacity');
    $gstin = strtoupper(preg_replace('/\s+/', '', $text('gstin', 20)));
    $site = esc_url_raw(mb_substr((string) ($q['website'] ?? ''), 0, 200));
    $services = mb_substr(sanitize_textarea_field((string) ($q['services'] ?? '')), 0, 2000);
    $licences = mb_substr(sanitize_textarea_field((string) ($q['licences'] ?? '')), 0, 1000);
    $pref = ($q['contactPref'] ?? 'Phone') === 'Email' ? 'Email' : 'Phone';

    if ($business === '') {
        return lm_err('Add your business name.');
    }
    if ($name === '') {
        return lm_err('Add your name.');
    }
    if (!is_email($email)) {
        return lm_err('Enter a valid email address.');
    }
    if (!preg_match('/^\+?[\d\s-]{10,16}$/', $phone)) {
        return lm_err('Enter a 10-digit phone number, e.g. 98765 43210.');
    }
    if (!in_array($category, LM_VENDOR_CATEGORIES, true)) {
        return lm_err('Pick what you offer.');
    }
    if ($category === 'Other' && $new_category === '') {
        return lm_err('Name the service or product you offer.');
    }
    if ($loc_ids) {
        $known = array_map('intval', $wpdb->get_col('SELECT Id FROM ' . lm_table('localities_c') . ' WHERE Id IN (' . implode(',', $loc_ids) . ')'));
        $loc_ids = array_values(array_intersect($loc_ids, $known));
    }
    if (!$loc_ids && $areas_other === '') {
        return lm_err('Tell us which areas you serve.');
    }
    if (mb_strlen($services) < 20) {
        return lm_err('Tell us a little more about what you offer, in a sentence or two.');
    }
    if ($gstin !== '' && !preg_match('/^[0-9]{2}[A-Z0-9]{13}$/', $gstin)) {
        return lm_err('That GSTIN doesn\'t look right. It has 15 characters, like 33ABCDE1234F1Z5.');
    }
    foreach (['years' => $years, 'teamSize' => $team, 'capacity' => $capacity] as $k => $v) {
        if ($v !== null && ($v < 0 || $v > 100000)) {
            return lm_err('Check the numbers you entered.');
        }
    }
    if (empty($q['agreed'])) {
        return lm_err('Please confirm you\'ve read the vendor terms.');
    }
    $existing = get_user_by('email', $email);
    if ($existing && lm_profile_of($existing) === 'Vendor_c') {
        return lm_err('This email already has a vendor account. Sign in instead.', 409);
    }

    $now = gmdate('Y-m-d H:i:s');
    $row = [
        'Name' => $business,
        'contactName_c' => $name,
        'email_c' => $email,
        'phone_c' => $phone,
        'category_c' => $category,
        'newCategory_c' => $category === 'Other' ? $new_category : null,
        'localityIds_c' => implode(',', $loc_ids) ?: null,
        'areasOther_c' => $areas_other ?: null,
        'years_c' => $years,
        'teamSize_c' => $team,
        'capacity_c' => $capacity,
        'gstin_c' => $gstin ?: null,
        'website_c' => $site ?: null,
        'services_c' => $services,
        'licences_c' => $licences ?: null,
        'contactPref_c' => $pref,
        'agreed_c' => 1,
        'ModifiedOn' => $now,
    ];
    $open = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . lm_table('vendorApps_c') . " WHERE email_c = %s AND status_c IN ('New','Contacted','Checking') ORDER BY Id DESC LIMIT 1", $email), ARRAY_A);
    if ($open) {
        $wpdb->update(lm_table('vendorApps_c'), $row, ['Id' => (int) $open['Id']]);
        return lm_ok(['received' => true, 'updated' => true]);
    }
    $row += ['status_c' => 'New', 'CreatedOn' => $now, 'Owner' => $existing ? (int) $existing->ID : null];
    $wpdb->insert(lm_table('vendorApps_c'), $row);
    $app = lm_row('vendorApps_c', (int) $wpdb->insert_id);
    if ($app) {
        $ctx = lm_vapp_email_ctx($app);
        lm_send_template('v_application_received', $email, $ctx, ['ref' => (int) $app['Id']]);
        foreach (lm_team_recipients() as $to) {
            lm_send_template('t_new_vendor_application', $to, $ctx + ['contact' => ucfirst(preg_replace('/^by /', '', $ctx['contact']))], ['ref' => (int) $app['Id']]);
        }
    }
    return lm_ok(['received' => true]);
}

/** Team: move a vendor application through contact, checks and a decision. */
function lm_vendor_decide(WP_REST_Request $r)
{
    global $wpdb;
    if (!lm_is_admin()) {
        return lm_err('Only the Lotmates team can review applications.', 403);
    }
    $q = $r->get_json_params() ?: [];
    $app = lm_row('vendorApps_c', (int) ($q['id'] ?? 0));
    if (!$app) {
        return lm_err('Application not found.', 404);
    }
    $me = wp_get_current_user();
    $who = trim($me->first_name . ' ' . $me->last_name) ?: $me->display_name;
    $action = (string) ($q['action'] ?? '');
    $note = isset($q['note']) ? mb_substr(sanitize_textarea_field((string) $q['note']), 0, 2000) : null;
    $now = gmdate('Y-m-d H:i:s');
    $update = ['ModifiedOn' => $now];
    if ($note !== null && $action !== 'check') {
        $update['adminNote_c'] = $note !== '' ? $note : null;
    }
    $open = in_array($app['status_c'], ['New', 'Contacted', 'Checking'], true);
    $message = 'Saved.';

    switch ($action) {
        case 'note':
            break;
        case 'contacted':
            $update['status_c'] = $app['status_c'] === 'New' ? 'Contacted' : $app['status_c'];
            $update['contactedOn_c'] = $app['contactedOn_c'] ?: $now;
            $message = 'Marked as contacted. Next, run the checks.';
            break;
        case 'check':
            if (!$open) {
                return lm_err('Reopen the application to change its checks.');
            }
            if (!$app['contactedOn_c']) {
                return lm_err('Get in touch with them first, then record the checks.');
            }
            $key = (string) ($q['key'] ?? '');
            $state = (string) ($q['state'] ?? '');
            if (!isset(LM_VENDOR_QA[$key]) || !in_array($state, ['pending', 'passed', 'failed', 'na'], true)) {
                return lm_err('Unknown check.');
            }
            if ($state === 'na' && !LM_VENDOR_QA[$key]['optional']) {
                return lm_err(LM_VENDOR_QA[$key]['label'] . ' is needed for every vendor.');
            }
            $qa = lm_vapp_qa($app);
            if ($state === 'pending') {
                unset($qa[$key]);
            } else {
                $qa[$key] = ['state' => $state, 'by' => $who, 'at' => lm_iso_utc($now), 'note' => $note !== null ? $note : ($qa[$key]['note'] ?? '')];
            }
            $update['qa_c'] = wp_json_encode($qa);
            $update['status_c'] = 'Checking';
            $message = LM_VENDOR_QA[$key]['label'] . ': ' . ['pending' => 'not done yet', 'passed' => 'passed', 'failed' => 'failed', 'na' => 'not needed'][$state] . '.';
            break;
        case 'approve':
            if (!$open || !$app['contactedOn_c']) {
                return lm_err('Get in touch with them and run the checks before approving.');
            }
            $qa = lm_vapp_qa($app);
            foreach (LM_VENDOR_QA as $key => $c) {
                $st = $qa[$key]['state'] ?? 'pending';
                if (!in_array($st, ['passed', 'na'], true)) {
                    return lm_err('Finish the checks first. ' . $c['label'] . ' is ' . ($st === 'failed' ? 'marked as failed' : 'not done yet') . '.');
                }
            }
            $acct = get_user_by('email', $app['email_c']);
            if ($acct && in_array(lm_profile_of($acct), ['Admin_c', 'Ambassador_c'], true)) {
                return lm_err('This email belongs to ' . (lm_profile_of($acct) === 'Admin_c' ? 'a Lotmates team' : 'an ambassador') . ' account. Ask them to apply with a different email.');
            }
            // The vendor record, on probation with smaller first deals.
            $passed = [];
            foreach (LM_VENDOR_QA as $key => $c) {
                if ($c['vendorCheck'] && ($qa[$key]['state'] ?? '') === 'passed') {
                    $passed[] = $c['vendorCheck'];
                }
            }
            $loc = array_filter(array_map('intval', explode(',', (string) $app['localityIds_c'])));
            $vendor_id = (int) $app['vendor_c'];
            if (!$vendor_id) {
                $wpdb->insert(lm_table('vendors_c'), [
                    'Name' => $app['Name'],
                    'category_c' => $app['category_c'],
                    'contactName_c' => $app['contactName_c'],
                    'phone_c' => $app['phone_c'],
                    'email_c' => $app['email_c'],
                    'status_c' => 'Probation',
                    'checks_c' => implode(',', $passed),
                    'jobsDone_c' => 0,
                    'notes_c' => trim(($app['category_c'] === 'Other' ? 'Offers: ' . $app['newCategory_c'] . "\n" : '') . $app['services_c']),
                    'locality_c' => $loc ? reset($loc) : null,
                    'user_c' => $acct ? (int) $acct->ID : null,
                    'Owner' => (int) $me->ID,
                    'CreatedOn' => $now,
                    'ModifiedOn' => $now,
                ]);
                $vendor_id = (int) $wpdb->insert_id;
                // Remember it now, so a retry after a failed email doesn't create a second vendor.
                $wpdb->update(lm_table('vendorApps_c'), ['vendor_c' => $vendor_id], ['Id' => (int) $app['Id']]);
            }
            $res = lm_grant_or_invite($app['email_c'], 'Vendor_c');
            if (is_wp_error($res)) {
                return $res;
            }
            $update['status_c'] = 'Approved';
            $update['decidedOn_c'] = $now;
            $update['vendor_c'] = $vendor_id;
            if (!empty($res['userId'])) {
                $update['user_c'] = (int) $res['userId'];
                $wpdb->update(lm_table('vendors_c'), ['user_c' => (int) $res['userId']], ['Id' => $vendor_id]);
                if (!get_user_meta((int) $res['userId'], 'lm_phone', true)) {
                    update_user_meta((int) $res['userId'], 'lm_phone', $app['phone_c']);
                }
                $message = 'Approved. The vendor is on probation, and their existing account now has vendor access.';
            } else {
                $message = 'Approved. The vendor is on probation, and we\'ve emailed them an invite to set up their account.';
            }
            break;
        case 'decline':
            $update['status_c'] = 'Declined';
            $update['decidedOn_c'] = $now;
            $message = 'Declined.';
            if (!empty($q['notify'])) {
                lm_send_template('v_application_declined', $app['email_c'], lm_vapp_email_ctx($app) + [
                    'team_note' => $note ? "A note from the team:\n" . $note : '',
                ], ['ref' => (int) $app['Id'], 'force' => true]);
                $message = 'Declined, and we\'ve let them know by email.';
            }
            break;
        case 'reopen':
            if ($app['status_c'] === 'Approved') {
                return lm_err('This vendor is already set up. Manage them from Vendors.');
            }
            $update['status_c'] = lm_vapp_qa($app) ? 'Checking' : ($app['contactedOn_c'] ? 'Contacted' : 'New');
            $update['decidedOn_c'] = null;
            $message = 'Reopened.';
            break;
        default:
            return lm_err('Unknown action.');
    }
    $wpdb->update(lm_table('vendorApps_c'), $update, ['Id' => (int) $app['Id']]);
    return lm_ok(['message' => $message]);
}

// An approved applicant accepting their invite: link the new account to the vendor record.
add_action('lm_invite_accepted', function ($uid, $inv) {
    global $wpdb;
    if (($inv['profile'] ?? '') !== 'Vendor_c') {
        return;
    }
    $app = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . lm_table('vendorApps_c') . " WHERE email_c = %s AND status_c = 'Approved' ORDER BY Id DESC LIMIT 1", $inv['email']), ARRAY_A);
    if (!$app) {
        return;
    }
    $wpdb->update(lm_table('vendorApps_c'), ['user_c' => (int) $uid], ['Id' => (int) $app['Id']]);
    if ($app['vendor_c']) {
        $wpdb->update(lm_table('vendors_c'), ['user_c' => (int) $uid], ['Id' => (int) $app['vendor_c']]);
    }
    if (!get_user_meta($uid, 'lm_phone', true) && $app['phone_c']) {
        update_user_meta($uid, 'lm_phone', $app['phone_c']);
    }
}, 10, 2);

function lm_register_vendor_app_routes()
{
    $ns = 'lotmates/v1';
    register_rest_route($ns, '/vendor/apply', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'lm_vendor_apply',
    ]);
    register_rest_route($ns, '/fn/vendor-decide', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'lm_vendor_decide',
    ]);
}
