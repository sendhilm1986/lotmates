<?php
if (!defined('ABSPATH')) {
    exit;
}

/*
 * Payments through Razorpay. The server sets every amount; the browser only opens checkout.
 * Flow: create order (pending booking) -> Razorpay checkout -> verify signature -> booking paid
 * and the deal counter moves. A webhook finishes the same booking if the browser closes early.
 */

// ---------- Settings (site owner only, in wp-admin) ----------

add_action('admin_menu', function () {
    add_options_page('Lotmates payments', 'Lotmates payments', 'manage_options', 'lotmates-payments', 'lm_settings_page');
});

function lm_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $msg = '';
    if (isset($_POST['lm_save']) && check_admin_referer('lm_payments')) {
        $id = sanitize_text_field(wp_unslash($_POST['key_id'] ?? ''));
        $secret = sanitize_text_field(wp_unslash($_POST['key_secret'] ?? ''));
        $hook = sanitize_text_field(wp_unslash($_POST['webhook_secret'] ?? ''));
        if ($id !== '' && strpos($id, 'rzp_test_') !== 0) {
            $msg = 'Only Razorpay test keys (rzp_test_…) are accepted for now.';
        } else {
            update_option('lm_rzp_key_id', $id, false);
            if ($secret !== '') {
                update_option('lm_rzp_key_secret', $secret, false);
            }
            if ($hook !== '') {
                update_option('lm_rzp_webhook_secret', $hook, false);
            }
            $msg = 'Saved.';
        }
    }
    $id = get_option('lm_rzp_key_id', '');
    $has_secret = (bool) get_option('lm_rzp_key_secret', '');
    $has_hook = (bool) get_option('lm_rzp_webhook_secret', '');
    $webhook = rest_url('lotmates/v1/razorpay/webhook');
    echo '<div class="wrap"><h1>Lotmates payments</h1>';
    if ($msg) {
        echo '<div class="notice notice-info"><p>' . esc_html($msg) . '</p></div>';
    }
    echo '<form method="post">';
    wp_nonce_field('lm_payments');
    echo '<table class="form-table"><tr><th>Razorpay key id</th><td><input name="key_id" class="regular-text" value="' . esc_attr($id) . '" placeholder="rzp_test_…"></td></tr>';
    echo '<tr><th>Razorpay key secret</th><td><input name="key_secret" type="password" class="regular-text" autocomplete="off" placeholder="' . ($has_secret ? 'Saved. Enter a new one to replace it.' : '') . '"></td></tr>';
    echo '<tr><th>Webhook secret</th><td><input name="webhook_secret" type="password" class="regular-text" autocomplete="off" placeholder="' . ($has_hook ? 'Saved. Enter a new one to replace it.' : 'Optional') . '">';
    echo '<p class="description">In Razorpay, add a webhook to <code>' . esc_html($webhook) . '</code> for the payment.captured event, with this secret.</p></td></tr></table>';
    echo '<p><button class="button button-primary" name="lm_save" value="1">Save</button></p></form></div>';
}

// ---------- Razorpay API ----------

function lm_rzp_keys()
{
    $id = (string) get_option('lm_rzp_key_id', '');
    $secret = (string) get_option('lm_rzp_key_secret', '');
    if ($id === '' || $secret === '') {
        return null;
    }
    return [$id, $secret];
}

function lm_rzp($method, $path, $body = null)
{
    $keys = lm_rzp_keys();
    if (!$keys) {
        return new WP_Error('lm_no_keys', 'Payments aren\'t switched on yet. Try again soon.', ['status' => 503]);
    }
    $res = wp_remote_request('https://api.razorpay.com/v1' . $path, [
        'method' => $method,
        'timeout' => 20,
        'headers' => [
            'Authorization' => 'Basic ' . base64_encode($keys[0] . ':' . $keys[1]),
            'Content-Type' => 'application/json',
        ],
        'body' => $body === null ? null : wp_json_encode($body),
    ]);
    if (is_wp_error($res)) {
        return new WP_Error('lm_rzp_down', 'Couldn\'t reach Razorpay. Try again.', ['status' => 502]);
    }
    $data = json_decode(wp_remote_retrieve_body($res), true) ?: [];
    $code = wp_remote_retrieve_response_code($res);
    if ($code < 200 || $code >= 300) {
        $why = $data['error']['description'] ?? 'Razorpay declined the request.';
        return new WP_Error('lm_rzp', $why, ['status' => 502]);
    }
    return $data;
}

// ---------- Deal maths (same rules as the front end) ----------

function lm_tiers($deal)
{
    $tiers = [];
    $from = 1;
    for ($i = 1; $i <= 4; $i++) {
        $max = $deal['tier' . $i . 'Max_c'] ?? null;
        $price = $deal['tier' . $i . 'Price_c'] ?? null;
        if ($max === null || $price === null) {
            break;
        }
        $tiers[] = ['n' => $i, 'from' => $from, 'to' => (int) $max, 'price' => (float) $price];
        $from = (int) $max + 1;
    }
    return $tiers;
}

function lm_tier_for($tiers, $count)
{
    if (!$tiers) {
        return 0;
    }
    if ($count <= 0) {
        return 1;
    }
    foreach ($tiers as $i => $t) {
        if ($count <= $t['to']) {
            return $i + 1;
        }
    }
    return count($tiers);
}

function lm_deal_state($deal)
{
    $tiers = lm_tiers($deal);
    $booked = (int) ($deal['bookedHomes_c'] ?? 0);
    $reached = min(max(1, count($tiers)), max((int) ($deal['unlockedTier_c'] ?: 1), lm_tier_for($tiers, $booked)));
    $current = $tiers[$reached - 1] ?? ($tiers[0] ?? null);
    $min = (int) ($deal['minHomes_c'] ?? 0);
    $cap = (int) ($deal['capacity_c'] ?? 0);
    return [
        'tiers' => $tiers,
        'booked' => $booked,
        'reached' => $reached,
        'current' => $current,
        'tier1' => $tiers[0] ?? null,
        'unlocked' => $min > 0 ? $booked >= $min : $booked > 0,
        'cap' => $cap,
        'remaining' => $cap > 0 ? max(0, $cap - $booked) : 999,
    ];
}

function lm_row($table, $id)
{
    global $wpdb;
    return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . lm_table($table) . ' WHERE Id = %d', $id), ARRAY_A);
}

function lm_deal_open($deal)
{
    return $deal && $deal['status_c'] === 'Live' && strtotime($deal['deadline_c'] . ' UTC') > time();
}

function lm_ok($data)
{
    return ['success' => true, 'data' => $data];
}

function lm_err($message, $status = 400)
{
    return new WP_Error('lm_fn', $message, ['status' => $status]);
}

// ---------- Booking ----------

function lm_fn_create_order(WP_REST_Request $r)
{
    global $wpdb;
    $user = wp_get_current_user();
    if (!$user->ID || !in_array(lm_profile_of($user), ['Customer_c', 'Ambassador_c'], true)) {
        return lm_err('Sign in with a neighbour account to book.', 403);
    }
    $p = $r->get_json_params() ?: [];
    $deal = lm_row('deals_c', (int) ($p['dealId'] ?? 0));
    if (!lm_deal_open($deal)) {
        return lm_err('This deal is not taking bookings.');
    }
    // One booking per home unless the deal allows more.
    if ((int) $deal['allowRepeat_c'] !== 1) {
        $has = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . lm_table('bookings_c') . " WHERE deal_c = %d AND Owner = %d AND paymentStatus_c = 'Paid' AND status_c IN ('Booked','Confirmed','Done')",
            $deal['Id'], $user->ID
        ));
        if ($has) {
            return lm_err('You\'ve already booked this deal. Open your booking to see it.', 409);
        }
    }
    $st = lm_deal_state($deal);
    $homes = (int) ($p['homes'] ?? 1);
    $max = max(1, min(10, $st['remaining']));
    if ($homes < 1 || $homes > $max || $st['remaining'] <= 0) {
        return lm_err($st['remaining'] <= 0 ? 'Every place in this round is booked.' : "Choose between 1 and $max.");
    }
    $community = lm_row('communities_c', (int) ($p['communityId'] ?? 0));
    $fits = $community && ($deal['community_c']
        ? (int) $deal['community_c'] === (int) $community['Id']
        : (int) $deal['locality_c'] === (int) $community['locality_c']);
    if (!$fits) {
        return lm_err('Pick a community this deal covers.');
    }
    $address = sanitize_text_field((string) ($p['address'] ?? ''));
    $phone = sanitize_text_field((string) ($p['phone'] ?? ''));
    if ($address === '' || strlen($address) > 300) {
        return lm_err(lm_deal_fulfilment($deal) === 'delivery' ? 'Add the address to deliver to.' : 'Add the address where the service happens.');
    }
    if (!preg_match('/^[+\d][\d\s-]{8,20}$/', $phone)) {
        return lm_err('Add a phone number we can reach.');
    }
    // Only ask for what this deal schedules: nothing, a day, or a day and a time slot.
    $mode = lm_deal_schedule($deal);
    $date = null;
    $slot = null;
    if ($mode !== 'none' && !empty($p['preferredDate'])) {
        $date = gmdate('Y-m-d', strtotime((string) $p['preferredDate']));
        if (($deal['serviceStart_c'] && $date < $deal['serviceStart_c']) || ($deal['serviceEnd_c'] && $date > $deal['serviceEnd_c'])) {
            return lm_err('Pick a date inside the service window.');
        }
    }
    $cap = lm_slot_capacity($deal);
    if ($cap && !$date) {
        return lm_err($mode === 'datetime' ? 'Pick a day and a time slot.' : 'Pick a day.');
    }
    if ($mode === 'datetime' && $date) {
        $slot = sanitize_text_field((string) ($p['preferredSlot'] ?? ''));
        if ($slot === '') {
            return lm_err('Pick a time slot for that day.');
        }
        if (!in_array($slot, lm_deal_slots($deal), true)) {
            return lm_err('Pick one of the time slots shown.');
        }
    }
    // Hold a lock while checking and saving, so two people can't take the last place together.
    $lock = null;
    if ($cap) {
        $lock = 'lm_slots_' . (int) $deal['Id'];
        $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 8)', $lock));
        $taken = lm_units_taken(lm_slot_usage((int) $deal['Id']), $date, (string) $slot, $mode);
        if ($taken + $homes > $cap) {
            $wpdb->query($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
            $left = max(0, $cap - $taken);
            $what = $mode === 'datetime' ? 'That time slot' : 'That day';
            return lm_err($left ? "$what only has room for $left more. Lower the quantity or pick another." : "$what is fully booked. Pick another.", 409);
        }
    }
    $unit = (float) ($st['tier1']['price'] ?? 0);
    $amount = (int) round($unit * $homes * 100);
    if ($amount < 100) {
        return lm_err('This deal has no price yet.');
    }
    $vendor = $deal['vendor_c'] ? lm_row('vendors_c', (int) $deal['vendor_c']) : null;
    $ref = 'LM-' . strtoupper(wp_generate_password(6, false));
    $now = gmdate('Y-m-d H:i:s');

    $order = lm_rzp('POST', '/orders', [
        'amount' => $amount,
        'currency' => 'INR',
        'receipt' => $ref,
        'notes' => ['deal' => mb_substr($deal['Name'], 0, 100), 'booking' => $ref, 'homes' => (string) $homes],
    ]);
    if (is_wp_error($order)) {
        if ($lock) {
            $wpdb->query($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        }
        return $order;
    }
    $wpdb->insert(lm_table('bookings_c'), [
        'Name' => $ref,
        'Owner' => $user->ID,
        'CreatedOn' => $now,
        'ModifiedOn' => $now,
        'deal_c' => (int) $deal['Id'],
        'community_c' => (int) $community['Id'],
        'homes_c' => $homes,
        'unitPrice_c' => $unit,
        'amountPaid_c' => $unit * $homes,
        'refundDue_c' => 0,
        'refundStatus_c' => 'None',
        'paymentStatus_c' => 'Pending',
        'orderRef_c' => $order['id'],
        'status_c' => 'Booked',
        'preferredDate_c' => $date,
        'preferredSlot_c' => $slot,
        'address_c' => $address,
        'phone_c' => $phone,
        'notes_c' => sanitize_textarea_field(mb_substr((string) ($p['notes'] ?? ''), 0, 1000)) ?: null,
        'vendorUser_c' => $vendor['user_c'] ?? null,
        // An ambassador booking for their own home doesn't earn commission on it.
        'ambassador_c' => !empty($community['ambassadorUser_c']) && (int) $community['ambassadorUser_c'] !== (int) $user->ID ? $community['ambassadorUser_c'] : null,
    ]);
    if ($lock) {
        $wpdb->query($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
    }
    $keys = lm_rzp_keys();
    return lm_ok([
        'orderId' => $order['id'],
        'amount' => $order['amount'],
        'currency' => $order['currency'],
        'keyId' => $keys[0],
        'bookingId' => (int) $wpdb->insert_id,
    ]);
}

/** Mark a pending booking paid and move the deal on. Safe to call twice. */
function lm_finalize_booking($order_id, $payment_id)
{
    global $wpdb;
    $bt = lm_table('bookings_c');
    // Claim the booking atomically so the browser and the webhook can't both count it.
    $claimed = $wpdb->query($wpdb->prepare(
        "UPDATE $bt SET paymentStatus_c = 'Paid', paymentRef_c = %s, ModifiedOn = %s WHERE orderRef_c = %s AND paymentStatus_c = 'Pending'",
        $payment_id, gmdate('Y-m-d H:i:s'), $order_id
    ));
    $booking = $wpdb->get_row($wpdb->prepare("SELECT * FROM $bt WHERE orderRef_c = %s", $order_id), ARRAY_A);
    if (!$booking) {
        return null;
    }
    if ($claimed) {
        $dt = lm_table('deals_c');
        $homes = (int) $booking['homes_c'];
        $wpdb->query($wpdb->prepare("UPDATE $dt SET bookedHomes_c = COALESCE(bookedHomes_c,0) + %d WHERE Id = %d", $homes, $booking['deal_c']));
        $deal = lm_row('deals_c', (int) $booking['deal_c']);
        $tier = max((int) ($deal['unlockedTier_c'] ?: 1), lm_tier_for(lm_tiers($deal), (int) $deal['bookedHomes_c']));
        $wpdb->update($dt, ['unlockedTier_c' => $tier], ['Id' => $deal['Id']]);
        // Over capacity because of a race: refund in full straight away.
        $cap = (int) $deal['capacity_c'];
        if ($cap > 0 && (int) $deal['bookedHomes_c'] > $cap) {
            $wpdb->query($wpdb->prepare("UPDATE $dt SET bookedHomes_c = GREATEST(0, bookedHomes_c - %d) WHERE Id = %d", $homes, $deal['Id']));
            $wpdb->update($bt, ['status_c' => 'Cancelled', 'refundDue_c' => $booking['amountPaid_c'], 'refundStatus_c' => 'Due'], ['Id' => $booking['Id']]);
            lm_send_refund((int) $booking['Id'], 'Round was full', false);
            do_action('lm_booking_cancelled', (int) $booking['Id']);
        }
        if (($wpdb->get_var($wpdb->prepare("SELECT status_c FROM $bt WHERE Id = %d", $booking['Id'])) ?? '') !== 'Cancelled') {
            do_action('lm_booking_paid', (int) $booking['Id']);
        }
    }
    return (int) $booking['Id'];
}

/**
 * Ask Razorpay what happened to an order. Captures an authorised payment if needed,
 * then finalises the booking. This is the source of truth; the browser only nudges it.
 */
function lm_reconcile_order($order_id)
{
    $list = lm_rzp('GET', '/orders/' . rawurlencode($order_id) . '/payments');
    if (is_wp_error($list)) {
        return ['ok' => false, 'why' => $list->get_error_message()];
    }
    foreach ((array) ($list['items'] ?? []) as $p) {
        $status = $p['status'] ?? '';
        if ($status === 'authorized') {
            $cap = lm_rzp('POST', '/payments/' . rawurlencode($p['id']) . '/capture', ['amount' => (int) $p['amount'], 'currency' => $p['currency'] ?? 'INR']);
            if (is_wp_error($cap)) {
                return ['ok' => false, 'why' => 'capture failed: ' . $cap->get_error_message()];
            }
            $status = 'captured';
        }
        if ($status === 'captured') {
            $id = lm_finalize_booking($order_id, $p['id']);
            return ['ok' => (bool) $id, 'id' => $id, 'why' => $id ? 'paid' : 'no booking for order'];
        }
    }
    return ['ok' => false, 'why' => 'no captured payment yet'];
}

function lm_fn_verify(WP_REST_Request $r)
{
    $user = wp_get_current_user();
    $p = $r->get_json_params() ?: [];
    $order = (string) ($p['orderId'] ?? '');
    $payment = (string) ($p['paymentId'] ?? '');
    $sig = (string) ($p['signature'] ?? '');
    $keys = lm_rzp_keys();
    $log = function ($why) {
        $l = (array) get_option('lm_diag_log', []);
        $l[] = gmdate('c') . ' verify: ' . $why;
        update_option('lm_diag_log', array_slice($l, -10), false);
    };
    if (!$user->ID || !$keys || !$order || !$payment || !$sig) {
        $log('missing ' . (!$user->ID ? 'user ' : '') . (!$keys ? 'keys ' : '') . (!$order ? 'order ' : '') . (!$payment ? 'payment ' : '') . (!$sig ? 'sig' : ''));
        return lm_ok(['valid' => false]);
    }
    global $wpdb;
    $owner = (int) $wpdb->get_var($wpdb->prepare('SELECT Owner FROM ' . lm_table('bookings_c') . ' WHERE orderRef_c = %s', $order));
    if ($owner !== (int) $user->ID) {
        $log('owner mismatch');
        return lm_ok(['valid' => false]);
    }
    // The browser's signature is checked, but Razorpay's own record decides.
    if (!hash_equals(hash_hmac('sha256', $order . '|' . $payment, $keys[1]), $sig)) {
        $log('signature mismatch, checking with Razorpay');
    }
    $rec = lm_reconcile_order($order);
    $id = $rec['id'] ?? null;
    $log($rec['why']);
    return lm_ok(['valid' => (bool) $id, 'bookingId' => $id]);
}

// ---------- Refunds, cancellation and closing ----------

/** Send what is due on one booking back through Razorpay. Leaves it Due if Razorpay says no. */
function lm_send_refund($booking_id, $reason = 'Lotmates refund', $notify = true)
{
    global $wpdb;
    $b = lm_row('bookings_c', $booking_id);
    if (!$b || $b['refundStatus_c'] !== 'Due' || (float) $b['refundDue_c'] <= 0) {
        return false;
    }
    $paise = (int) round((float) $b['refundDue_c'] * 100);
    $paid = (int) round((float) $b['amountPaid_c'] * 100);
    if (strpos((string) $b['paymentRef_c'], 'pay_') !== 0 || $paise < 100 || $paise > $paid) {
        return false;
    }
    $res = lm_rzp('POST', '/payments/' . rawurlencode($b['paymentRef_c']) . '/refund', [
        'amount' => $paise,
        'speed' => 'normal',
        'notes' => ['reason' => mb_substr($reason, 0, 200), 'booking' => $b['Name']],
    ]);
    if (is_wp_error($res)) {
        return false;
    }
    $full = in_array($b['status_c'], ['Failed', 'Cancelled'], true);
    $wpdb->update(lm_table('bookings_c'), [
        'refundStatus_c' => 'Paid',
        'refundRef_c' => $res['id'] ?? null,
        'paymentStatus_c' => $full ? 'Refunded' : 'Paid',
        'ModifiedOn' => gmdate('Y-m-d H:i:s'),
    ], ['Id' => $b['Id']]);
    // Refunds sent with a close or a cancellation are covered by that email.
    if ($notify) {
        do_action('lm_refund_sent', (int) $b['Id']);
    }
    return true;
}

function lm_fn_cancel(WP_REST_Request $r)
{
    global $wpdb;
    $user = wp_get_current_user();
    $p = $r->get_json_params() ?: [];
    $b = lm_row('bookings_c', (int) ($p['bookingId'] ?? 0));
    if (!$user->ID || !$b || ((int) $b['Owner'] !== (int) $user->ID && !lm_is_admin($user))) {
        return lm_err('Booking not found.', 404);
    }
    $deal = lm_row('deals_c', (int) $b['deal_c']);
    if ($b['status_c'] !== 'Booked' || $b['paymentStatus_c'] !== 'Paid' || !lm_deal_open($deal)) {
        return lm_err('This booking can no longer be cancelled.');
    }
    $wpdb->update(lm_table('bookings_c'), [
        'status_c' => 'Cancelled',
        'refundDue_c' => $b['amountPaid_c'],
        'refundStatus_c' => 'Due',
        'ModifiedOn' => gmdate('Y-m-d H:i:s'),
    ], ['Id' => $b['Id']]);
    // A price reached stays reached: only the count goes down.
    $wpdb->query($wpdb->prepare('UPDATE ' . lm_table('deals_c') . ' SET bookedHomes_c = GREATEST(0, COALESCE(bookedHomes_c,0) - %d) WHERE Id = %d', (int) $b['homes_c'], $deal['Id']));
    $refunded = lm_send_refund((int) $b['Id'], 'Cancelled booking ' . $b['Name'], false);
    do_action('lm_booking_cancelled', (int) $b['Id']);
    return lm_ok(['refunded' => $refunded]);
}

/** Close a deal: confirm or fail every paid booking, then send the refunds. */
function lm_close_deal($deal_id)
{
    global $wpdb;
    $deal = lm_row('deals_c', $deal_id);
    if (!$deal || $deal['status_c'] !== 'Live') {
        return null;
    }
    $st = lm_deal_state($deal);
    $final = $st['current']['price'] ?? null;
    $bt = lm_table('bookings_c');
    $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $bt WHERE deal_c = %d AND status_c = 'Booked' AND paymentStatus_c = 'Paid'", $deal_id), ARRAY_A);
    $total = 0;
    foreach ($rows as $b) {
        $homes = (int) ($b['homes_c'] ?: 1);
        if ($st['unlocked']) {
            $refund = max(0, ((float) $b['unitPrice_c'] - (float) $final) * $homes);
            $upd = ['status_c' => 'Confirmed', 'finalPrice_c' => $final, 'refundDue_c' => $refund, 'refundStatus_c' => $refund > 0 ? 'Due' : 'None'];
        } else {
            $refund = (float) $b['amountPaid_c'];
            $upd = ['status_c' => 'Failed', 'finalPrice_c' => null, 'refundDue_c' => $refund, 'refundStatus_c' => 'Due'];
        }
        $upd['ModifiedOn'] = gmdate('Y-m-d H:i:s');
        $wpdb->update($bt, $upd, ['Id' => $b['Id']]);
        $total += $refund;
    }
    $wpdb->update(lm_table('deals_c'), [
        'status_c' => $st['unlocked'] ? 'Closed' : 'Failed',
        'unlockedTier_c' => $st['reached'],
        'ModifiedOn' => gmdate('Y-m-d H:i:s'),
    ], ['Id' => $deal_id]);
    $sent = lm_send_due_refunds($deal_id, $deal['Name'], false);
    // Invoices for a deal that went ahead, refund notes for one that didn't.
    lm_queue_close_emails($deal_id, $st['unlocked']);
    lm_drain_mail_queue(20);
    $result = ['unlocked' => $st['unlocked'], 'finalPrice' => $final, 'totalRefund' => $total, 'refundsSent' => $sent];
    do_action('lm_deal_closed', (int) $deal_id, $result);
    return $result;
}

function lm_send_due_refunds($deal_id, $deal_name, $notify = true)
{
    global $wpdb;
    $ids = $wpdb->get_col($wpdb->prepare('SELECT Id FROM ' . lm_table('bookings_c') . " WHERE deal_c = %d AND refundStatus_c = 'Due'", $deal_id));
    $sent = 0;
    foreach ($ids as $id) {
        if (lm_send_refund((int) $id, $deal_name . ': refund', $notify)) {
            $sent++;
        }
    }
    return $sent;
}

// Every hour: close deals past their deadline and tidy up abandoned checkouts.
add_action('lm_hourly', function () {
    global $wpdb;
    $ids = $wpdb->get_col('SELECT Id FROM ' . lm_table('deals_c') . " WHERE status_c = 'Live' AND deadline_c < UTC_TIMESTAMP()");
    foreach ($ids as $id) {
        lm_close_deal((int) $id);
    }
    $pending = $wpdb->get_col('SELECT orderRef_c FROM ' . lm_table('bookings_c') . " WHERE paymentStatus_c = 'Pending' AND orderRef_c IS NOT NULL");
    foreach ($pending as $order) {
        lm_reconcile_order($order);
    }
    $wpdb->query('DELETE FROM ' . lm_table('bookings_c') . " WHERE paymentStatus_c = 'Pending' AND CreatedOn < UTC_TIMESTAMP() - INTERVAL 1 DAY");
});
add_action('init', function () {
    if (!wp_next_scheduled('lm_hourly')) {
        wp_schedule_event(time() + 300, 'hourly', 'lm_hourly');
    }
});

// ---------- Routes ----------

function lm_register_fn_routes()
{
    $ns = 'lotmates/v1';
    $routes = [
        'razorpay-create-order' => 'lm_fn_create_order',
        'razorpay-verify-payment' => 'lm_fn_verify',
        'cancel-booking' => 'lm_fn_cancel',
        'close-deal' => function (WP_REST_Request $r) {
            if (!lm_is_admin()) {
                return lm_err('Only the Lotmates team can close deals.', 403);
            }
            $res = lm_close_deal((int) (($r->get_json_params() ?: [])['dealId'] ?? 0));
            return $res ? lm_ok($res) : lm_err('Only live deals can be closed.');
        },
        'send-refunds' => function (WP_REST_Request $r) {
            if (!lm_is_admin()) {
                return lm_err('Only the Lotmates team can send refunds.', 403);
            }
            $p = $r->get_json_params() ?: [];
            if (!empty($p['bookingId'])) {
                return lm_ok(['sent' => lm_send_refund((int) $p['bookingId']) ? 1 : 0]);
            }
            $deal = lm_row('deals_c', (int) ($p['dealId'] ?? 0));
            return $deal ? lm_ok(['sent' => lm_send_due_refunds((int) $deal['Id'], $deal['Name'])]) : lm_err('Deal not found.', 404);
        },
    ];
    foreach ($routes as $name => $cb) {
        register_rest_route($ns, '/fn/' . $name, [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => $cb,
        ]);
    }

    // Razorpay calls this after a payment is captured.
    register_rest_route($ns, '/razorpay/webhook', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $secret = (string) get_option('lm_rzp_webhook_secret', '');
            $sig = (string) $r->get_header('x-razorpay-signature');
            $raw = $r->get_body();
            if ($secret === '' || !hash_equals(hash_hmac('sha256', $raw, $secret), $sig)) {
                return new WP_Error('lm_sig', 'Bad signature', ['status' => 401]);
            }
            $e = json_decode($raw, true);
            $pay = $e['payload']['payment']['entity'] ?? null;
            if (($e['event'] ?? '') === 'payment.captured' && !empty($pay['order_id']) && !empty($pay['id'])) {
                lm_finalize_booking($pay['order_id'], $pay['id']);
            }
            return ['ok' => true];
        },
    ]);
}
