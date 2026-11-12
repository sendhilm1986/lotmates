<?php
if (!defined('ABSPATH')) {
    exit;
}

/*
 * Nobody but the site owner (manage_options) ever sees WordPress itself.
 * Neighbours, vendors, ambassadors and the Lotmates team use lotmates.in only.
 */

// wp-admin: send everyone except the owner to the site. AJAX and cron keep working.
add_action('admin_init', function () {
    if (wp_doing_ajax() || (defined('DOING_CRON') && DOING_CRON)) {
        return;
    }
    if (!current_user_can('manage_options')) {
        wp_safe_redirect(LM_SITE_URL . '/');
        exit;
    }
});

// No admin bar for anyone but the owner.
add_filter('show_admin_bar', function ($show) {
    return current_user_can('manage_options') ? $show : false;
});

// wp-login.php: only the owner signs in here. Sign-up and password reset happen on lotmates.in.
add_action('login_init', function () {
    $action = isset($_REQUEST['action']) ? sanitize_key(wp_unslash($_REQUEST['action'])) : 'login';
    if (in_array($action, ['register', 'lostpassword', 'retrievepassword', 'rp', 'resetpass'], true)) {
        wp_safe_redirect(LM_SITE_URL . '/login');
        exit;
    }
});

// If a non-owner somehow signs in through wp-login.php, send them to the site.
add_filter('login_redirect', function ($to, $requested, $user) {
    if ($user instanceof WP_User && !user_can($user, 'manage_options')) {
        return LM_SITE_URL . '/';
    }
    return $to;
}, 10, 3);

// Password reset emails point at lotmates.in, not wp-login.php.
add_filter('retrieve_password_message', function ($message, $key, $login, $user) {
    $token = rtrim(strtr(base64_encode($login . "\n" . $key), '+/', '-_'), '=');
    $url = LM_SITE_URL . '/reset-password?token=' . $token;
    $name = $user->first_name ?: $user->display_name;
    return "Hi {$name},\r\n\r\nSomeone asked to reset the password for your Lotmates account ({$user->user_email}).\r\n\r\n"
        . "To choose a new password, open this link:\r\n{$url}\r\n\r\n"
        . "If you didn't ask for this, ignore this email. Your password stays the same.\r\n\r\nLotmates";
}, 10, 4);

add_filter('retrieve_password_title', function () {
    return 'Reset your Lotmates password';
});

// No XML-RPC, no user listing through the core REST API, no author archives.
add_filter('xmlrpc_enabled', '__return_false');
add_filter('rest_endpoints', function ($endpoints) {
    if (!current_user_can('list_users')) {
        foreach (array_keys($endpoints) as $route) {
            if (strpos($route, '/wp/v2/users') === 0) {
                unset($endpoints[$route]);
            }
        }
    }
    return $endpoints;
});
add_action('template_redirect', function () {
    if (is_author()) {
        wp_safe_redirect(LM_SITE_URL . '/', 301);
        exit;
    }
});

// Let lotmates.in call the API with the visitor's sign-in cookie.
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        $origin = get_http_origin();
        $allowed = [LM_SITE_URL, 'https://www.lotmates.in'];
        if ($origin && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, X-WP-Nonce');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Vary: Origin');
        }
        return $value;
    });
}, 15);
