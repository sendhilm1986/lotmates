<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Tables mirror the Apper schema so the front end keeps the same field names.
 * Every table also has Id, Name, Owner (user id), CreatedOn and ModifiedOn.
 * Types: text, long, int, dec, date, dt, pick, multi, email, people, lookup:<table>
 */
function lm_schema()
{
    static $s = null;
    if ($s !== null) {
        return $s;
    }
    $s = [
        'cities_c' => [
            'state_c' => 'text', 'status_c' => 'pick',
        ],
        'localities_c' => [
            'pincode_c' => 'text', 'status_c' => 'pick', 'city_c' => 'lookup:cities_c',
        ],
        'communities_c' => [
            'type_c' => 'pick', 'homes_c' => 'int', 'ambassadorName_c' => 'text', 'status_c' => 'pick',
            'locality_c' => 'lookup:localities_c', 'ambassadorUser_c' => 'people',
        ],
        'vendors_c' => [
            'category_c' => 'pick', 'contactName_c' => 'text', 'phone_c' => 'text', 'email_c' => 'email',
            'status_c' => 'pick', 'checks_c' => 'multi', 'rating_c' => 'dec', 'jobsDone_c' => 'int',
            'notes_c' => 'long', 'locality_c' => 'lookup:localities_c', 'user_c' => 'people',
        ],
        'deals_c' => [
            'category_c' => 'pick', 'description_c' => 'long', 'unit_c' => 'text', 'regularPrice_c' => 'dec',
            'tier1Max_c' => 'int', 'tier1Price_c' => 'dec', 'tier2Max_c' => 'int', 'tier2Price_c' => 'dec',
            'tier3Max_c' => 'int', 'tier3Price_c' => 'dec', 'tier4Max_c' => 'int', 'tier4Price_c' => 'dec',
            'minHomes_c' => 'int', 'capacity_c' => 'int', 'commission_c' => 'dec', 'deadline_c' => 'dt',
            'serviceStart_c' => 'date', 'serviceEnd_c' => 'date', 'status_c' => 'pick',
            'bookedHomes_c' => 'int', 'unlockedTier_c' => 'int', 'round_c' => 'int', 'allowRepeat_c' => 'int', 'gallery_c' => 'json', 'video_c' => 'video',
            'fulfilment_c' => 'pick', 'schedule_c' => 'pick', 'timeSlots_c' => 'long', 'slotCapacity_c' => 'int',
            'vendor_c' => 'lookup:vendors_c', 'locality_c' => 'lookup:localities_c', 'community_c' => 'lookup:communities_c',
        ],
        'bookings_c' => [
            'homes_c' => 'int', 'unitPrice_c' => 'dec', 'amountPaid_c' => 'dec', 'finalPrice_c' => 'dec',
            'refundDue_c' => 'dec', 'refundStatus_c' => 'pick', 'paymentStatus_c' => 'pick', 'paymentRef_c' => 'text',
            'orderRef_c' => 'text', 'refundRef_c' => 'text', 'invoiceNo_c' => 'text', 'invoicedOn_c' => 'dt',
            'status_c' => 'pick', 'preferredDate_c' => 'date', 'preferredSlot_c' => 'text', 'address_c' => 'text', 'phone_c' => 'text',
            'notes_c' => 'long', 'jobNote_c' => 'long', 'doneOn_c' => 'date', 'jobPhotos_c' => 'long',
            'deal_c' => 'lookup:deals_c', 'community_c' => 'lookup:communities_c',
            'vendorUser_c' => 'people', 'ambassador_c' => 'people',
        ],
        'reviews_c' => [
            'rating_c' => 'int', 'comment_c' => 'long',
            'booking_c' => 'lookup:bookings_c', 'deal_c' => 'lookup:deals_c', 'vendor_c' => 'lookup:vendors_c',
            'hidden_c' => 'int', 'hiddenReason_c' => 'text', 'serviceDone_c' => 'dt', 'photos_c' => 'long',
        ],
        'complaints_c' => [
            'details_c' => 'long', 'status_c' => 'pick', 'response_c' => 'long', 'resolution_c' => 'long',
            'booking_c' => 'lookup:bookings_c', 'deal_c' => 'lookup:deals_c', 'vendor_c' => 'lookup:vendors_c',
            'vendorUser_c' => 'people', 'photos_c' => 'long',
        ],
        'payouts_c' => [
            'gross_c' => 'dec', 'commission_c' => 'dec', 'net_c' => 'dec', 'status_c' => 'pick', 'paidOn_c' => 'date',
            'reference_c' => 'text', 'vendor_c' => 'lookup:vendors_c', 'deal_c' => 'lookup:deals_c',
            'vendorUser_c' => 'people',
        ],
        'proposals_c' => [
            'category_c' => 'pick', 'homesInterested_c' => 'int', 'notes_c' => 'long', 'status_c' => 'pick',
            'adminNote_c' => 'long', 'community_c' => 'lookup:communities_c',
            'newCategory_c' => 'text', 'newCommunity_c' => 'text', 'newLocality_c' => 'text',
            'contactPref_c' => 'pick', 'contactPhone_c' => 'text', 'contactEmail_c' => 'text', 'repliedOn_c' => 'dt',
        ],
        'ambassadorApps_c' => [
            'email_c' => 'text', 'phone_c' => 'text', 'communityName_c' => 'text', 'localityName_c' => 'text',
            'homes_c' => 'int', 'relation_c' => 'pick', 'about_c' => 'long', 'contactPref_c' => 'pick',
            'status_c' => 'pick', 'adminNote_c' => 'long', 'agreed_c' => 'int', 'user_c' => 'people',
            'contactedOn_c' => 'dt', 'decidedOn_c' => 'dt',
        ],
        'vendorApps_c' => [
            'contactName_c' => 'text', 'email_c' => 'text', 'phone_c' => 'text', 'category_c' => 'pick', 'newCategory_c' => 'text',
            'localityIds_c' => 'multi', 'areasOther_c' => 'text', 'years_c' => 'int', 'teamSize_c' => 'int', 'capacity_c' => 'int',
            'gstin_c' => 'text', 'website_c' => 'text', 'services_c' => 'long', 'licences_c' => 'long', 'contactPref_c' => 'pick',
            'status_c' => 'pick', 'qa_c' => 'long', 'adminNote_c' => 'long', 'agreed_c' => 'int', 'user_c' => 'people',
            'vendor_c' => 'lookup:vendors_c', 'contactedOn_c' => 'dt', 'decidedOn_c' => 'dt',
        ],
        'proposalNotes_c' => [
            'proposal_c' => 'lookup:proposals_c', 'body_c' => 'long', 'authorRole_c' => 'pick', 'newStatus_c' => 'pick',
            'homesFrom_c' => 'int', 'homesTo_c' => 'int',
        ],
    ];
    return $s;
}

function lm_table($name)
{
    global $wpdb;
    return $wpdb->prefix . 'lm_' . $name;
}

function lm_sql_type($type)
{
    if (strpos($type, 'lookup:') === 0 || $type === 'people') {
        return 'BIGINT UNSIGNED NULL';
    }
    switch ($type) {
        case 'long':
        case 'json':
            return 'LONGTEXT NULL';
        case 'int':
            return 'INT NULL';
        case 'dec':
            return 'DECIMAL(14,2) NULL';
        case 'date':
            return 'DATE NULL';
        case 'dt':
            return 'DATETIME NULL';
        case 'pick':
            return 'VARCHAR(40) NULL';
        default:
            return 'VARCHAR(255) NULL';
    }
}

function lm_install_tables()
{
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    foreach (lm_schema() as $name => $fields) {
        $cols = [
            'Id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT',
            'Name VARCHAR(255) NULL',
            'Owner BIGINT UNSIGNED NULL',
            'CreatedOn DATETIME NULL',
            'ModifiedOn DATETIME NULL',
        ];
        $keys = ['PRIMARY KEY  (Id)', 'KEY Owner (Owner)'];
        foreach ($fields as $f => $t) {
            $cols[] = $f . ' ' . lm_sql_type($t);
            if ($t === 'people' || strpos($t, 'lookup:') === 0 || $f === 'status_c') {
                $keys[] = 'KEY ' . $f . ' (' . $f . ')';
            }
        }
        $sql = 'CREATE TABLE ' . lm_table($name) . " (\n" . implode(",\n", array_merge($cols, $keys)) . "\n) $charset;";
        dbDelta($sql);
    }
}

function lm_is_empty()
{
    global $wpdb;
    return (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . lm_table('deals_c')) === 0;
}
