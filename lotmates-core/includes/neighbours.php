<?php
/**
 * The team's view of neighbour accounts: who signed up, where they live, how to reach them,
 * and how much they've booked. Read-only, team only.
 */
if (!defined('ABSPATH')) {
    exit;
}

/** Paid booking counts and totals for a set of users, keyed by user id. */
function lm_booking_stats($ids)
{
    global $wpdb;
    $ids = array_values(array_filter(array_map('intval', (array) $ids)));
    if (!$ids) {
        return [];
    }
    $in = implode(',', $ids);
    $rows = $wpdb->get_results(
        'SELECT Owner, COUNT(*) AS n, COALESCE(SUM(amountPaid_c), 0) AS paid, MAX(CreatedOn) AS last
         FROM ' . lm_table('bookings_c') . " WHERE Owner IN ($in) AND paymentStatus_c IN ('Paid','Refunded') GROUP BY Owner",
        ARRAY_A
    );
    $out = [];
    foreach ($rows as $r) {
        $out[(int) $r['Owner']] = ['bookings' => (int) $r['n'], 'paid' => (float) $r['paid'], 'lastBooking' => lm_iso_utc($r['last'])];
    }
    return $out;
}

function lm_community_names($ids)
{
    global $wpdb;
    $ids = array_values(array_unique(array_filter(array_map('intval', (array) $ids))));
    if (!$ids) {
        return [];
    }
    $rows = $wpdb->get_results('SELECT c.Id, c.Name, l.Name AS locality FROM ' . lm_table('communities_c') . ' c LEFT JOIN ' . lm_table('localities_c') . ' l ON l.Id = c.locality_c WHERE c.Id IN (' . implode(',', $ids) . ')', ARRAY_A);
    $out = [];
    foreach ($rows as $r) {
        $out[(int) $r['Id']] = ['Id' => (string) $r['Id'], 'Name' => $r['Name'], 'locality' => $r['locality']];
    }
    return $out;
}

function lm_neighbour_payload($u, $stats, $communities)
{
    $cid = (int) get_user_meta($u->ID, 'lm_community', true);
    $s = $stats[(int) $u->ID] ?? ['bookings' => 0, 'paid' => 0, 'lastBooking' => null];
    return [
        'id' => (string) $u->ID,
        'name' => trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name,
        'email' => $u->user_email,
        'phone' => (string) get_user_meta($u->ID, 'lm_phone', true),
        'address' => (string) get_user_meta($u->ID, 'lm_address', true),
        'community' => $cid ? ($communities[$cid] ?? null) : null,
        'profile' => lm_profile_of($u),
        'joined' => lm_iso_utc($u->user_registered),
        'avatar' => lm_avatar_url($u),
        'gravatar' => lm_gravatar_url($u),
        'deletionRequested' => (string) get_user_meta($u->ID, 'lm_delete_requested', true) ?: null,
        'bookings' => $s['bookings'],
        'paid' => $s['paid'],
        'lastBooking' => $s['lastBooking'],
    ];
}

function lm_register_neighbour_routes()
{
    $ns = 'lotmates/v1';
    $admin = function () {
        return lm_is_admin(wp_get_current_user()) ? true : new WP_Error('lm_forbidden', 'Only the Lotmates team can see neighbours.', ['status' => 403]);
    };

    register_rest_route($ns, '/neighbours', [
        'methods' => 'GET',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) {
            global $wpdb;
            $size = 25;
            $page = max(1, (int) $r->get_param('page'));
            $search = trim(sanitize_text_field((string) $r->get_param('search')));
            $community = (int) $r->get_param('community');
            $sort = (string) $r->get_param('sort');
            $booked = (string) $r->get_param('booked');

            $args = ['role' => 'lm_customer', 'fields' => 'all'];
            $meta = [];
            if ($community) {
                $meta[] = ['key' => 'lm_community', 'value' => (string) $community];
            }
            $ids_filter = null;
            if ($search !== '') {
                // Name, email or phone. WP_User_Query can't OR a column search with meta, so collect ids.
                $like = '%' . $wpdb->esc_like($search) . '%';
                $digits = preg_replace('/\D/', '', $search);
                $ids = $wpdb->get_col($wpdb->prepare(
                    "SELECT ID FROM {$wpdb->users} WHERE user_email LIKE %s OR display_name LIKE %s",
                    $like,
                    $like
                ));
                $ids = array_merge($ids, $wpdb->get_col($wpdb->prepare(
                    "SELECT user_id FROM {$wpdb->usermeta} WHERE (meta_key IN ('first_name','last_name') AND meta_value LIKE %s)"
                    . (strlen($digits) >= 3 ? " OR (meta_key = 'lm_phone' AND REPLACE(REPLACE(meta_value,' ',''),'-','') LIKE %s)" : ''),
                    ...(strlen($digits) >= 3 ? [$like, '%' . $digits . '%'] : [$like])
                )));
                $ids_filter = array_map('intval', array_unique($ids)) ?: [0];
            }
            if ($booked === 'yes' || $booked === 'no') {
                $with = array_map('intval', $wpdb->get_col('SELECT DISTINCT Owner FROM ' . lm_table('bookings_c') . " WHERE paymentStatus_c IN ('Paid','Refunded')"));
                if ($booked === 'yes') {
                    $ids_filter = $ids_filter === null ? ($with ?: [0]) : (array_values(array_intersect($ids_filter, $with)) ?: [0]);
                } else {
                    $args['exclude'] = $with;
                }
            }
            if ($ids_filter !== null) {
                $args['include'] = $ids_filter;
            }
            if ($meta) {
                $args['meta_query'] = $meta;
            }

            if ($sort === 'bookings') {
                // Order by paid bookings: fetch all matching ids, sort in PHP, then page.
                $all = get_users(array_merge($args, ['fields' => 'ID']));
                $stats = lm_booking_stats($all);
                usort($all, function ($a, $b) use ($stats) {
                    return ($stats[(int) $b]['bookings'] ?? 0) <=> ($stats[(int) $a]['bookings'] ?? 0) ?: ((int) $b <=> (int) $a);
                });
                $total = count($all);
                $page_ids = array_slice($all, ($page - 1) * $size, $size);
                $users = $page_ids ? get_users(['include' => $page_ids, 'orderby' => 'include']) : [];
            } else {
                $q = new WP_User_Query($args + [
                    'orderby' => $sort === 'name' ? 'display_name' : 'registered',
                    'order' => $sort === 'name' ? 'ASC' : ($sort === 'oldest' ? 'ASC' : 'DESC'),
                    'number' => $size,
                    'paged' => $page,
                    'count_total' => true,
                ]);
                $users = $q->get_results();
                $total = (int) $q->get_total();
            }

            $stats = lm_booking_stats(array_map(fn($u) => $u->ID, $users));
            $communities = lm_community_names(array_map(fn($u) => (int) get_user_meta($u->ID, 'lm_community', true), $users));

            // Headline numbers for the whole neighbour base, not just this page.
            $all_count = (int) (new WP_User_Query(['role' => 'lm_customer', 'number' => 1, 'count_total' => true, 'fields' => 'ID']))->get_total();
            $month = (int) (new WP_User_Query(['role' => 'lm_customer', 'number' => 1, 'count_total' => true, 'fields' => 'ID', 'date_query' => [['after' => gmdate('Y-m-01 00:00:00', time() + 19800), 'inclusive' => true]]]))->get_total();
            $bookers = (int) $wpdb->get_var(
                'SELECT COUNT(DISTINCT b.Owner) FROM ' . lm_table('bookings_c') . " b JOIN {$wpdb->usermeta} m ON m.user_id = b.Owner AND m.meta_key = '{$wpdb->prefix}capabilities' AND m.meta_value LIKE '%lm_customer%' WHERE b.paymentStatus_c IN ('Paid','Refunded')"
            );

            return [
                'data' => array_map(fn($u) => lm_neighbour_payload($u, $stats, $communities), $users),
                'total' => $total,
                'page' => $page,
                'size' => $size,
                'summary' => ['all' => $all_count, 'thisMonth' => $month, 'booked' => $bookers],
            ];
        },
    ]);

    register_rest_route($ns, '/neighbours/(?P<id>\d+)', [
        'methods' => 'GET',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) {
            $u = get_user_by('id', (int) $r['id']);
            if (!$u) {
                return new WP_Error('lm_missing', 'Neighbour not found.', ['status' => 404]);
            }
            $stats = lm_booking_stats([$u->ID]);
            $communities = lm_community_names([(int) get_user_meta($u->ID, 'lm_community', true)]);
            return ['data' => lm_neighbour_payload($u, $stats, $communities)];
        },
    ]);

    // Does this email already have a Lotmates account? Used on ambassador applications.
    register_rest_route($ns, '/accounts/lookup', [
        'methods' => 'GET',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) {
            $email = strtolower(sanitize_email((string) $r->get_param('email')));
            $u = $email ? get_user_by('email', $email) : null;
            if (!$u) {
                return ['data' => null];
            }
            $stats = lm_booking_stats([$u->ID]);
            $communities = lm_community_names([(int) get_user_meta($u->ID, 'lm_community', true)]);
            return ['data' => lm_neighbour_payload($u, $stats, $communities)];
        },
    ]);
}
