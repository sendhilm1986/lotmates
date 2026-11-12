<?php
if (!defined('ABSPATH')) {
    exit;
}

// WordPress role => profile name the front end already uses.
const LM_ROLE_PROFILES = [
    'lm_admin' => 'Admin_c',
    'lm_customer' => 'Customer_c',
    'lm_vendor' => 'Vendor_c',
    'lm_ambassador' => 'Ambassador_c',
];

function lm_install_roles()
{
    $labels = [
        'lm_admin' => 'Lotmates team',
        'lm_customer' => 'Neighbour',
        'lm_vendor' => 'Vendor',
        'lm_ambassador' => 'Ambassador',
    ];
    foreach ($labels as $role => $label) {
        if (!get_role($role)) {
            // Only "read": none of these roles can do anything in wp-admin.
            add_role($role, $label, ['read' => true]);
        }
    }
}

/** Profile name for a user: site owners count as the Lotmates team. */
function lm_profile_of($user = null)
{
    $user = $user ?: wp_get_current_user();
    if (!$user || !$user->ID) {
        return null;
    }
    if (user_can($user, 'manage_options')) {
        return 'Admin_c';
    }
    foreach (LM_ROLE_PROFILES as $role => $profile) {
        if (in_array($role, (array) $user->roles, true)) {
            return $profile;
        }
    }
    return null;
}

function lm_is_admin($user = null)
{
    return lm_profile_of($user) === 'Admin_c';
}
