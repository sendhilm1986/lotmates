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
            'active' => ($r['status_c'] ?? 'Active') !== 'Retired',
        ];
    }
    if (!$c) {
        foreach (LM_CATEGORY_SEED as [$key, $label, $icon, $repeat, $ful, $sch]) {
            $c[$key] = ['label' => $label, 'icon' => $icon, 'repeat' => (bool) $repeat, 'fulfilment' => $ful, 'schedule' => $sch, 'active' => true];
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
