<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Invoices for neighbours. When a deal closes and goes ahead, every confirmed booking gets an
 * email with its invoice attached. When a deal doesn't go ahead, everyone gets a refund note.
 * The team can also send or resend an invoice from the dashboard, and customers can download
 * their own from the booking page.
 */

const LM_GREEN = [31, 92, 69];
const LM_INK = [29, 59, 48];
const LM_MUTED = [98, 112, 106];
const LM_LINE = [223, 229, 224];
const LM_TINT = [243, 246, 242];
const LM_TURMERIC = [224, 165, 38];

// ---------- Settings ----------

function lm_invoice_settings()
{
    return [
        'name' => get_option('lm_inv_name', '') ?: 'Lotmates',
        'address' => get_option('lm_inv_address', ''),
        'gstin' => get_option('lm_inv_gstin', ''),
        'email' => get_option('lm_inv_email', '') ?: get_option('admin_email'),
        'prefix' => get_option('lm_inv_prefix', '') ?: 'LM',
    ];
}

add_action('admin_menu', function () {
    add_options_page('Lotmates invoices', 'Lotmates invoices', 'manage_options', 'lotmates-invoices', 'lm_invoice_settings_page');
});

function lm_invoice_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $msg = '';
    if (isset($_POST['lm_inv_save']) && check_admin_referer('lm_invoices')) {
        update_option('lm_inv_name', sanitize_text_field(wp_unslash($_POST['name'] ?? '')), false);
        update_option('lm_inv_address', sanitize_textarea_field(wp_unslash($_POST['address'] ?? '')), false);
        update_option('lm_inv_gstin', strtoupper(sanitize_text_field(wp_unslash($_POST['gstin'] ?? ''))), false);
        update_option('lm_inv_email', sanitize_email(wp_unslash($_POST['email'] ?? '')), false);
        update_option('lm_inv_prefix', preg_replace('/[^A-Z0-9]/', '', strtoupper(sanitize_text_field(wp_unslash($_POST['prefix'] ?? '')))), false);
        $msg = 'Saved.';
    }
    $s = lm_invoice_settings();
    echo '<div class="wrap"><h1>Lotmates invoices</h1>';
    if ($msg) {
        echo '<div class="notice notice-info"><p>' . esc_html($msg) . '</p></div>';
    }
    echo '<p>These details print at the top of every invoice emailed to neighbours. Check the wording with your accountant before launch.</p>';
    echo '<form method="post">';
    wp_nonce_field('lm_invoices');
    echo '<table class="form-table">';
    echo '<tr><th>Business name</th><td><input name="name" class="regular-text" value="' . esc_attr(get_option('lm_inv_name', '')) . '" placeholder="Lotmates"></td></tr>';
    echo '<tr><th>Address</th><td><textarea name="address" rows="3" class="large-text">' . esc_textarea($s['address']) . '</textarea></td></tr>';
    echo '<tr><th>GSTIN</th><td><input name="gstin" class="regular-text" value="' . esc_attr($s['gstin']) . '" placeholder="Optional"></td></tr>';
    echo '<tr><th>Support email</th><td><input name="email" type="email" class="regular-text" value="' . esc_attr(get_option('lm_inv_email', '')) . '" placeholder="' . esc_attr(get_option('admin_email')) . '"></td></tr>';
    echo '<tr><th>Invoice number prefix</th><td><input name="prefix" class="small-text" value="' . esc_attr($s['prefix']) . '"> <span class="description">Numbers look like ' . esc_html($s['prefix']) . '/' . esc_html(lm_fy()) . '/0001 and restart each financial year.</span></td></tr>';
    echo '</table><p><button class="button button-primary" name="lm_inv_save" value="1">Save</button></p></form></div>';
}

// ---------- Helpers ----------

/** Financial year label, April to March, e.g. 26-27. */
function lm_fy($ts = null)
{
    $ts = $ts ?? time();
    $y = (int) wp_date('Y', $ts, new DateTimeZone('Asia/Kolkata'));
    $m = (int) wp_date('n', $ts, new DateTimeZone('Asia/Kolkata'));
    $start = $m >= 4 ? $y : $y - 1;
    return sprintf('%02d-%02d', $start % 100, ($start + 1) % 100);
}

/** Indian digit grouping: 166000 -> 1,66,000.00 */
function lm_money($n, $decimals = 2)
{
    $n = round((float) $n, $decimals);
    $neg = $n < 0;
    $parts = explode('.', number_format(abs($n), $decimals, '.', ''));
    $int = $parts[0];
    if (strlen($int) > 3) {
        $last = substr($int, -3);
        $rest = substr($int, 0, -3);
        $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
        $int = $rest . ',' . $last;
    }
    return ($neg ? '-' : '') . 'INR ' . $int . ($decimals ? '.' . $parts[1] : '');
}

function lm_ist_date($mysql_or_iso, $format = 'j M Y')
{
    if (!$mysql_or_iso) {
        return '';
    }
    $ts = strtotime($mysql_or_iso . (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $mysql_or_iso) ? ' UTC' : ''));
    return $ts ? wp_date($format, $ts, new DateTimeZone('Asia/Kolkata')) : '';
}

function lm_invoice_number($booking_id)
{
    global $wpdb;
    $bt = lm_table('bookings_c');
    $existing = $wpdb->get_var($wpdb->prepare("SELECT invoiceNo_c FROM $bt WHERE Id = %d", $booking_id));
    if ($existing) {
        return $existing;
    }
    $fy = lm_fy();
    $key = 'lm_inv_seq_' . str_replace('-', '', $fy);
    add_option($key, 0, '', false);
    // Atomic increment so two closes at once never share a number.
    $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value = option_value + 1 WHERE option_name = %s", $key));
    wp_cache_delete($key, 'options');
    $seq = (int) $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", $key));
    $no = sprintf('%s/%s/%04d', lm_invoice_settings()['prefix'], $fy, $seq);
    $wpdb->update($bt, ['invoiceNo_c' => $no], ['Id' => $booking_id]);
    return $no;
}

/** Everything an invoice or email needs about one booking. */
function lm_invoice_data($booking_id)
{
    global $wpdb;
    $b = lm_row('bookings_c', $booking_id);
    if (!$b) {
        return null;
    }
    $deal = $b['deal_c'] ? lm_row('deals_c', $b['deal_c']) : null;
    $vendor = $deal && $deal['vendor_c'] ? lm_row('vendors_c', $deal['vendor_c']) : null;
    $community = $b['community_c'] ? lm_row('communities_c', $b['community_c']) : null;
    $locality = $deal && $deal['locality_c'] ? lm_row('localities_c', $deal['locality_c']) : null;
    $user = $b['Owner'] ? get_user_by('id', (int) $b['Owner']) : null;
    $homes = max(1, (int) $b['homes_c']);
    $rate = $b['finalPrice_c'] !== null ? (float) $b['finalPrice_c'] : (float) $b['unitPrice_c'];
    return [
        'booking' => $b,
        'deal' => $deal,
        'vendor' => $vendor,
        'community' => $community,
        'locality' => $locality,
        'user' => $user,
        'name' => $user ? (trim($user->first_name . ' ' . $user->last_name) ?: $user->display_name) : 'Neighbour',
        'email' => $user ? $user->user_email : '',
        'homes' => $homes,
        'rate' => $rate,
        'total' => $rate * $homes,
        'paid' => (float) $b['amountPaid_c'],
        'refund' => (float) $b['refundDue_c'],
        'refundStatus' => $b['refundStatus_c'],
        'unit' => $deal ? preg_replace('/^per\s+/i', '', (string) $deal['unit_c']) : 'home',
    ];
}

function lm_can_invoice($b)
{
    return $b && $b['paymentStatus_c'] !== 'Pending' && in_array($b['status_c'], ['Confirmed', 'Done'], true);
}

// ---------- The invoice PDF ----------

function lm_invoice_pdf($booking_id)
{
    $d = lm_invoice_data($booking_id);
    if (!$d) {
        return null;
    }
    $b = $d['booking'];
    $s = lm_invoice_settings();
    $no = lm_invoice_number($booking_id);
    $issued = $b['invoicedOn_c'] ?: gmdate('Y-m-d H:i:s');

    $pdf = new LM_Pdf('Invoice ' . $no);
    $M = 50;
    $R = LM_Pdf::W - $M;

    // Brand
    $pdf->ellipse($M + 13, 62, 6.3, 12.6, LM_TURMERIC);
    $pdf->circle($M + 7, 62, 14, LM_GREEN, 2.8);
    $pdf->circle($M + 19, 62, 14, LM_GREEN, 2.8);
    $pdf->text($M + 40, 69, 'lotmates', 21, true, LM_GREEN);
    $pdf->text($R, 70, 'Invoice', 24, true, LM_INK, 'right');

    // Invoice facts
    $y = 112;
    $facts = [
        ['Invoice number', $no],
        ['Invoice date', lm_ist_date($issued)],
        ['Booking', $b['Name']],
        ['Paid on', lm_ist_date($b['CreatedOn'])],
    ];
    if ($b['paymentRef_c']) {
        $facts[] = ['Payment ref', $b['paymentRef_c']];
    }
    foreach ($facts as $f) {
        $pdf->text($R - 175, $y, $f[0], 8.5, false, LM_MUTED);
        $pdf->text($R, $y, $f[1], 8.5, true, LM_INK, 'right');
        $y += 15;
    }

    // From / Billed to
    $col = 255;
    $top = 112;
    $pdf->text($M, $top, 'From', 8.5, false, LM_MUTED);
    $ly = $top + 16;
    $pdf->text($M, $ly, $s['name'], 10, true, LM_INK);
    foreach (array_filter(preg_split("/\r?\n/", (string) $s['address'])) as $line) {
        $ly += 13;
        $pdf->text($M, $ly, $line, 9, false, LM_INK);
    }
    if ($s['gstin']) {
        $ly += 13;
        $pdf->text($M, $ly, 'GSTIN ' . $s['gstin'], 9, false, LM_INK);
    }
    $ly += 13;
    $pdf->text($M, $ly, $s['email'], 9, false, LM_MUTED);

    $pdf->text($M + $col - 90, $top, 'Billed to', 8.5, false, LM_MUTED);
    $by = $top + 16;
    $bx = $M + $col - 90;
    $pdf->text($bx, $by, $d['name'], 10, true, LM_INK);
    $addr = array_filter([$b['address_c'], $d['community']['Name'] ?? null, $d['locality']['Name'] ?? null]);
    foreach ($addr as $line) {
        $by += 13;
        foreach ($pdf->wrap($line, 9, 150) as $w) {
            $pdf->text($bx, $by, $w, 9, false, LM_INK);
        }
    }
    if ($d['email']) {
        $by += 13;
        $pdf->text($bx, $by, $d['email'], 9, false, LM_MUTED);
    }
    if ($b['phone_c']) {
        $by += 13;
        $pdf->text($bx, $by, $b['phone_c'], 9, false, LM_MUTED);
    }

    // Line items
    $y = max($y, $ly, $by) + 36;
    $pdf->roundRect($M, $y, $R - $M, 26, 6, LM_TINT);
    $cq = $R - 210;
    $cr = $R - 110;
    $pdf->text($M + 12, $y + 17, 'Description', 8.5, false, LM_MUTED);
    $pdf->text($cq, $y + 17, 'Qty', 8.5, false, LM_MUTED, 'right');
    $pdf->text($cr, $y + 17, 'Rate', 8.5, false, LM_MUTED, 'right');
    $pdf->text($R - 12, $y + 17, 'Amount', 8.5, false, LM_MUTED, 'right');
    $y += 26 + 20;
    $title = $d['deal']['Name'] ?? 'Lotmates booking';
    $lines = $pdf->wrap($title, 10.5, $cq - $M - 80, true);
    $first = $y;
    foreach ($lines as $line) {
        $pdf->text($M + 12, $y, $line, 10.5, true, LM_INK);
        $y += 14;
    }
    $sub = [];
    if ($d['vendor']) {
        $sub[] = 'Service by ' . $d['vendor']['Name'];
    }
    if ($d['deal']) {
        $sub[] = lm_schedule_line($b, $d['deal']);
    }
    $sub[] = 'Group price for ' . (int) ($d['deal']['bookedHomes_c'] ?? 0) . ' neighbours';
    foreach ($sub as $line) {
        foreach ($pdf->wrap($line, 8.5, $cq - $M - 70) as $part) {
            $pdf->text($M + 12, $y + 1, $part, 8.5, false, LM_MUTED);
            $y += 12;
        }
    }
    $pdf->text($cq, $first, $d['homes'] . ' ' . $d['unit'] . ($d['homes'] === 1 || preg_match('/s$/', $d['unit']) ? '' : 's'), 9.5, false, LM_INK, 'right');
    $pdf->text($cr, $first, lm_money($d['rate']), 9.5, false, LM_INK, 'right');
    $pdf->text($R - 12, $first, lm_money($d['total']), 9.5, true, LM_INK, 'right');
    $y += 10;
    $pdf->line($M, $y, $R, $y, LM_LINE);

    // Totals
    $y += 24;
    $lx = $R - 230;
    $rows = [['Total', lm_money($d['total']), true]];
    if ($d['refund'] > 0) {
        $rows[] = ['Paid at booking', lm_money($d['paid']), false];
        $rows[] = [$d['refundStatus'] === 'Paid' ? 'Refunded to you' : 'Refund on its way to you', '- ' . lm_money($d['refund']), false];
    }
    foreach ($rows as $i => $r) {
        $pdf->text($lx, $y, $r[0], $r[2] ? 11 : 9.5, $r[2], $r[2] ? LM_INK : LM_MUTED);
        $pdf->text($R - 12, $y, $r[1], $r[2] ? 11 : 9.5, $r[2], LM_INK, 'right');
        $y += $r[2] ? 22 : 17;
    }
    if ($d['refund'] > 0) {
        $pdf->line($lx, $y - 8, $R, $y - 8, LM_LINE);
        $y += 8;
        $pdf->text($lx, $y, 'You paid', 11, true, LM_INK);
        $pdf->text($R - 12, $y, lm_money($d['paid'] - $d['refund']), 11, true, LM_GREEN, 'right');
        $y += 22;
    }

    // Notes
    $y += 26;
    $pdf->roundRect($M, $y, $R - $M, 66, 10, LM_TINT);
    $pdf->text($M + 16, $y + 22, 'Paid in full through Razorpay. Prices include applicable taxes.', 9, false, LM_INK);
    $note = $d['refund'] > 0
        ? 'Early bookers paid the first price and get the difference back once the deal closed at the group price.'
        : 'This booking was at the group price, so no refund was due.';
    foreach ($pdf->wrap($note, 9, $R - $M - 32) as $i => $line) {
        $pdf->text($M + 16, $y + 38 + $i * 13, $line, 9, false, LM_MUTED);
    }

    // Footer
    $fy = LM_Pdf::H - 46;
    $pdf->line($M, $fy - 14, $R, $fy - 14, LM_LINE);
    $pdf->text($M, $fy, 'Thank you for booking with your neighbours. Questions? ' . $s['email'] . ' or ' . preg_replace('~^https?://~', '', LM_SITE_URL) . '/contact', 8, false, LM_MUTED);

    return ['bytes' => $pdf->output(), 'number' => $no, 'filename' => 'Lotmates-invoice-' . str_replace('/', '-', $no) . '.pdf'];
}

// ---------- Emails ----------

function lm_email_html($heading, $intro, $rows, $cta_label, $cta_url, $footnote)
{
    $s = lm_invoice_settings();
    $table = '';
    foreach ($rows as $r) {
        $table .= '<tr><td style="padding:10px 0;border-bottom:1px solid #e3e8e4;color:#62706a;font-size:14px">' . esc_html($r[0]) . '</td><td style="padding:10px 0;border-bottom:1px solid #e3e8e4;color:#1d3b30;font-size:14px;font-weight:600;text-align:right">' . esc_html($r[1]) . '</td></tr>';
    }
    return '<!doctype html><html><body style="margin:0;background:#f3f6f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f2;padding:32px 12px"><tr><td align="center">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:32px">'
        . '<tr><td style="font-size:22px;font-weight:800;color:#1f5c45;letter-spacing:-0.5px;padding-bottom:24px">lotmates</td></tr>'
        . '<tr><td style="font-size:24px;font-weight:700;color:#1d3b30;line-height:1.25;padding-bottom:10px">' . esc_html($heading) . '</td></tr>'
        . '<tr><td style="font-size:15px;color:#3d544b;line-height:1.6;padding-bottom:18px">' . $intro . '</td></tr>'
        . '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $table . '</table></td></tr>'
        . ($cta_url ? '<tr><td style="padding:26px 0 8px"><a href="' . esc_url($cta_url) . '" style="display:inline-block;background:#1f5c45;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px">' . esc_html($cta_label) . '</a></td></tr>' : '')
        . '<tr><td style="font-size:13px;color:#62706a;line-height:1.6;padding-top:18px">' . $footnote . '</td></tr>'
        . '</table>'
        . '<p style="font-size:12px;color:#8a978f;margin:18px 0 0">' . esc_html($s['name']) . ', ' . esc_html(preg_replace('~^https?://~', '', LM_SITE_URL)) . '</p>'
        . '</td></tr></table></body></html>';
}

function lm_mail($to, $subject, $html, $attachments = [])
{
    $name = function () {
        return 'Lotmates';
    };
    add_filter('wp_mail_from_name', $name);
    $s = lm_invoice_settings();
    $headers = ['Content-Type: text/html; charset=UTF-8', 'Reply-To: ' . $s['name'] . ' <' . $s['email'] . '>'];
    $ok = wp_mail($to, $subject, $html, $headers, $attachments);
    remove_filter('wp_mail_from_name', $name);
    return $ok;
}

/** Email one booking's invoice. Returns ['ok' => bool, 'message' => ..., 'to' => ..., 'invoiceNo' => ...]. */
function lm_send_invoice($booking_id, $force = true)
{
    global $wpdb;
    $d = lm_invoice_data($booking_id);
    if (!$d) {
        return ['ok' => false, 'message' => 'Booking not found.'];
    }
    if (!lm_can_invoice($d['booking'])) {
        return ['ok' => false, 'message' => 'Invoices go out once the deal has closed and the booking is confirmed.'];
    }
    if (!$d['email']) {
        return ['ok' => false, 'message' => 'This neighbour has no email address.'];
    }
    $pdf = lm_invoice_pdf($booking_id);
    $dir = trailingslashit(wp_upload_dir()['basedir']) . 'lotmates-tmp';
    wp_mkdir_p($dir);
    if (!file_exists("$dir/index.html")) {
        file_put_contents("$dir/index.html", '');
    }
    $file = "$dir/" . wp_generate_password(10, false) . '-' . $pdf['filename'];
    file_put_contents($file, $pdf['bytes']);

    $b = lm_row('bookings_c', $booking_id);
    $ctx = lm_email_ctx_booking($b) + ['invoice_number' => $pdf['number']];
    // Sent by hand from the dashboard even if the automatic email is switched off.
    $ok = lm_send_template('n_deal_confirmed', $d['email'], $ctx, ['ref' => $booking_id, 'user' => $b['Owner'], 'attachments' => [$file], 'force' => $force]);
    @unlink($file);
    if ($ok) {
        $wpdb->update(lm_table('bookings_c'), ['invoicedOn_c' => gmdate('Y-m-d H:i:s')], ['Id' => $booking_id]);
    }
    return ['ok' => (bool) $ok, 'message' => $ok ? 'Sent.' : 'The email could not be sent from this server.', 'to' => $d['email'], 'invoiceNo' => $pdf['number']];
}

function lm_send_refund_notice($booking_id)
{
    return lm_email_booking('n_deal_failed', $booking_id, ['once' => true]);
}

// ---------- Queue: emails after a deal closes ----------

function lm_queue_close_emails($deal_id, $unlocked)
{
    global $wpdb;
    $status = $unlocked ? 'Confirmed' : 'Failed';
    $ids = $wpdb->get_col($wpdb->prepare('SELECT Id FROM ' . lm_table('bookings_c') . " WHERE deal_c = %d AND status_c = %s AND paymentStatus_c <> 'Pending'", $deal_id, $status));
    $queue = get_option('lm_mail_queue', []);
    foreach ($ids as $id) {
        $queue[] = [(int) $id, $unlocked ? 'invoice' : 'refund'];
    }
    update_option('lm_mail_queue', $queue, false);
}

function lm_drain_mail_queue($limit = 20)
{
    $queue = get_option('lm_mail_queue', []);
    if (!$queue) {
        return 0;
    }
    $batch = array_splice($queue, 0, $limit);
    update_option('lm_mail_queue', $queue, false);
    $sent = 0;
    foreach ($batch as [$id, $kind]) {
        $ok = $kind === 'invoice' ? lm_send_invoice($id, false)['ok'] : lm_send_refund_notice($id);
        $sent += $ok ? 1 : 0;
    }
    if ($queue && !wp_next_scheduled('lm_mail_queue_run')) {
        wp_schedule_single_event(time() + 120, 'lm_mail_queue_run');
    }
    return $sent;
}
add_action('lm_mail_queue_run', function () {
    lm_drain_mail_queue(40);
});
add_action('lm_hourly', function () {
    lm_drain_mail_queue(40);
}, 20);

// ---------- Routes ----------

function lm_register_invoice_routes()
{
    $ns = 'lotmates/v1';
    $admin = function () {
        return lm_is_admin(wp_get_current_user()) ? true : new WP_Error('lm_forbidden', 'Only the Lotmates team can send invoices.', ['status' => 403]);
    };

    register_rest_route($ns, '/fn/send-invoice', [
        'methods' => 'POST',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) {
            $res = lm_send_invoice((int) $r->get_param('bookingId'));
            if (!$res['ok']) {
                return new WP_Error('lm_invoice', $res['message'], ['status' => 400]);
            }
            return $res;
        },
    ]);

    register_rest_route($ns, '/fn/send-deal-invoices', [
        'methods' => 'POST',
        'permission_callback' => $admin,
        'callback' => function (WP_REST_Request $r) {
            global $wpdb;
            $deal_id = (int) $r->get_param('dealId');
            $only_missing = (bool) $r->get_param('onlyMissing');
            $sql = 'SELECT Id FROM ' . lm_table('bookings_c') . " WHERE deal_c = %d AND status_c IN ('Confirmed','Done') AND paymentStatus_c <> 'Pending'" . ($only_missing ? ' AND invoicedOn_c IS NULL' : '');
            $ids = $wpdb->get_col($wpdb->prepare($sql, $deal_id));
            if (!$ids) {
                return new WP_Error('lm_invoice', $only_missing ? 'Every confirmed booking already has its invoice.' : 'There are no confirmed bookings on this deal yet.', ['status' => 400]);
            }
            $sent = 0;
            $failed = 0;
            foreach (array_slice($ids, 0, 60) as $id) {
                lm_send_invoice((int) $id)['ok'] ? $sent++ : $failed++;
            }
            // Big deals: the rest go out in the background a couple of minutes later.
            $rest = array_slice($ids, 60);
            if ($rest) {
                $queue = get_option('lm_mail_queue', []);
                foreach ($rest as $id) {
                    $queue[] = [(int) $id, 'invoice'];
                }
                update_option('lm_mail_queue', $queue, false);
                if (!wp_next_scheduled('lm_mail_queue_run')) {
                    wp_schedule_single_event(time() + 60, 'lm_mail_queue_run');
                }
            }
            return ['sent' => $sent, 'failed' => $failed, 'total' => count($ids)];
        },
    ]);

    // The PDF itself: for the neighbour who booked, or the team.
    register_rest_route($ns, '/invoice/(?P<id>\d+)', [
        'methods' => 'GET',
        'permission_callback' => function () {
            return is_user_logged_in() ? true : new WP_Error('lm_signin', 'Sign in to download your invoice.', ['status' => 401]);
        },
        'callback' => function (WP_REST_Request $r) {
            $id = (int) $r['id'];
            $b = lm_row('bookings_c', $id);
            $user = wp_get_current_user();
            if (!$b || (!lm_is_admin($user) && (int) $b['Owner'] !== (int) $user->ID)) {
                return new WP_Error('lm_missing', 'Invoice not found.', ['status' => 404]);
            }
            if (!lm_can_invoice($b)) {
                return new WP_Error('lm_invoice', 'Your invoice is ready once the deal closes and your booking is confirmed.', ['status' => 400]);
            }
            $pdf = lm_invoice_pdf($id);
            nocache_headers();
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $pdf['filename'] . '"');
            header('Content-Length: ' . strlen($pdf['bytes']));
            echo $pdf['bytes'];
            exit;
        },
    ]);
}
