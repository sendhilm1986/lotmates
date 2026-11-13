<?php
/**
 * Deal categories, managed by the team (Admin > Categories).
 *
 * Each category has a key (stored on deals, vendors and proposals; never changes), a label people
 * see, an icon, whether a neighbour may book again, and the usual way its work is delivered and
 * scheduled. Deals can still override fulfilment and schedule one by one.
 */

const LM_CATEGORY_SEED = [
    ['Health', 'Health checkups', 'HeartPulse', 1, 'service', 'datetime'],
    ['Cleaning', 'Deep cleaning', 'Sparkles', 0, 'service', 'date'],
    ['Solar', 'Rooftop solar', 'Sun', 0, 'service', 'none'],
    ['Products', 'Local products', 'Package', 1, 'delivery', 'none'],
    ['Pest', 'Pest control', 'Bug', 0, 'service', 'date'],
    ['AC', 'AC care', 'Wind', 1, 'service', 'date'],
];

/** Put the first six categories in place the first time, so nothing existing changes. */
function lm_categories_seed()
{
    global $wpdb;
    $t = lm_table('categories_c');
    if ((int) $wpdb->get_var("SELECT COUNT(*) FROM $t") > 0) {
        return;
    }
    $now = current_time('mysql', true);
    foreach (LM_CATEGORY_SEED as $i => [$key, $label, $icon, $repeat, $ful, $sch]) {
        $wpdb->insert($t, [
            'Name' => $label, 'key_c' => $key, 'icon_c' => $icon, 'repeat_c' => $repeat,
            'fulfilment_c' => $ful, 'schedule_c' => $sch, 'status_c' => 'Active', 'order_c' => ($i + 1) * 10,
            'CreatedOn' => $now, 'ModifiedOn' => $now,
        ]);
    }
}

/** All categories keyed by their key: [label, icon, repeat, fulfilment, schedule, active]. */
function lm_categories()
{
    global $wpdb;
    static $c = null;
    if ($c !== null) {
        return $c;
    }
    $c = [];
    $rows = $wpdb->get_results('SELECT * FROM ' . lm_table('categories_c') . ' ORDER BY order_c ASC, Id ASC', ARRAY_A);
    foreach ((array) $rows as $r) {
        $c[$r['key_c']] = [
            'label' => $r['Name'], 'icon' => $r['icon_c'] ?: 'Tag', 'repeat' => (int) $r['repeat_c'] === 1,
            'fulfilment' => $r['fulfilment_c'] ?: 'service', 'schedule' => $r['schedule_c'] ?: 'date',
            'active' => ($r['status_c'] ?? 'Active') === 'Active', 'pending' => ($r['status_c'] ?? '') === 'Pending',
        ];
    }
    if (!$c) {
        foreach (LM_CATEGORY_SEED as [$key, $label, $icon, $repeat, $ful, $sch]) {
            $c[$key] = ['label' => $label, 'icon' => $icon, 'repeat' => (bool) $repeat, 'fulfilment' => $ful, 'schedule' => $sch, 'active' => true, 'pending' => false];
        }
    }
    return $c;
}

function lm_category_label($key)
{
    $c = lm_categories();
    return $c[$key]['label'] ?? (string) $key;
}

/** Keys that can be chosen today (retired ones keep working on old records only). */
function lm_category_keys($active_only = true)
{
    $out = [];
    foreach (lm_categories() as $k => $v) {
        if (!$active_only || $v['active']) {
            $out[] = $k;
        }
    }
    return $out;
}

/** [fulfilment, schedule] the category usually uses. */
function lm_category_defaults($key)
{
    $c = lm_categories();
    return isset($c[$key]) ? [$c[$key]['fulfilment'], $c[$key]['schedule']] : ['service', 'date'];
}

function lm_category_pending($key)
{
    $c = lm_categories();
    return !empty($c[$key]['pending']);
}

function lm_category_key_from($label)
{
    $words = preg_split('/[^A-Za-z0-9]+/', (string) $label, -1, PREG_SPLIT_NO_EMPTY);
    return substr(implode('', array_map('ucfirst', $words)), 0, 30);
}

/**
 * A vendor can suggest a category when none fits. It is usable on that vendor's own deals at once,
 * but stays Pending (hidden from everyone else, and the deal cannot go live) until the team approves it.
 * If a category with that name already exists, that one is returned instead.
 */
function lm_route_category_suggest(WP_REST_Request $r)
{
    global $wpdb;
    $user = wp_get_current_user();
    if (!$user->ID || !(lm_is_admin($user) || lm_profile_of($user) === 'Vendor_c')) {
        return lm_err('Only vendors and the team can suggest a category.', 403);
    }
    $name = trim(sanitize_text_field((string) ($r->get_json_params()['name'] ?? '')));
    $name = mb_substr($name, 0, 60);
    $key = lm_category_key_from($name);
    if (mb_strlen($name) < 3 || $key === '') {
        return lm_err('Give the category a name of at least 3 letters.');
    }
    $t = lm_table('categories_c');
    $hit = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE LOWER(Name) = LOWER(%s) OR LOWER(key_c) = LOWER(%s) LIMIT 1", $name, $key), ARRAY_A);
    if ($hit && ($hit['status_c'] !== 'Pending' || (int) $hit['Owner'] === (int) $user->ID || lm_is_admin($user))) {
        return lm_ok(['key' => $hit['key_c'], 'label' => $hit['Name'], 'existing' => true, 'status' => $hit['status_c']]);
    }
    if ($hit) {
        $key .= (int) $user->ID; // someone else's pending suggestion with the same name
    }
    $max = (int) $wpdb->get_var("SELECT MAX(order_c) FROM $t");
    $now = gmdate('Y-m-d H:i:s');
    $wpdb->insert($t, [
        'Name' => $name, 'key_c' => $key, 'icon_c' => 'Tag', 'repeat_c' => 0, 'fulfilment_c' => 'service', 'schedule_c' => 'date',
        'status_c' => lm_is_admin($user) ? 'Active' : 'Pending', 'order_c' => $max + 10, 'Owner' => (int) $user->ID,
        'CreatedOn' => $now, 'ModifiedOn' => $now,
    ]);
    return lm_ok(['key' => $key, 'label' => $name, 'existing' => false, 'status' => lm_is_admin($user) ? 'Active' : 'Pending']);
}

/**
 * Team only: move every deal, vendor, application and proposal from one category into another,
 * then retire the first (a pending suggestion is removed). Fixes duplicates and wrong picks.
 */
function lm_route_category_merge(WP_REST_Request $r)
{
    global $wpdb;
    $user = wp_get_current_user();
    if (!lm_is_admin($user)) {
        return lm_err('Only the team can merge categories.', 403);
    }
    $p = $r->get_json_params() ?: [];
    $from = (string) ($p['from'] ?? '');
    $to = (string) ($p['to'] ?? '');
    $cats = lm_categories();
    if ($from === $to || !isset($cats[$from]) || !isset($cats[$to])) {
        return lm_err('Pick two different categories.');
    }
    $moved = 0;
    foreach (['deals_c', 'vendors_c', 'vendorApps_c', 'proposals_c'] as $tbl) {
        $full = lm_table($tbl);
        if (!$wpdb->get_var("SHOW TABLES LIKE '" . esc_sql($full) . "'")) {
            continue;
        }
        $moved += (int) $wpdb->query($wpdb->prepare("UPDATE $full SET category_c = %s WHERE category_c = %s", $to, $from));
    }
    $ct = lm_table('categories_c');
    if ($cats[$from]['pending']) {
        $wpdb->delete($ct, ['key_c' => $from]);
    } else {
        $wpdb->update($ct, ['status_c' => 'Retired'], ['key_c' => $from]);
    }
    return lm_ok(['moved' => $moved]);
}

function lm_register_category_routes()
{
    register_rest_route('lotmates/v1', '/category/suggest', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'lm_route_category_suggest']);
    register_rest_route('lotmates/v1', '/category/merge', ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'lm_route_category_merge']);
}
