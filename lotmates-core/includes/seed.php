<?php
if (!defined('ABSPATH')) {
    exit;
}

/** Dates in the demo data are relative to today, India time, stored as UTC. */
function lm_seed_value($v)
{
    if (!is_string($v) || $v === '' || $v[0] !== '@') {
        return $v;
    }
    [$kind, $days] = explode(':', substr($v, 1));
    $d = new DateTime('now', new DateTimeZone('Asia/Kolkata'));
    $d->modify(((int) $days >= 0 ? '+' : '') . (int) $days . ' days');
    if ($kind === 'day') {
        return $d->format('Y-m-d');
    }
    $d->setTime(20, 0);
    $d->setTimezone(new DateTimeZone('UTC'));
    return $d->format('Y-m-d H:i:s');
}

function lm_seed_insert($table, $row)
{
    global $wpdb;
    $fields = lm_fields($table);
    $now = gmdate('Y-m-d H:i:s');
    $clean = ['CreatedOn' => $now, 'ModifiedOn' => $now];
    foreach ($row as $k => $v) {
        if (isset($fields[$k])) {
            $clean[$k] = lm_seed_value($v);
        }
    }
    $wpdb->insert(lm_table($table), $clean);
    return (int) $wpdb->insert_id;
}

/** Sample data for Chennai, the same as the Apper demo. Runs once, on an empty database. */
function lm_seed_demo()
{
    $data = json_decode(file_get_contents(LM_DIR . 'includes/seed-data.json'), true);
    if (!$data) {
        return;
    }
    $city = lm_seed_insert('cities_c', $data['city']);
    $loc = [];
    foreach ($data['localities'] as $l) {
        $loc[$l['Name']] = lm_seed_insert('localities_c', $l + ['city_c' => $city]);
    }
    $com = [];
    foreach ($data['communities'] as $c) {
        $c['locality_c'] = $loc[$c['locality']] ?? null;
        $com[$c['Name']] = lm_seed_insert('communities_c', $c);
    }
    $ven = [];
    foreach ($data['vendors'] as $v) {
        $v['locality_c'] = $loc[$v['locality']] ?? null;
        $ven[$v['Name']] = lm_seed_insert('vendors_c', $v);
    }
    foreach ($data['deals'] as $d) {
        $d['vendor_c'] = $ven[$d['vendor']] ?? null;
        $d['locality_c'] = $loc[$d['locality']] ?? null;
        $d['community_c'] = isset($d['community']) ? ($com[$d['community']] ?? null) : null;
        lm_seed_insert('deals_c', $d);
    }
}
