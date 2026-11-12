<?php
if (!defined('ABSPATH')) {
    exit;
}

/*
 * Sign-in for lotmates.in. WordPress keeps the accounts and the secure cookie;
 * the site gets a REST nonce from /session and sends it with every call.
 */

/** The profile photo the person uploaded, or null. */
function lm_avatar_url($user)
{
    $path = (string) get_user_meta($user->ID, 'lm_avatar', true);
    if ($path === '') {
        return null;
    }
    $up = wp_upload_dir();
    return $up['baseurl'] . '/' . ltrim($path, '/');
}

/**
 * Their Gravatar, if they have one and haven't turned it off. d=404 makes Gravatar answer
 * "not found" for people without one, so the app shows initials instead of a stock image.
 */
function lm_gravatar_url($user)
{
    if (get_user_meta($user->ID, 'lm_no_gravatar', true)) {
        return null;
    }
    return 'https://gravatar.com/avatar/' . hash('sha256', strtolower(trim($user->user_email))) . '?s=160&d=404';
}

/** Small per-person settings, such as which menu groups are folded away. */
function lm_user_prefs($user)
{
    $p = json_decode((string) get_user_meta($user->ID, 'lm_prefs', true), true);
    return is_array($p) ? $p : new stdClass();
}

function lm_user_payload($user)
{
    if (!$user || !$user->ID) {
        return null;
    }
    $profile = lm_profile_of($user);
    return [
        'userId' => (int) $user->ID,
        'Id' => (int) $user->ID,
        'firstName' => $user->first_name,
        'lastName' => $user->last_name,
        'name' => trim($user->first_name . ' ' . $user->last_name) ?: $user->display_name,
        'emailAddress' => $user->user_email,
        'profile' => $profile,
        'profileName' => $profile,
        'isOwner' => user_can($user, 'manage_options'),
        'avatar' => lm_avatar_url($user),
        'gravatar' => lm_gravatar_url($user),
        'prefs' => lm_user_prefs($user),
    ];
}

/** The signed-in user from the cookie, even on requests that carry no nonce yet. */
function lm_cookie_user()
{
    $uid = wp_validate_auth_cookie('', 'logged_in');
    return $uid ? get_user_by('id', $uid) : null;
}

/** Simple per-IP throttle for sign-in, sign-up and reset requests. */
function lm_throttle($bucket, $limit = 8, $window = 600)
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x';
    $key = 'lm_t_' . $bucket . '_' . md5($ip);
    $n = (int) get_transient($key);
    if ($n >= $limit) {
        return new WP_Error('lm_slow_down', 'Too many attempts. Wait a few minutes and try again.', ['status' => 429]);
    }
    set_transient($key, $n + 1, $window);
    return true;
}

function lm_register_auth_routes()
{
    $ns = 'lotmates/v1';

    register_rest_route($ns, '/session', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            nocache_headers();
            $user = lm_cookie_user();
            if (!$user) {
                return ['user' => null, 'nonce' => null];
            }
            wp_set_current_user($user->ID);
            return ['user' => lm_user_payload($user), 'nonce' => wp_create_nonce('wp_rest')];
        },
    ]);

    register_rest_route($ns, '/login', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $ok = lm_throttle('login');
            if (is_wp_error($ok)) {
                return $ok;
            }
            $email = sanitize_email($r->get_param('email'));
            $password = (string) $r->get_param('password');
            if (!$email || $password === '') {
                return new WP_Error('lm_missing', 'Enter your email and password.', ['status' => 400]);
            }
            $user = wp_signon([
                'user_login' => $email,
                'user_password' => $password,
                'remember' => true,
            ], is_ssl());
            if (is_wp_error($user)) {
                return new WP_Error('lm_bad_login', 'That email and password don\'t match an account.', ['status' => 401]);
            }
            return ['user' => lm_user_payload($user)];
        },
    ]);

    register_rest_route($ns, '/logout', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function () {
            $user = lm_cookie_user();
            if ($user) {
                wp_set_current_user($user->ID);
                wp_logout();
            }
            return ['ok' => true];
        },
    ]);

    // Public sign-up creates neighbours only. Vendors, ambassadors and the team are invited.
    register_rest_route($ns, '/register', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $ok = lm_throttle('register', 5, 3600);
            if (is_wp_error($ok)) {
                return $ok;
            }
            $email = sanitize_email($r->get_param('email'));
            $password = (string) $r->get_param('password');
            $first = sanitize_text_field((string) $r->get_param('firstName'));
            $last = sanitize_text_field((string) $r->get_param('lastName'));
            if (!is_email($email)) {
                return new WP_Error('lm_email', 'Enter a valid email address.', ['status' => 400]);
            }
            if (strlen($password) < 8) {
                return new WP_Error('lm_password', 'Use at least 8 characters for your password.', ['status' => 400]);
            }
            if (email_exists($email)) {
                return new WP_Error('lm_exists', 'An account with this email already exists. Sign in instead.', ['status' => 409]);
            }
            $uid = wp_insert_user([
                'user_login' => $email,
                'user_email' => $email,
                'user_pass' => $password,
                'first_name' => $first,
                'last_name' => $last,
                'display_name' => trim("$first $last") ?: strstr($email, '@', true),
                'role' => 'lm_customer',
            ]);
            if (is_wp_error($uid)) {
                return new WP_Error('lm_signup', 'We couldn\'t create your account. Try again.', ['status' => 500]);
            }
            do_action('lm_user_registered', (int) $uid);
            $user = wp_signon(['user_login' => $email, 'user_password' => $password, 'remember' => true], is_ssl());
            return ['user' => is_wp_error($user) ? null : lm_user_payload($user)];
        },
    ]);

    register_rest_route($ns, '/forgot', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $ok = lm_throttle('forgot', 5, 3600);
            if (is_wp_error($ok)) {
                return $ok;
            }
            $email = sanitize_email($r->get_param('email'));
            $user = $email ? get_user_by('email', $email) : null;
            // The owner resets through wp-login.php; everyone else gets the lotmates.in link.
            if ($user && !user_can($user, 'manage_options')) {
                retrieve_password($user->user_login);
            }
            // Same answer either way, so the form can't be used to find accounts.
            return ['ok' => true];
        },
    ]);

    register_rest_route($ns, '/reset', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $ok = lm_throttle('reset');
            if (is_wp_error($ok)) {
                return $ok;
            }
            // The emailed token is base64url("login\nkey").
            $raw = base64_decode(strtr((string) $r->get_param('token'), '-_', '+/'));
            $parts = $raw ? explode("\n", $raw, 2) : [];
            $login = isset($parts[0]) ? sanitize_user($parts[0]) : '';
            $key = isset($parts[1]) ? sanitize_text_field($parts[1]) : '';
            $password = (string) $r->get_param('password');
            if (strlen($password) < 8) {
                return new WP_Error('lm_password', 'Use at least 8 characters for your password.', ['status' => 400]);
            }
            $user = check_password_reset_key($key, $login);
            if (is_wp_error($user)) {
                return new WP_Error('lm_reset', 'This reset link has expired. Ask for a new one.', ['status' => 400]);
            }
            reset_password($user, $password);
            return ['ok' => true];
        },
    ]);
}
