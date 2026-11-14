<?php
/**
 * Counts and money for the team's Today page, worked out in one place from the bookings
 * themselves, so every screen tells the same story.
 */

/** Homes really booked on a deal: paid bookings that are still on (or went through a failed close). */
function lm_deal_real_homes($deal_id)
{
    global $wpdb;
    return (int) $wpdb->get_var($wpdb->prepare(
        'SELECT COALESCE(SUM(homes_c), 0) FROM ' . lm_table('bookings_c') . "
         WHERE deal_c = %d AND paymentStatus_c IN ('Paid','Refunded') AND status_c IN ('Booked','Confirmed','Done','Failed')",
        $deal_id
    ));
}

/**
 * Bring a deal's booked count back in line with its bookings. A price reached normally stays reached
 * (a cancellation doesn't raise the price again). $reset_tier is only for the one-off clean-up of
 * hand-seeded demo counts: an open deal's tier then follows the real count. Closed deals keep their
 * tier, because their prices were already settled.
 */
function lm_deal_recount($deal_id, $reset_tier = false)
{
    global $wpdb;
    $deal = lm_row('deals_c', (int) $deal_id);
    if (!$deal) {
        return;
    }
    $real = lm_deal_real_homes((int) $deal_id);
    $upd = [];
    if ((int) $deal['bookedHomes_c'] !== $real) {
        $upd['bookedHomes_c'] = $real;
    }
    if (in_array($deal['status_c'], ['Live', 'Draft', 'Awaiting vendor', 'Awaiting team', 'Changes requested', 'Approved'], true)) {
        $tier = max(1, lm_tier_for(lm_tiers($deal), $real));
        if (!$reset_tier) {
            $tier = max($tier, (int) $deal['unlockedTier_c']);
        }
        if ((int) $deal['unlockedTier_c'] !== $tier) {
            $upd['unlockedTier_c'] = $tier;
        }
    }
    if ($upd) {
        $wpdb->update(lm_table('deals_c'), $upd, ['Id' => (int) $deal_id]);
    }
}

function lm_recount_all_deals($reset_tier = false)
{
    global $wpdb;
    foreach ($wpdb->get_col('SELECT Id FROM ' . lm_table('deals_c')) as $id) {
        lm_deal_recount((int) $id, $reset_tier);
    }
}

function lm_route_admin_stats()
{
    global $wpdb;
    if (!lm_is_admin(wp_get_current_user())) {
        return lm_err('Only the team can see this.', 403);
    }
    $b = lm_table('bookings_c');
    $d = lm_table('deals_c');
    $p = lm_table('payouts_c');
    $tz = new DateTimeZone('Asia/Kolkata');
    $monday = (new DateTimeImmutable('monday this week', $tz))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $num = fn ($sql) => (float) $wpdb->get_var($sql);

    $deals = $wpdb->get_row("SELECT
        SUM(status_c = 'Live') AS live,
        SUM(status_c IN ('Draft','Awaiting vendor','Awaiting team','Changes requested','Approved')) AS preparing
        FROM $d", ARRAY_A);
    $paid_in = $num("SELECT COALESCE(SUM(amountPaid_c),0) FROM $b WHERE paymentStatus_c IN ('Paid','Refunded')");
    $refunded = $num("SELECT COALESCE(SUM(refundDue_c),0) FROM $b WHERE refundStatus_c = 'Paid'");
    $due = $num("SELECT COALESCE(SUM(refundDue_c),0) FROM $b WHERE refundStatus_c = 'Due'");
    $due_count = (int) $num("SELECT COUNT(*) FROM $b WHERE refundStatus_c = 'Due'");
    // Money on bookings whose deal hasn't closed: it can still go back if the deal fails or the price drops.
    $open = $num("SELECT COALESCE(SUM(amountPaid_c - IF(refundStatus_c = 'Paid', refundDue_c, 0)),0) FROM $b WHERE paymentStatus_c = 'Paid' AND status_c = 'Booked'");
    // Earned: deals that went ahead, at the final price, at each deal's rate.
    $earned = $num("SELECT COALESCE(SUM(bk.finalPrice_c * bk.homes_c * COALESCE(dl.commission_c,0) / 100),0)
        FROM $b bk JOIN $d dl ON dl.Id = bk.deal_c WHERE bk.status_c IN ('Confirmed','Done') AND bk.finalPrice_c IS NOT NULL");
    $week = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $b WHERE paymentStatus_c IN ('Paid','Refunded') AND CreatedOn >= %s", $monday));

    // Vendors owed: each deal that went ahead, its value less commission, less payouts already recorded for it.
    $owed = $wpdb->get_results("SELECT dl.Id, dl.Name,
            SUM(bk.finalPrice_c * bk.homes_c) * (1 - COALESCE(dl.commission_c,0) / 100) AS net,
            (SELECT COALESCE(SUM(po.net_c),0) FROM $p po WHERE po.deal_c = dl.Id) AS recorded
        FROM $d dl JOIN $b bk ON bk.deal_c = dl.Id AND bk.status_c IN ('Confirmed','Done') AND bk.finalPrice_c IS NOT NULL
        WHERE dl.status_c = 'Closed' GROUP BY dl.Id, dl.Name, dl.commission_c", ARRAY_A);
    $to_set_up = [];
    foreach ((array) $owed as $o) {
        $left = round((float) $o['net'] - (float) $o['recorded'], 2);
        if ($left >= 1) {
            $to_set_up[] = ['dealId' => (int) $o['Id'], 'deal' => $o['Name'], 'amount' => $left];
        }
    }
    $pending = $num("SELECT COALESCE(SUM(net_c),0) FROM $p WHERE status_c = 'Pending'");

    return lm_ok([
        'live' => (int) ($deals['live'] ?? 0),
        'preparing' => (int) ($deals['preparing'] ?? 0),
        'week' => $week,
        'paidIn' => round($paid_in, 2),
        'refunded' => round($refunded, 2),
        'kept' => round($paid_in - $refunded, 2),
        'onOpenDeals' => round($open, 2),
        'commissionEarned' => round($earned, 2),
        'refundsDue' => round($due, 2),
        'refundsDueCount' => $due_count,
        'payoutsPending' => round($pending, 2),
        'payoutsToSetUp' => $to_set_up,
    ]);
}

function lm_register_stats_routes()
{
    register_rest_route('lotmates/v1', '/admin/stats', ['methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'lm_route_admin_stats']);
}
