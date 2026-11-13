<?php
if (!defined('ABSPATH')) {
    exit;
}

/*
 * One query endpoint the front end uses for every table, with the same shape as the
 * Apper SDK it replaced. Every request passes through lm_grants(): who may see which
 * rows, and which fields of those rows. Nothing outside a grant ever leaves the server.
 */

const LM_CORE_FIELDS = ['Id' => 'id', 'Name' => 'text', 'Owner' => 'people', 'CreatedOn' => 'dt', 'ModifiedOn' => 'dt'];

function lm_fields($table)
{
    $s = lm_schema();
    return isset($s[$table]) ? array_merge(LM_CORE_FIELDS, $s[$table]) : null;
}

/** Ids of vendor records linked to the current vendor user. */
function lm_my_vendor_ids($uid)
{
    global $wpdb;
    static $cache = [];
    if (!isset($cache[$uid])) {
        $cache[$uid] = array_map('intval', $wpdb->get_col($wpdb->prepare('SELECT Id FROM ' . lm_table('vendors_c') . ' WHERE user_c = %d', $uid)));
    }
    return $cache[$uid];
}

function lm_ids_sql($ids)
{
    $ids = array_filter(array_map('intval', $ids));
    return $ids ? '(' . implode(',', $ids) . ')' : '(0)';
}

/**
 * Read grants for a table: each is [sql row condition, allowed fields ('*' = all)].
 * A row is returned if any grant matches; its fields are the union of matching grants.
 */
function lm_grants($table, $user)
{
    $uid = $user && $user->ID ? (int) $user->ID : 0;
    $profile = $uid ? lm_profile_of($user) : null;
    if ($profile === 'Admin_c') {
        return [['1=1', '*']];
    }

    $g = [];
    $pub_vendor = ['Id', 'Name', 'category_c', 'locality_c', 'status_c', 'checks_c', 'rating_c', 'jobsDone_c', 'contactName_c', 'CreatedOn'];
    $pub_deal = array_values(array_diff(array_keys(lm_fields('deals_c')), ['commission_c', 'Owner', 'ModifiedOn']));

    switch ($table) {
        case 'categories_c':
            // Pending suggestions are seen only by whoever suggested them (and the team).
            $g[] = ["status_c <> 'Pending'" . ($uid ? " OR Owner = $uid" : ''), array_values(array_diff(array_keys(lm_fields($table)), []))];
            break;
        case 'cities_c':
        case 'localities_c':
            $g[] = ['1=1', array_values(array_diff(array_keys(lm_fields($table)), ['Owner']))];
            break;
        case 'communities_c':
            $g[] = ['1=1', ['Id', 'Name', 'type_c', 'homes_c', 'ambassadorName_c', 'status_c', 'locality_c', 'CreatedOn']];
            if ($profile === 'Ambassador_c') {
                $g[] = ["ambassadorUser_c = $uid", '*'];
            }
            break;
        case 'vendors_c':
            $g[] = ["status_c IN ('Active','Probation')", $pub_vendor];
            if ($profile === 'Vendor_c') {
                $g[] = ["user_c = $uid", '*'];
            }
            break;
        case 'deals_c':
            $g[] = ["status_c IN ('Live','Closed','Failed')", $pub_deal];
            if ($profile === 'Vendor_c') {
                $g[] = ['vendor_c IN ' . lm_ids_sql(lm_my_vendor_ids($uid)) . " AND (status_c <> 'Draft' OR origin_c = 'vendor')", '*'];
            }
            break;
        case 'dealEvents_c':
            if ($profile === 'Vendor_c') {
                $g[] = ['deal_c IN (SELECT Id FROM ' . lm_table('deals_c') . ' WHERE vendor_c IN ' . lm_ids_sql(lm_my_vendor_ids($uid)) . " AND (status_c <> 'Draft' OR origin_c = 'vendor'))", '*'];
            }
            break;
        case 'reviews_c':
            // Reviews the team has hidden stay visible only to the person who wrote them.
            $g[] = ['(hidden_c IS NULL OR hidden_c = 0)', ['Id', 'Name', 'rating_c', 'comment_c', 'deal_c', 'vendor_c', 'Owner', 'CreatedOn', 'serviceDone_c', 'photos_c']];
            if ($uid) {
                $g[] = ["Owner = $uid", '*'];
            }
            break;
        case 'bookings_c':
            // Checkouts that were never paid stay out of everyone's lists but the team's.
            $paid = "paymentStatus_c <> 'Pending'";
            if ($profile === 'Customer_c') {
                $g[] = ["Owner = $uid AND $paid", '*'];
            } elseif ($profile === 'Vendor_c') {
                $g[] = ["vendorUser_c = $uid AND $paid", '*'];
            } elseif ($profile === 'Ambassador_c') {
                $g[] = ["Owner = $uid AND $paid", '*']; // Their own bookings, in full.
                $g[] = ["ambassador_c = $uid AND $paid", ['Id', 'Name', 'deal_c', 'community_c', 'homes_c', 'unitPrice_c', 'amountPaid_c', 'finalPrice_c', 'status_c', 'paymentStatus_c', 'CreatedOn']];
            }
            break;
        case 'complaints_c':
            if ($profile === 'Customer_c' || $profile === 'Ambassador_c') {
                $g[] = ["Owner = $uid", '*'];
            } elseif ($profile === 'Vendor_c') {
                $g[] = ["vendorUser_c = $uid", '*'];
            }
            break;
        case 'payouts_c':
            if ($profile === 'Vendor_c') {
                $g[] = ["vendorUser_c = $uid", '*'];
            }
            break;
        case 'proposals_c':
            if ($profile === 'Ambassador_c' || $profile === 'Customer_c') {
                $g[] = ["Owner = $uid", '*'];
            }
            break;
    }
    return $g;
}

/** Turn the client's filter tree into SQL. Field names are checked against the schema. */
function lm_where_sql($expr, $fields, &$params)
{
    if (!is_array($expr) || empty($expr['op'])) {
        return '1=1';
    }
    $op = $expr['op'];
    if ($op === 'and' || $op === 'or') {
        $parts = [];
        foreach ((array) ($expr['items'] ?? []) as $item) {
            $parts[] = '(' . lm_where_sql($item, $fields, $params) . ')';
        }
        if (!$parts) {
            return '1=1';
        }
        return implode($op === 'and' ? ' AND ' : ' OR ', $parts);
    }
    $f = $expr['f'] ?? '';
    if (!isset($fields[$f])) {
        throw new Exception('Unknown field ' . $f);
    }
    $col = '`' . $f . '`';
    $v = $expr['v'] ?? null;
    $ph = in_array($fields[$f], ['int', 'id', 'people'], true) || strpos($fields[$f], 'lookup:') === 0 ? '%d' : ($fields[$f] === 'dec' ? '%f' : '%s');
    $map = ['eq' => '=', 'ne' => '<>', 'gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<='];
    if (isset($map[$op])) {
        if ($v === null) {
            return $op === 'ne' ? "$col IS NOT NULL" : "$col IS NULL";
        }
        $params[] = lm_db_value($fields[$f], $v);
        return "$col {$map[$op]} $ph";
    }
    if ($op === 'in' || $op === 'notin') {
        $vals = array_values((array) $v);
        if (!$vals) {
            return $op === 'in' ? '1=0' : '1=1';
        }
        foreach ($vals as $x) {
            $params[] = lm_db_value($fields[$f], $x);
        }
        return $col . ($op === 'in' ? ' IN (' : ' NOT IN (') . implode(',', array_fill(0, count($vals), $ph)) . ')';
    }
    if ($op === 'contains') {
        global $wpdb;
        $params[] = '%' . $wpdb->esc_like((string) $v) . '%';
        return "$col LIKE %s";
    }
    if ($op === 'rel') {
        // Relative date ranges, worked out in India time and compared with the stored UTC values.
        $range = lm_relative_range((string) $v);
        if (!$range) {
            throw new Exception('Unknown date range ' . $v);
        }
        $date_only = $fields[$f] === 'date';
        $params[] = $date_only ? substr($range[0], 0, 10) : $range[0];
        $params[] = $date_only ? substr($range[1], 0, 10) : $range[1];
        return "$col >= %s AND $col < %s";
    }
    if ($op === 'isnull') {
        return "$col IS NULL";
    }
    if ($op === 'notnull') {
        return "$col IS NOT NULL";
    }
    throw new Exception('Unknown filter ' . $op);
}

/** [start, end) in UTC for a named range such as "this week". */
function lm_relative_range($name)
{
    $tz = new DateTimeZone('Asia/Kolkata');
    $utc = new DateTimeZone('UTC');
    $today = new DateTimeImmutable('today', $tz);
    switch (strtolower(trim($name))) {
        case 'today':
            $a = $today;
            $b = $today->modify('+1 day');
            break;
        case 'yesterday':
            $a = $today->modify('-1 day');
            $b = $today;
            break;
        case 'this week':
            $a = $today->modify('monday this week');
            $b = $a->modify('+7 days');
            break;
        case 'last 7 days':
            $a = $today->modify('-6 days');
            $b = $today->modify('+1 day');
            break;
        case 'this month':
            $a = $today->modify('first day of this month');
            $b = $a->modify('+1 month');
            break;
        case 'last 30 days':
            $a = $today->modify('-29 days');
            $b = $today->modify('+1 day');
            break;
        case 'next 24 hours':
            $a = new DateTimeImmutable('now', $tz);
            $b = $a->modify('+1 day');
            break;
        default:
            return null;
    }
    return [$a->setTimezone($utc)->format('Y-m-d H:i:s'), $b->setTimezone($utc)->format('Y-m-d H:i:s')];
}

/**
 * Totals for the dashboard tiles. Each aggregator is {id, fields:[{field, fn, alias}], where}.
 * They run over the same rows the caller can already see. People other than the team may only
 * total fields they can read on every row they see, so masked values never leak through a sum.
 */
function lm_run_aggregates($table, $grants, $is_admin, $base_where, $base_params, $aggs)
{
    global $wpdb;
    $fields = lm_fields($table);
    $safe = null;
    if (!$is_admin) {
        foreach ($grants as $gr) {
            $cols = $gr[1] === '*' ? array_keys($fields) : $gr[1];
            $safe = $safe === null ? $cols : array_values(array_intersect($safe, $cols));
        }
        $safe = $safe ?? [];
    }
    $fns = ['count' => 'COUNT', 'sum' => 'SUM', 'avg' => 'AVG', 'min' => 'MIN', 'max' => 'MAX'];
    $out = [];
    foreach (array_slice((array) $aggs, 0, 12) as $agg) {
        if (!is_array($agg)) {
            continue;
        }
        $id = sanitize_key((string) ($agg['id'] ?? ''));
        $params = $base_params;
        $extra = '1=1';
        if (!empty($agg['where'])) {
            if (!$is_admin) {
                foreach (lm_filter_fields($agg['where']) as $ff) {
                    if (!in_array($ff, $safe, true)) {
                        throw new Exception('Unknown field ' . $ff);
                    }
                }
            }
            $extra = lm_where_sql($agg['where'], $fields, $params);
        }
        $select = [];
        $aliases = [];
        foreach (array_slice((array) ($agg['fields'] ?? []), 0, 6) as $i => $spec) {
            $fn = strtolower((string) ($spec['fn'] ?? 'count'));
            $f = (string) ($spec['field'] ?? 'Id');
            if (!isset($fns[$fn]) || !isset($fields[$f])) {
                throw new Exception('Unknown total ' . $fn . ' of ' . $f);
            }
            if (!$is_admin && $f !== 'Id' && !in_array($f, $safe, true)) {
                throw new Exception('Unknown field ' . $f);
            }
            $alias = preg_replace('/[^A-Za-z0-9_]/', '', (string) ($spec['alias'] ?? '')) ?: ('v' . $i);
            $select[] = $fns[$fn] . '(`' . $f . '`) AS a' . $i;
            $aliases[$i] = $alias;
        }
        if (!$select) {
            $select[] = 'COUNT(*) AS a0';
            $aliases[0] = 'count';
        }
        $sql = 'SELECT ' . implode(', ', $select) . ' FROM ' . lm_table($table) . ' WHERE (' . $base_where . ') AND (' . $extra . ')';
        $row = $params ? $wpdb->get_row($wpdb->prepare($sql, $params), ARRAY_A) : $wpdb->get_row($sql, ARRAY_A);
        $data = [];
        foreach ($aliases as $i => $alias) {
            $data[$alias] = round((float) ($row['a' . $i] ?? 0), 2);
        }
        $out[] = ['id' => $id, 'data' => $data, 'value' => reset($data)];
    }
    return $out;
}

/** Convert an incoming value to what the column stores. */
function lm_db_value($type, $v)
{
    if ($type === 'json') {
        return lm_clean_gallery($v);
    }
    if ($type === 'video') {
        return lm_clean_video($v);
    }
    if (is_array($v) && isset($v['Id'])) {
        $v = $v['Id'];
    }
    if ($v === null || $v === '') {
        return null;
    }
    switch (true) {
        case $type === 'id' || $type === 'people' || $type === 'int' || strpos($type, 'lookup:') === 0:
            return (int) $v;
        case $type === 'dec':
            return (float) $v;
        case $type === 'date':
            $t = strtotime((string) $v);
            return $t ? gmdate('Y-m-d', $t) : null;
        case $type === 'dt':
            $t = strtotime((string) $v);
            return $t ? gmdate('Y-m-d H:i:s', $t) : null;
        case $type === 'email':
            return sanitize_email((string) $v);
        case $type === 'long':
            return sanitize_textarea_field((string) $v);
        case $type === 'multi':
            return implode(',', array_map('sanitize_text_field', is_array($v) ? $v : explode(',', (string) $v)));
        default:
            return sanitize_text_field((string) $v);
    }
}

/** Shape a database row the way the front end expects (lookups as {Id, Name}). */
function lm_format_rows($table, $rows, $allowed_per_row, $is_admin)
{
    global $wpdb;
    $fields = lm_fields($table);
    // Collect lookup and people ids to resolve names in one query per table.
    $need = [];
    foreach ($rows as $i => $row) {
        foreach ($row as $k => $v) {
            if ($v === null || !isset($fields[$k])) {
                continue;
            }
            $t = $fields[$k];
            if (strpos($t, 'lookup:') === 0) {
                $need[substr($t, 7)][(int) $v] = true;
            } elseif ($t === 'people') {
                $need['__users'][(int) $v] = true;
            }
        }
    }
    $names = [];
    foreach ($need as $tbl => $ids) {
        $list = lm_ids_sql(array_keys($ids));
        if ($tbl === '__users') {
            foreach (get_users(['include' => array_keys($ids), 'fields' => ['ID', 'display_name']]) as $u) {
                $names['__users'][(int) $u->ID] = $u->display_name;
            }
            if (!$is_admin) {
                // Outside the team, people show as first name and initial.
                foreach ($names['__users'] ?? [] as $id => $n) {
                    $parts = preg_split('/\s+/', trim($n));
                    $names['__users'][$id] = $parts[0] . (isset($parts[1]) ? ' ' . mb_substr($parts[1], 0, 1) . '.' : '');
                }
            }
        } else {
            foreach ($wpdb->get_results('SELECT Id, Name FROM ' . lm_table($tbl) . " WHERE Id IN $list", ARRAY_A) as $r) {
                $names[$tbl][(int) $r['Id']] = $r['Name'];
            }
        }
    }
    $out = [];
    foreach ($rows as $i => $row) {
        $allowed = $allowed_per_row[$i];
        $o = [];
        foreach ($row as $k => $v) {
            if (!isset($fields[$k]) || ($allowed !== '*' && !in_array($k, $allowed, true))) {
                continue;
            }
            $t = $fields[$k];
            if ($v === null) {
                $o[$k] = null;
            } elseif (strpos($t, 'lookup:') === 0) {
                $tbl = substr($t, 7);
                $o[$k] = ['Id' => (string) $v, 'Name' => $names[$tbl][(int) $v] ?? null];
            } elseif ($t === 'people') {
                $o[$k] = ['Id' => (int) $v, 'Name' => $names['__users'][(int) $v] ?? null];
            } elseif ($t === 'id') {
                $o[$k] = (string) $v;
            } elseif ($t === 'int') {
                $o[$k] = (int) $v;
            } elseif ($t === 'dec') {
                $o[$k] = (float) $v;
            } elseif ($t === 'dt') {
                $o[$k] = gmdate('Y-m-d\TH:i:s\Z', strtotime($v . ' UTC'));
            } elseif ($t === 'json') {
                $o[$k] = json_decode((string) $v, true) ?: [];
            } else {
                $o[$k] = $v;
            }
        }
        // Ids go out as strings, as they did on Apper; form controls compare them as text.
        $o['Id'] = (string) $row['Id'];
        $out[] = $o;
    }
    return $out;
}

function lm_run_select($table, $user, $req)
{
    global $wpdb;
    $fields = lm_fields($table);
    $grants = lm_grants($table, $user);
    if (!$grants) {
        return ['success' => true, 'data' => [], 'total' => 0];
    }
    $is_admin = $grants[0][0] === '1=1' && $grants[0][1] === '*';

    $params = [];
    $where = lm_where_sql($req['where'] ?? null, $fields, $params);
    if (!empty($req['id'])) {
        $where = '(' . $where . ') AND Id = %d';
        $params[] = (int) $req['id'];
    }

    // A filter on a field the caller may not read would reveal it, so filters use only readable fields.
    if (!$is_admin) {
        $readable = [];
        foreach ($grants as $gr) {
            $readable = $gr[1] === '*' ? array_keys($fields) : array_merge($readable, $gr[1]);
            if ($gr[1] === '*') {
                break;
            }
        }
        foreach (lm_filter_fields($req['where'] ?? null) as $ff) {
            if (!in_array($ff, $readable, true)) {
                throw new Exception('Unknown field ' . $ff);
            }
        }
    }

    $grant_sql = [];
    $flags = [];
    foreach ($grants as $i => $gr) {
        $grant_sql[] = '(' . $gr[0] . ')';
        $flags[] = '(' . $gr[0] . ') AS __g' . $i;
    }
    $base = 'FROM ' . lm_table($table) . ' WHERE (' . $where . ') AND (' . implode(' OR ', $grant_sql) . ')';

    // Totals only: skip loading rows.
    if (!empty($req['aggregators']) && is_array($req['aggregators'])) {
        $aggs = lm_run_aggregates($table, $grants, $is_admin, '(' . $where . ') AND (' . implode(' OR ', $grant_sql) . ')', $params, $req['aggregators']);
        return ['success' => true, 'data' => [], 'total' => 0, 'aggregators' => $aggs];
    }

    $order = '';
    if (!empty($req['order']) && is_array($req['order'])) {
        $parts = [];
        foreach ($req['order'] as $o) {
            $f = $o['f'] ?? '';
            if (isset($fields[$f])) {
                $parts[] = '`' . $f . '` ' . (($o['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC');
            }
        }
        if ($parts) {
            $order = ' ORDER BY ' . implode(', ', $parts) . ', Id ASC';
        }
    }
    $size = max(1, min(200, (int) ($req['size'] ?? 100)));
    $page = max(1, (int) ($req['page'] ?? 1));
    $limit = ' LIMIT ' . $size . ' OFFSET ' . (($page - 1) * $size);

    $count_sql = 'SELECT COUNT(*) ' . $base;
    $total = (int) ($params ? $wpdb->get_var($wpdb->prepare($count_sql, $params)) : $wpdb->get_var($count_sql));

    $sql = 'SELECT *, ' . implode(', ', $flags) . ' ' . $base . $order . $limit;
    $rows = $params ? $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) : $wpdb->get_results($sql, ARRAY_A);

    $allowed = [];
    foreach ($rows as $i => $row) {
        $a = [];
        foreach ($grants as $gi => $gr) {
            if ((int) $row['__g' . $gi] === 1) {
                if ($gr[1] === '*') {
                    $a = '*';
                    break;
                }
                $a = array_merge($a, $gr[1]);
            }
        }
        $allowed[$i] = $a;
    }
    $data = lm_format_rows($table, $rows, $allowed, $is_admin);

    // Keep only the fields the caller selected (plus Id).
    if (!empty($req['fields']) && is_array($req['fields'])) {
        $keep = array_flip(array_merge(['Id'], $req['fields']));
        foreach ($data as &$d) {
            $d = array_intersect_key($d, $keep);
        }
        unset($d);
    }
    return ['success' => true, 'data' => $data, 'total' => $total];
}

function lm_filter_fields($expr)
{
    if (!is_array($expr) || empty($expr['op'])) {
        return [];
    }
    if ($expr['op'] === 'and' || $expr['op'] === 'or') {
        $out = [];
        foreach ((array) ($expr['items'] ?? []) as $i) {
            $out = array_merge($out, lm_filter_fields($i));
        }
        return $out;
    }
    return [$expr['f'] ?? ''];
}

/** Only the Lotmates team writes through the generic endpoint. Other roles get purpose-built endpoints. */
/**
 * What a signed-in non-team user may write. Returns null when nothing is allowed, or
 * ['fields' => [...], 'force' => [...], 'own' => SQL condition a row must meet to be changed].
 */
function lm_write_policy($table, $user, $op)
{
    $uid = $user && $user->ID ? (int) $user->ID : 0;
    if (!$uid) {
        return null;
    }
    $profile = lm_profile_of($user);
    if ($table === 'reviews_c') {
        if ($profile === 'Admin_c') {
            // The team moderates reviews (hide or remove); it never writes or rewrites them.
            return $op === 'create' ? null : ['fields' => ['hidden_c', 'hiddenReason_c'], 'force' => [], 'own' => '1=1'];
        }
        if (in_array($profile, ['Customer_c', 'Ambassador_c'], true)) {
            return [
                'fields' => $op === 'create' ? ['Name', 'rating_c', 'comment_c', 'booking_c', 'photos_c'] : ['Name', 'rating_c', 'comment_c', 'photos_c'],
                'force' => [],
                'own' => "Owner = $uid",
            ];
        }
        return null;
    }
    if ($table === 'complaints_c') {
        if (in_array($profile, ['Customer_c', 'Ambassador_c'], true)) {
            return [
                'fields' => $op === 'create' ? ['Name', 'details_c', 'booking_c', 'photos_c'] : ['Name', 'details_c', 'photos_c'],
                'force' => $op === 'create' ? ['status_c' => 'Open', 'response_c' => null, 'resolution_c' => null] : [],
                // Their own, and only while the team hasn't started on it.
                'own' => "Owner = $uid AND status_c = 'Open'",
            ];
        }
        if ($profile === 'Vendor_c' && $op === 'update') {
            // Vendors reply to complaints about their own jobs; they can't change anything else.
            return ['fields' => ['response_c'], 'force' => [], 'own' => "vendorUser_c = $uid AND status_c <> 'Resolved'"];
        }
        return null;
    }
    if ($table === 'proposals_c' && $profile === 'Ambassador_c') {
        return [
            'fields' => ['Name', 'category_c', 'community_c', 'homesInterested_c', 'notes_c', 'newCategory_c', 'newCommunity_c', 'newLocality_c', 'contactPref_c', 'contactPhone_c'],
            // The email on file is always the account's own, so the team writes to the real person.
            'force' => $op === 'create' ? ['status_c' => 'New', 'adminNote_c' => null, 'repliedOn_c' => null, 'contactEmail_c' => $user->user_email] : ['contactEmail_c' => $user->user_email],
            // Only their own proposals, and only while the team hasn't picked them up.
            'own' => "Owner = $uid AND status_c = 'New'",
        ];
    }
    return null;
}

/**
 * A review is allowed only from the person who booked, once the vendor has marked the job done
 * (service given or product delivered), and only one per booking. The deal and vendor come from
 * the booking, never from the form. Returns the row to save, or an error message.
 */
function lm_check_review($row, $op, $user, $rec = [])
{
    global $wpdb;
    $existing = $op === 'create' ? null : lm_row('reviews_c', (int) ($rec['Id'] ?? 0));
    if (array_key_exists('rating_c', $row) || $op === 'create') {
        $r = (int) ($row['rating_c'] ?? 0);
        if ($r < 1 || $r > 5) {
            return 'Give the job between 1 and 5 stars.';
        }
        $row['rating_c'] = $r;
    }
    if (array_key_exists('Name', $row) || $op === 'create') {
        $row['Name'] = mb_substr(trim((string) ($row['Name'] ?? '')), 0, 120);
        if ($row['Name'] === '') {
            return 'Add a short headline.';
        }
    }
    if (isset($row['comment_c']) && mb_strlen((string) $row['comment_c']) > 1500) {
        return 'Keep the review under 1,500 characters.';
    }
    if ($op !== 'create') {
        return lm_review_attach_photos($row, $rec, $user, $existing);
    }
    $b = lm_row('bookings_c', (int) ($row['booking_c'] ?? 0));
    if (!$b || (int) $b['Owner'] !== (int) $user->ID) {
        return 'You can only review a booking you made.';
    }
    if ($b['paymentStatus_c'] !== 'Paid' || $b['status_c'] !== 'Done') {
        return 'You can review once the vendor has finished the job or delivered your order.';
    }
    if ($wpdb->get_var($wpdb->prepare('SELECT Id FROM ' . lm_table('reviews_c') . ' WHERE booking_c = %d LIMIT 1', (int) $b['Id']))) {
        return 'You\'ve already reviewed this booking. You can edit that review instead.';
    }
    $deal = lm_row('deals_c', (int) $b['deal_c']);
    $row['booking_c'] = (int) $b['Id'];
    $row['deal_c'] = (int) $b['deal_c'];
    $row['vendor_c'] = $deal ? (int) $deal['vendor_c'] : null;
    $row['serviceDone_c'] = $b['ModifiedOn'];
    $row['hidden_c'] = 0;
    return lm_review_attach_photos($row, $rec, $user, null);
}

/**
 * A complaint comes from the person who made a paid booking. The deal, vendor and vendor's
 * account come from the booking, so the right vendor sees it and can reply.
 */
function lm_check_complaint($row, $op, $user, $rec = [])
{
    if (array_key_exists('Name', $row) || $op === 'create') {
        $row['Name'] = mb_substr(trim((string) ($row['Name'] ?? '')), 0, 140);
        if ($row['Name'] === '') {
            return 'Add a short subject.';
        }
    }
    if (array_key_exists('details_c', $row) || $op === 'create') {
        $d = trim((string) ($row['details_c'] ?? ''));
        if ($d === '') {
            return 'Tell us what happened.';
        }
        if (mb_strlen($d) > 3000) {
            return 'Keep it under 3,000 characters.';
        }
    }
    if ($op !== 'create') {
        return lm_review_attach_photos($row, $rec, $user, lm_row('complaints_c', (int) ($rec['Id'] ?? 0)));
    }
    $b = lm_row('bookings_c', (int) ($row['booking_c'] ?? 0));
    if (!$b || (int) $b['Owner'] !== (int) $user->ID || $b['paymentStatus_c'] === 'Pending') {
        return 'Pick one of your bookings.';
    }
    $deal = lm_row('deals_c', (int) $b['deal_c']);
    $row['booking_c'] = (int) $b['Id'];
    $row['deal_c'] = (int) $b['deal_c'];
    $row['vendor_c'] = $deal ? (int) $deal['vendor_c'] : null;
    $row['vendorUser_c'] = $b['vendorUser_c'] ?: null;
    return lm_review_attach_photos($row, $rec, $user, null);
}

/** Photos last, once every other check has passed, so a refused review never uses up uploads. */
function lm_review_attach_photos($row, $rec, $user, $existing)
{
    if (!array_key_exists('photos_c', $rec)) {
        return $row;
    }
    $photos = lm_review_photos_resolve($rec['photos_c'], $user, $existing['photos_c'] ?? null);
    if (is_string($photos) && $photos !== '' && $photos[0] !== '[') {
        return $photos; // An error message.
    }
    $row['photos_c'] = $photos;
    return $row;
}

/** Keep a vendor's star rating in step with the reviews neighbours can see. */
function lm_vendor_rating_refresh($vendor_id)
{
    global $wpdb;
    $avg = $wpdb->get_var($wpdb->prepare('SELECT AVG(rating_c) FROM ' . lm_table('reviews_c') . ' WHERE vendor_c = %d AND (hidden_c IS NULL OR hidden_c = 0)', (int) $vendor_id));
    if ($avg !== null) {
        $wpdb->update(lm_table('vendors_c'), ['rating_c' => round((float) $avg, 1)], ['Id' => (int) $vendor_id]);
    }
}

/** Checks on a proposal from an ambassador before it's saved. Returns an error message or null. */
function lm_check_proposal($row, $op)
{
    if ($op === 'create') {
        if (trim((string) ($row['Name'] ?? '')) === '') {
            return 'Say what neighbours want.';
        }
        if (empty($row['community_c']) && trim((string) ($row['newCommunity_c'] ?? '')) === '') {
            return 'Pick the community, or name it if it isn\'t listed.';
        }
        if (($row['category_c'] ?? '') === 'Other' && trim((string) ($row['newCategory_c'] ?? '')) === '') {
            return 'Name the kind of service or product.';
        }
    }
    if (array_key_exists('Name', $row) && trim((string) $row['Name']) === '') {
        return 'Say what neighbours want.';
    }
    if (!empty($row['community_c']) && !lm_row('communities_c', (int) $row['community_c'])) {
        return 'That community isn\'t on Lotmates.';
    }
    if (array_key_exists('contactPref_c', $row) && !in_array($row['contactPref_c'], ['Email', 'Phone'], true)) {
        return 'Choose how the team should reach you.';
    }
    if (($row['contactPref_c'] ?? '') === 'Phone' && !preg_match('/^\+?[\d\s-]{10,16}$/', (string) ($row['contactPhone_c'] ?? ''))) {
        return 'Enter a 10-digit phone number, e.g. 98765 43210.';
    }
    $cat = $row['category_c'] ?? null;
    if ($cat !== null && $cat !== 'Other' && !in_array($cat, lm_category_keys(), true)) {
        return 'Pick a category.';
    }
    foreach (['Name' => 200, 'newCategory_c' => 80, 'newCommunity_c' => 120, 'newLocality_c' => 120, 'notes_c' => 2000] as $f => $max) {
        if (isset($row[$f]) && mb_strlen((string) $row[$f]) > $max) {
            return 'That text is too long.';
        }
    }
    return null;
}

function lm_run_write($table, $user, $op, $req)
{
    global $wpdb;
    $policy = null;
    if (!lm_is_admin($user) || $table === 'reviews_c') {
        $policy = lm_write_policy($table, $user, $op);
        if (!$policy) {
            return new WP_Error('lm_forbidden', $table === 'reviews_c' ? 'Only neighbours who booked and had the job done can write a review.' : 'You don\'t have access to change this.', ['status' => 403]);
        }
    }
    $fields = lm_fields($table);

    if ($policy && $op !== 'create') {
        // Every row touched must belong to this user under the policy.
        $ids = $op === 'delete'
            ? array_map('intval', (array) ($req['ids'] ?? [$req['id'] ?? 0]))
            : array_map(function ($r) { return (int) ($r['Id'] ?? 0); }, (array) ($req['records'] ?? (isset($req['record']) ? [$req['record']] : [])));
        $ids = array_values(array_filter($ids));
        if (!$ids) {
            return ['success' => true, 'data' => []];
        }
        $in = implode(',', $ids);
        $ok = (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . lm_table($table) . " WHERE Id IN ($in) AND " . $policy['own']);
        if ($ok !== count($ids)) {
            return new WP_Error('lm_forbidden', $table === 'reviews_c' ? 'You can only change your own reviews.' : 'This proposal is already with the team, so it can\'t be changed now.', ['status' => 403]);
        }
    }
    $now = gmdate('Y-m-d H:i:s');

    if ($op === 'delete') {
        $ids = array_map('intval', (array) ($req['ids'] ?? [$req['id'] ?? 0]));
        $vendors = [];
        foreach ($ids as $id) {
            if ($table === 'reviews_c' && ($rv = lm_row('reviews_c', $id))) {
                $vendors[] = (int) $rv['vendor_c'];
                lm_review_photos_purge($rv);
            }
            if ($table === 'complaints_c' && ($cp = lm_row('complaints_c', $id))) {
                lm_review_photos_purge($cp);
            }
            $wpdb->delete(lm_table($table), ['Id' => $id], ['%d']);
        }
        foreach (array_unique(array_filter($vendors)) as $v) {
            lm_vendor_rating_refresh($v);
        }
        return ['success' => true, 'data' => $ids];
    }

    $records = $req['records'] ?? (isset($req['record']) ? [$req['record']] : []);
    $done = [];
    foreach ((array) $records as $rec) {
        $row = [];
        foreach ((array) $rec as $k => $v) {
            if ($k === 'Id' || !isset($fields[$k]) || in_array($k, ['Owner', 'CreatedOn', 'ModifiedOn'], true)) {
                continue;
            }
            if ($policy && !in_array($k, $policy['fields'], true)) {
                continue;
            }
            if (in_array($table, ['reviews_c', 'complaints_c'], true) && $k === 'photos_c') {
                continue; // Resolved from upload ids by the owner's checks, never taken as sent.
            }
            $row[$k] = lm_db_value($fields[$k], $v);
        }
        if ($policy) {
            foreach ($policy['force'] as $k => $v) {
                $row[$k] = $v;
            }
            if ($table === 'proposals_c' && ($msg = lm_check_proposal($row, $op))) {
                return new WP_Error('lm_invalid', $msg, ['status' => 422]);
            }
            if ($table === 'complaints_c' && in_array(lm_profile_of($user), ['Customer_c', 'Ambassador_c'], true)) {
                $res = lm_check_complaint($row, $op, $user, $rec);
                if (is_string($res)) {
                    return new WP_Error('lm_invalid', $res, ['status' => 422]);
                }
                $row = $res;
            }
            if ($table === 'reviews_c' && !lm_is_admin($user)) {
                $res = lm_check_review($row, $op, $user, $rec);
                if (is_string($res)) {
                    return new WP_Error('lm_invalid', $res, ['status' => 422]);
                }
                $row = $res;
            }
        }
        $row['ModifiedOn'] = $now;
        if ($op === 'create') {
            $row['Owner'] = (int) $user->ID;
            $row['CreatedOn'] = $now;
            $wpdb->insert(lm_table($table), $row);
            $done[] = (int) $wpdb->insert_id;
            do_action('lm_record_changed', $table, (int) $wpdb->insert_id, null, lm_row($table, (int) $wpdb->insert_id));
            if ($table === 'reviews_c' && !empty($row['vendor_c'])) {
                lm_vendor_rating_refresh((int) $row['vendor_c']);
            }
        } else {
            $id = (int) ($rec['Id'] ?? 0);
            if ($id) {
                $before = lm_row($table, $id);
                // Note when the team last replied, so the ambassador sees how fresh the reply is.
                if ($table === 'proposals_c' && !$policy && $before
                    && ((array_key_exists('status_c', $row) && $row['status_c'] !== $before['status_c'])
                        || (array_key_exists('adminNote_c', $row) && (string) $row['adminNote_c'] !== (string) $before['adminNote_c']))) {
                    $row['repliedOn_c'] = $now;
                }
                $wpdb->update(lm_table($table), $row, ['Id' => $id]);
                $done[] = $id;
                do_action('lm_record_changed', $table, $id, $before, lm_row($table, $id));
                if ($table === 'reviews_c' && $before && $before['vendor_c']) {
                    lm_vendor_rating_refresh((int) $before['vendor_c']);
                }
            }
        }
    }
    if (!$done) {
        return ['success' => true, 'data' => []];
    }
    $res = lm_run_select($table, $user, ['where' => ['op' => 'in', 'f' => 'Id', 'v' => $done], 'size' => 200]);
    return ['success' => true, 'data' => $res['data']];
}

function lm_register_query_routes()
{
    register_rest_route('lotmates/v1', '/q', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $table = (string) $r->get_param('table');
            $op = (string) ($r->get_param('op') ?: 'fetch');
            if (!lm_fields($table)) {
                return new WP_Error('lm_table', 'Unknown table.', ['status' => 404]);
            }
            $user = wp_get_current_user();
            $req = $r->get_json_params() ?: [];
            try {
                if ($op === 'fetch') {
                    return lm_run_select($table, $user, $req);
                }
                if ($op === 'get') {
                    $res = lm_run_select($table, $user, ['id' => (int) ($req['id'] ?? 0), 'fields' => $req['fields'] ?? null, 'size' => 1]);
                    return ['success' => true, 'data' => $res['data'][0] ?? null];
                }
                if (in_array($op, ['create', 'update', 'delete'], true)) {
                    return lm_run_write($table, $user, $op, $req);
                }
            } catch (Exception $e) {
                return new WP_Error('lm_query', $e->getMessage(), ['status' => 400]);
            }
            return new WP_Error('lm_op', 'Unknown operation.', ['status' => 400]);
        },
    ]);
}
