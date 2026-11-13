<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * How each deal is delivered and scheduled.
 *  fulfilment_c: service (done at the home), delivery (a product brought to the home),
 *                pickup (collected from the vendor) or both (the buyer chooses delivery or pickup)
 *  schedule_c:   none (the vendor calls to fix a time), date (neighbour picks a day),
 *                datetime (neighbour picks a day and a time slot)
 *  timeSlots_c:  one slot per line, e.g. "Morning, 9 am to 12 pm"
 * Deals saved before these settings existed follow their category's usual way.
 */

const LM_SCHEDULE_DEFAULTS = [
    'Health' => ['service', 'datetime'],
    'Cleaning' => ['service', 'date'],
    'Pest' => ['service', 'date'],
    'AC' => ['service', 'date'],
    'Solar' => ['service', 'none'],
    'Products' => ['delivery', 'none'],
];
const LM_DEFAULT_SLOTS = "Morning, 8 am to 12 pm\nAfternoon, 12 pm to 4 pm\nEvening, 4 pm to 8 pm";

function lm_deal_fulfilment($deal)
{
    $f = $deal['fulfilment_c'] ?? null;
    return in_array($f, ['service', 'delivery', 'pickup', 'both'], true) ? $f : (LM_SCHEDULE_DEFAULTS[$deal['category_c'] ?? ''][0] ?? 'service');
}

/** What this one booking does: service, delivery or pickup. A 'both' deal follows the buyer's choice (delivery if none). */
function lm_booking_mode($deal, $booking = null)
{
    $f = lm_deal_fulfilment($deal);
    if ($f !== 'both') {
        return $f;
    }
    return ($booking['fulfilment_c'] ?? '') === 'pickup' ? 'pickup' : 'delivery';
}

function lm_deal_schedule($deal)
{
    $s = $deal['schedule_c'] ?? null;
    return in_array($s, ['none', 'date', 'datetime'], true) ? $s : (LM_SCHEDULE_DEFAULTS[$deal['category_c'] ?? ''][1] ?? 'date');
}

function lm_deal_slots($deal)
{
    $raw = trim((string) ($deal['timeSlots_c'] ?? '')) ?: LM_DEFAULT_SLOTS;
    return array_values(array_filter(array_map('trim', preg_split("/\r?\n/", $raw))));
}

/** One plain sentence about when the job happens, for emails, invoices and the dashboard. */
function lm_schedule_line($booking, $deal)
{
    $fm = lm_booking_mode($deal, $booking);
    $delivery = $fm === 'delivery';
    $pickup = $fm === 'pickup';
    $where = $pickup && !empty($deal['pickupAddress_c']) ? ' at ' . $deal['pickupAddress_c'] : '';
    $mode = lm_deal_schedule($deal);
    $window = '';
    if (!empty($deal['serviceEnd_c'])) {
        $window = !empty($deal['serviceStart_c'])
            ? 'between ' . lm_ist_date($deal['serviceStart_c'], 'j M') . ' and ' . lm_ist_date($deal['serviceEnd_c'], 'j M')
            : 'by ' . lm_ist_date($deal['serviceEnd_c'], 'j M');
    }
    if ($mode !== 'none' && !empty($booking['preferredDate_c'])) {
        $day = lm_ist_date($booking['preferredDate_c'], 'l j M');
        $slot = $mode === 'datetime' && !empty($booking['preferredSlot_c']) ? ', ' . lcfirst($booking['preferredSlot_c']) : '';
        return ($delivery ? 'Delivery on ' : ($pickup ? 'Pickup on ' : 'Preferred: ')) . $day . $slot . $where;
    }
    if ($mode !== 'none') {
        return ($delivery ? 'Delivery any day' : ($pickup ? 'Pickup any day' : 'Any day')) . $where . ($window ? ' ' . $window : '') . '. The vendor confirms the time with you.';
    }
    if ($pickup) {
        return 'Pick up' . $where . ($window ? ' ' . $window : '') . '. The vendor will call to confirm.';
    }
    return $delivery
        ? 'Delivered' . ($window ? ' ' . $window : '') . '. The vendor will call before coming.'
        : 'The vendor will call to fix a time' . ($window ? ' ' . $window : '') . '.';
}

// ---------- Capacity: how much the vendor can do per day, or per time slot ----------

/** Units the vendor can take per day (date deals) or per slot (date-and-time deals); 0 means no limit. */
function lm_slot_capacity($deal)
{
    return lm_deal_schedule($deal) === 'none' ? 0 : max(0, (int) ($deal['slotCapacity_c'] ?? 0));
}

/**
 * What's already taken, as [date => [slot => units]] ('' for a whole-day count).
 * Unpaid checkouts hold their place for 30 minutes so two people can't pay for the last spot.
 */
function lm_slot_usage($deal_id)
{
    global $wpdb;
    $rows = $wpdb->get_results($wpdb->prepare(
        'SELECT preferredDate_c AS d, COALESCE(preferredSlot_c, \'\') AS s, SUM(COALESCE(homes_c, 1)) AS n FROM ' . lm_table('bookings_c') . "
         WHERE deal_c = %d AND preferredDate_c IS NOT NULL AND status_c NOT IN ('Cancelled', 'Failed')
           AND (paymentStatus_c <> 'Pending' OR CreatedOn > UTC_TIMESTAMP() - INTERVAL 30 MINUTE)
         GROUP BY preferredDate_c, COALESCE(preferredSlot_c, '')",
        $deal_id
    ), ARRAY_A);
    $out = [];
    foreach ($rows as $r) {
        $out[$r['d']][$r['s']] = (int) $r['n'];
    }
    return $out;
}

function lm_units_taken($usage, $date, $slot, $mode)
{
    if (!isset($usage[$date])) {
        return 0;
    }
    return $mode === 'datetime' ? (int) ($usage[$date][$slot] ?? 0) : array_sum($usage[$date]);
}

function lm_register_schedule_routes()
{
    // Public: which days and slots still have room, for the checkout.
    register_rest_route('lotmates/v1', '/availability/(?P<id>\d+)', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $deal = lm_row('deals_c', (int) $r['id']);
            if (!$deal || $deal['status_c'] === 'Draft') {
                return new WP_Error('lm_deal', 'Deal not found.', ['status' => 404]);
            }
            $mode = lm_deal_schedule($deal);
            $cap = lm_slot_capacity($deal);
            $days = [];
            if ($cap) {
                $slots = $mode === 'datetime' ? lm_deal_slots($deal) : [''];
                foreach (lm_slot_usage((int) $deal['Id']) as $date => $used) {
                    foreach ($slots as $slot) {
                        $days[$date][$slot === '' ? 'day' : $slot] = max(0, $cap - lm_units_taken([$date => $used], $date, $slot, $mode));
                    }
                }
            }
            nocache_headers();
            return ['mode' => $mode, 'capacity' => $cap, 'left' => (object) $days];
        },
    ]);
}
