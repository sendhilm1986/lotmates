<?php
/**
 * Plugin Name: Lotmates Core
 * Description: Data, roles, sign-in and the private API behind lotmates.in. Keeps everyone except the site owner out of wp-admin.
 * Version: 0.6.0
 * Author: Clickworthy
 * Requires PHP: 8.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('LM_VERSION', '0.7.1');
define('LM_DIR', plugin_dir_path(__FILE__));
// Public site the API serves. Change here if the front end moves.
define('LM_SITE_URL', 'https://lotmates.in');

require_once LM_DIR . 'includes/schema.php';
require_once LM_DIR . 'includes/roles.php';
require_once LM_DIR . 'includes/lockdown.php';
require_once LM_DIR . 'includes/auth.php';
require_once LM_DIR . 'includes/query.php';
require_once LM_DIR . 'includes/seed.php';
require_once LM_DIR . 'includes/categories.php';
require_once LM_DIR . 'includes/schedule.php';
require_once LM_DIR . 'includes/payments.php';
require_once LM_DIR . 'includes/account.php';
require_once LM_DIR . 'includes/media.php';
require_once LM_DIR . 'includes/pdf.php';
require_once LM_DIR . 'includes/invoices.php';
require_once LM_DIR . 'includes/og.php';
require_once LM_DIR . 'includes/emails.php';
require_once LM_DIR . 'includes/deal_review.php';
require_once LM_DIR . 'includes/team.php';
require_once LM_DIR . 'includes/proposals.php';
require_once LM_DIR . 'includes/ambassadors.php';
require_once LM_DIR . 'includes/neighbours.php';
require_once LM_DIR . 'includes/vendor_apps.php';
require_once LM_DIR . 'includes/review_photos.php';

register_activation_hook(__FILE__, function () {
    lm_install_tables();
    lm_install_email_log();
    lm_install_roles();
    update_option('users_can_register', 0);
    if (lm_is_empty()) {
        lm_seed_demo();
    }
    lm_migrate();
    update_option('lm_version', LM_VERSION);
});

// Re-run table creation after an update that changed the schema.
add_action('plugins_loaded', function () {
    if (get_option('lm_version') !== LM_VERSION) {
        lm_install_tables();
        lm_install_email_log();
        lm_install_roles();
        lm_migrate();
        update_option('lm_version', LM_VERSION);
    }
});

/** One-off data changes that go with a schema change. Safe to run more than once. */
function lm_migrate()
{
    global $wpdb;
    lm_migrate_drop_vendor_agreement();
    // Ratings come from reviews: line up every vendor that has visible reviews.
    foreach ($wpdb->get_col('SELECT DISTINCT vendor_c FROM ' . lm_table('reviews_c') . ' WHERE vendor_c IS NOT NULL AND (hidden_c IS NULL OR hidden_c = 0)') as $vid) {
        lm_vendor_rating_refresh((int) $vid);
    }
    // Repeat bookings: allowed by default for checkups, AC care and products.
    $wpdb->query('UPDATE ' . lm_table('deals_c') . " SET allowRepeat_c = IF(category_c IN ('Health','AC','Products'), 1, 0) WHERE allowRepeat_c IS NULL");
    // Delivery and scheduling: write each category's usual way onto existing deals.
    lm_categories_seed();
    foreach (lm_categories() as $cat => $def) {
        [$fulfilment, $schedule] = [$def['fulfilment'], $def['schedule']];
        $wpdb->query($wpdb->prepare('UPDATE ' . lm_table('deals_c') . ' SET fulfilment_c = %s WHERE fulfilment_c IS NULL AND category_c = %s', $fulfilment, $cat));
        $wpdb->query($wpdb->prepare('UPDATE ' . lm_table('deals_c') . ' SET schedule_c = %s WHERE schedule_c IS NULL AND category_c = %s', $schedule, $cat));
    }
}

add_action('rest_api_init', function () {
    lm_register_auth_routes();
    lm_register_query_routes();
    lm_register_fn_routes();
    lm_register_account_routes();
    lm_register_category_routes();
    lm_register_media_routes();
    lm_register_invoice_routes();
    lm_register_og_routes();
    lm_register_email_routes();
    lm_register_team_routes();
    lm_register_schedule_routes();
    lm_register_proposal_routes();
    lm_register_ambassador_routes();
    lm_register_neighbour_routes();
    lm_register_vendor_app_routes();
    lm_register_review_photo_routes();
    lm_register_deal_review_routes();
});


/**
 * The vendor agreement was dropped from the terms. If the team saved their own copy of an
 * email that still promises it, rewrite those words to match. Runs once; saved copies
 * without the wording are left exactly as they are.
 */
function lm_migrate_drop_vendor_agreement()
{
    if (get_option('lm_mig_vendor_agreement')) {
        return;
    }
    $saved = get_option('lm_email_templates', []);
    $changed = [];
    $swaps = [
        'references from past customers, and a test job, and you sign the vendor agreement.' => 'references from past customers and a test job, and verify your bank account for payouts.',
        ', and you sign the vendor agreement' => ', and verify your bank account for payouts',
        ' and you sign the vendor agreement' => ' and verify your bank account for payouts',
        'Sign the vendor agreement. ' => '',
        'the vendor agreement' => 'the vendor terms',
    ];
    if (is_array($saved)) {
        foreach ($saved as $event => $fields) {
            if (!is_array($fields)) {
                continue;
            }
            foreach (['subject', 'heading', 'body', 'button', 'footnote'] as $f) {
                if (!isset($fields[$f]) || stripos((string) $fields[$f], 'agreement') === false) {
                    continue;
                }
                $before = (string) $fields[$f];
                $after = str_ireplace(array_keys($swaps), array_values($swaps), $before);
                if ($after !== $before) {
                    $saved[$event][$f] = $after;
                    $changed[] = $event . '.' . $f;
                }
            }
        }
        if ($changed) {
            update_option('lm_email_templates', $saved);
        }
    }
    update_option('lm_mig_vendor_agreement', $changed ? implode(',', $changed) : 'none', false);
}
