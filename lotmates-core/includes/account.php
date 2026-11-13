<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * The signed-in person's own profile: details, sign-in, saved address and their data.
 * Every route acts only on the current user; nobody can read or change someone else here.
 */

function lm_me_required()
{
    return is_user_logged_in() ? true : new WP_Error('lm_signin', 'Sign in to see your profile.', ['status' => 401]);
}

function lm_me_payload($user)
{
    global $wpdb;
    $uid = (int) $user->ID;
    $profile = lm_profile_of($user);
    $community = null;
    $cid = (int) get_user_meta($uid, 'lm_community', true);
    if ($cid) {
        $row = $wpdb->get_row($wpdb->prepare('SELECT Id, Name, locality_c FROM ' . lm_table('communities_c') . ' WHERE Id = %d', $cid), ARRAY_A);
        if ($row) {
            $community = ['Id' => (string) $row['Id'], 'Name' => $row['Name']];
        }
    }
    $locality = null;
    $lid = (int) get_user_meta($uid, 'lm_locality', true);
    if (!$lid && !empty($row['locality_c'])) {
        $lid = (int) $row['locality_c']; // Accounts saved before houses were supported: the community's locality.
    }
    if ($lid) {
        $row = $wpdb->get_row($wpdb->prepare('SELECT Id, Name FROM ' . lm_table('localities_c') . ' WHERE Id = %d', $lid), ARRAY_A);
        if ($row) {
            $locality = ['Id' => (string) $row['Id'], 'Name' => $row['Name']];
        }
    }
    $out = [
        'firstName' => $user->first_name,
        'lastName' => $user->last_name,
        'email' => $user->user_email,
        'phone' => (string) get_user_meta($uid, 'lm_phone', true),
        'address' => (string) get_user_meta($uid, 'lm_address', true),
        'community' => $community,
        'locality' => $locality,
        'profile' => $profile,
        'memberSince' => mysql2date('Y-m-d', $user->user_registered),
        'isOwner' => user_can($user, 'manage_options'),
        'avatar' => lm_avatar_url($user),
        'gravatar' => lm_gravatar_url($user),
        'useGravatar' => !get_user_meta($uid, 'lm_no_gravatar', true),
        'deletionRequested' => (string) get_user_meta($uid, 'lm_delete_requested', true) ?: null,
        'vendor' => null,
        'communities' => [],
        'counts' => [],
    ];
    if ($profile === 'Vendor_c') {
        $v = $wpdb->get_row($wpdb->prepare('SELECT v.Id, v.Name, v.category_c, v.status_c, l.Name AS locality FROM ' . lm_table('vendors_c') . ' v LEFT JOIN ' . lm_table('localities_c') . ' l ON l.Id = v.locality_c WHERE v.user_c = %d LIMIT 1', $uid), ARRAY_A);
        if ($v) {
            $out['vendor'] = ['Id' => (string) $v['Id'], 'Name' => $v['Name'], 'category' => $v['category_c'], 'status' => $v['status_c'], 'locality' => $v['locality']];
        }
    }
    if ($profile === 'Ambassador_c') {
        $rows = $wpdb->get_results($wpdb->prepare('SELECT c.Id, c.Name, c.homes_c, l.Name AS locality FROM ' . lm_table('communities_c') . ' c LEFT JOIN ' . lm_table('localities_c') . ' l ON l.Id = c.locality_c WHERE c.ambassadorUser_c = %d ORDER BY c.Name', $uid), ARRAY_A);
        foreach ($rows as $r) {
            $out['communities'][] = ['Id' => (string) $r['Id'], 'Name' => $r['Name'], 'homes' => (int) $r['homes_c'], 'locality' => $r['locality']];
        }
    }
    if ($profile === 'Customer_c' || $profile === 'Ambassador_c') {
        $out['counts'] = [
            'bookings' => (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . lm_table('bookings_c') . " WHERE Owner = %d AND paymentStatus_c <> 'Pending'", $uid)),
            'reviews' => (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . lm_table('reviews_c') . ' WHERE Owner = %d', $uid)),
        ];
    }
    return $out;
}

function lm_clean_phone($v)
{
    $v = trim(preg_replace('/[^\d+\s-]/', '', (string) $v));
    return $v;
}

function lm_register_account_routes()
{
    $ns = 'lotmates/v1';

    register_rest_route($ns, '/me', [
        [
            'methods' => 'GET',
            'permission_callback' => 'lm_me_required',
            'callback' => function () {
                nocache_headers();
                return lm_me_payload(wp_get_current_user());
            },
        ],
        [
            'methods' => 'POST',
            'permission_callback' => 'lm_me_required',
            'callback' => function (WP_REST_Request $r) {
                global $wpdb;
                $user = wp_get_current_user();
                $uid = (int) $user->ID;
                $p = $r->get_json_params() ?: [];
                $update = ['ID' => $uid];
                if (array_key_exists('firstName', $p) || array_key_exists('lastName', $p)) {
                    $first = mb_substr(sanitize_text_field((string) ($p['firstName'] ?? $user->first_name)), 0, 60);
                    $last = mb_substr(sanitize_text_field((string) ($p['lastName'] ?? $user->last_name)), 0, 60);
                    if ($first === '') {
                        return new WP_Error('lm_name', 'Add your first name.', ['status' => 400]);
                    }
                    $update['first_name'] = $first;
                    $update['last_name'] = $last;
                    $update['display_name'] = trim("$first $last");
                }
                if (array_key_exists('phone', $p)) {
                    $phone = lm_clean_phone($p['phone']);
                    if ($phone !== '' && !preg_match('/^\+?[\d\s-]{10,16}$/', $phone)) {
                        return new WP_Error('lm_phone', 'Enter a 10-digit phone number, e.g. 98765 43210.', ['status' => 400]);
                    }
                    update_user_meta($uid, 'lm_phone', $phone);
                }
                if (array_key_exists('address', $p)) {
                    update_user_meta($uid, 'lm_address', mb_substr(sanitize_text_field((string) $p['address']), 0, 200));
                }
                if (array_key_exists('localityId', $p)) {
                    $lid = (int) $p['localityId'];
                    if ($lid && !$wpdb->get_var($wpdb->prepare('SELECT Id FROM ' . lm_table('localities_c') . ' WHERE Id = %d', $lid))) {
                        return new WP_Error('lm_locality', 'Pick a locality from the list.', ['status' => 400]);
                    }
                    update_user_meta($uid, 'lm_locality', $lid ?: '');
                }
                if (array_key_exists('communityId', $p)) {
                    $cid = (int) $p['communityId'];
                    if ($cid && !$wpdb->get_var($wpdb->prepare('SELECT Id FROM ' . lm_table('communities_c') . ' WHERE Id = %d', $cid))) {
                        return new WP_Error('lm_community', 'Pick a community from the list.', ['status' => 400]);
                    }
                    update_user_meta($uid, 'lm_community', $cid ?: '');
                }
                if (array_key_exists('useGravatar', $p)) {
                    if ($p['useGravatar']) {
                        delete_user_meta($uid, 'lm_no_gravatar');
                    } else {
                        update_user_meta($uid, 'lm_no_gravatar', 1);
                    }
                }
                if (array_key_exists('prefs', $p) && is_array($p['prefs'])) {
                    // Only known settings, kept small.
                    $prefs = (array) lm_user_prefs($user);
                    if (isset($p['prefs']['navCollapsed']) && is_array($p['prefs']['navCollapsed'])) {
                        $prefs['navCollapsed'] = array_slice(array_values(array_map(fn($v) => mb_substr(sanitize_text_field((string) $v), 0, 40), $p['prefs']['navCollapsed'])), 0, 20);
                    }
                    update_user_meta($uid, 'lm_prefs', wp_json_encode($prefs));
                }
                if (count($update) > 1) {
                    $res = wp_update_user($update);
                    if (is_wp_error($res)) {
                        return new WP_Error('lm_save', 'We couldn\'t save your details. Try again.', ['status' => 500]);
                    }
                }
                return ['profile' => lm_me_payload(get_user_by('id', $uid)), 'user' => lm_user_payload(get_user_by('id', $uid))];
            },
        ],
    ]);

    register_rest_route($ns, '/me/avatar', [
        [
            'methods' => 'POST',
            'permission_callback' => 'lm_me_required',
            'callback' => 'lm_avatar_upload',
        ],
        [
            'methods' => 'DELETE',
            'permission_callback' => 'lm_me_required',
            'callback' => function () {
                $user = wp_get_current_user();
                lm_avatar_delete_file($user->ID);
                delete_user_meta($user->ID, 'lm_avatar');
                $u = get_user_by('id', $user->ID);
                return ['profile' => lm_me_payload($u), 'user' => lm_user_payload($u)];
            },
        ],
    ]);

    register_rest_route($ns, '/me/email', [
        'methods' => 'POST',
        'permission_callback' => 'lm_me_required',
        'callback' => function (WP_REST_Request $r) {
            $ok = lm_throttle('me_email', 6, 3600);
            if (is_wp_error($ok)) {
                return $ok;
            }
            $user = wp_get_current_user();
            $email = sanitize_email((string) $r->get_param('email'));
            if (!wp_check_password((string) $r->get_param('password'), $user->user_pass, $user->ID)) {
                return new WP_Error('lm_password', 'That password isn\'t right.', ['status' => 403]);
            }
            if (!is_email($email)) {
                return new WP_Error('lm_email', 'Enter a valid email address.', ['status' => 400]);
            }
            $other = email_exists($email);
            if ($other && (int) $other !== (int) $user->ID) {
                return new WP_Error('lm_exists', 'Another account already uses this email.', ['status' => 409]);
            }
            $old = $user->user_email;
            $res = wp_update_user(['ID' => $user->ID, 'user_email' => $email]);
            if (is_wp_error($res)) {
                return new WP_Error('lm_save', 'We couldn\'t change your email. Try again.', ['status' => 500]);
            }
            if ($old && strcasecmp($old, $email) !== 0) {
                lm_send_template('n_email_changed', $old, lm_email_ctx_user($user) + ['new_email' => $email], ['ref' => $user->ID, 'user' => $user->ID, 'force' => true]);
            }
            return ['user' => lm_user_payload(get_user_by('id', $user->ID))];
        },
    ]);

    register_rest_route($ns, '/me/password', [
        'methods' => 'POST',
        'permission_callback' => 'lm_me_required',
        'callback' => function (WP_REST_Request $r) {
            $ok = lm_throttle('me_password', 6, 3600);
            if (is_wp_error($ok)) {
                return $ok;
            }
            $user = wp_get_current_user();
            $new = (string) $r->get_param('newPassword');
            if (!wp_check_password((string) $r->get_param('currentPassword'), $user->user_pass, $user->ID)) {
                return new WP_Error('lm_password', 'Your current password isn\'t right.', ['status' => 403]);
            }
            if (strlen($new) < 8) {
                return new WP_Error('lm_short', 'Use at least 8 characters for your new password.', ['status' => 400]);
            }
            // Changing the password signs out every device; sign this one straight back in.
            wp_set_password($new, $user->ID);
            wp_set_current_user($user->ID);
            wp_set_auth_cookie($user->ID, true, is_ssl());
            return ['ok' => true];
        },
    ]);

    register_rest_route($ns, '/me/signout-others', [
        'methods' => 'POST',
        'permission_callback' => 'lm_me_required',
        'callback' => function () {
            $manager = WP_Session_Tokens::get_instance(get_current_user_id());
            $manager->destroy_others(wp_get_session_token());
            return ['ok' => true];
        },
    ]);

    register_rest_route($ns, '/me/export', [
        'methods' => 'GET',
        'permission_callback' => 'lm_me_required',
        'callback' => function () {
            nocache_headers();
            $user = wp_get_current_user();
            $uid = (int) $user->ID;
            $own = ['op' => 'eq', 'f' => 'Owner', 'v' => $uid];
            $data = ['exportedOn' => gmdate('c'), 'profile' => lm_me_payload($user)];
            foreach (['bookings_c' => 'bookings', 'reviews_c' => 'reviews', 'complaints_c' => 'complaints', 'proposals_c' => 'proposals'] as $t => $key) {
                try {
                    $res = lm_run_select($t, $user, ['where' => $own, 'size' => 200]);
                    $data[$key] = $res['data'];
                } catch (Exception $e) {
                    $data[$key] = [];
                }
            }
            if (lm_profile_of($user) === 'Vendor_c') {
                $res = lm_run_select('payouts_c', $user, ['size' => 200]);
                $data['payouts'] = $res['data'];
            }
            return $data;
        },
    ]);

    register_rest_route($ns, '/me/delete-request', [
        'methods' => 'POST',
        'permission_callback' => 'lm_me_required',
        'callback' => function () {
            $user = wp_get_current_user();
            if (user_can($user, 'manage_options')) {
                return new WP_Error('lm_owner', 'The site owner account can\'t be deleted from here.', ['status' => 400]);
            }
            if (!get_user_meta($user->ID, 'lm_delete_requested', true)) {
                update_user_meta($user->ID, 'lm_delete_requested', gmdate('Y-m-d'));
                $name = trim($user->first_name . ' ' . $user->last_name) ?: $user->user_email;
                foreach (lm_team_recipients() as $to) {
                    lm_send_template('t_deletion_request', $to, lm_email_ctx_user($user) + ['name' => $name, 'role' => lm_profile_of($user)], ['ref' => $user->ID, 'force' => true]);
                }
            }
            return ['profile' => lm_me_payload(get_user_by('id', $user->ID))];
        },
    ]);

    register_rest_route($ns, '/me/delete-request/cancel', [
        'methods' => 'POST',
        'permission_callback' => 'lm_me_required',
        'callback' => function () {
            delete_user_meta(get_current_user_id(), 'lm_delete_requested');
            return ['profile' => lm_me_payload(wp_get_current_user())];
        },
    ]);
}


function lm_avatar_delete_file($uid)
{
    $path = (string) get_user_meta($uid, 'lm_avatar', true);
    if ($path !== '') {
        $file = wp_upload_dir()['basedir'] . '/' . ltrim($path, '/');
        if (strpos(realpath(dirname($file)) ?: '', realpath(wp_upload_dir()['basedir']) ?: '-') === 0 && is_file($file)) {
            @unlink($file);
        }
    }
}

/** Save a square profile photo for the signed-in person. JPG, PNG or WebP, up to 3 MB. */
function lm_avatar_upload(WP_REST_Request $r)
{
    $ok = lm_throttle('avatar', 12, 3600);
    if (is_wp_error($ok)) {
        return $ok;
    }
    $user = wp_get_current_user();
    $files = $r->get_file_params();
    $f = $files['file'] ?? null;
    if (!$f || !empty($f['error']) || !is_uploaded_file($f['tmp_name'])) {
        return new WP_Error('lm_avatar', 'Choose a photo to upload.', ['status' => 400]);
    }
    if ($f['size'] > 3 * MB_IN_BYTES) {
        return new WP_Error('lm_avatar', 'That photo is over 3 MB. Choose a smaller one.', ['status' => 400]);
    }
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) {
        return new WP_Error('lm_avatar', 'Use a JPG, PNG or WebP photo.', ['status' => 400]);
    }
    require_once ABSPATH . 'wp-admin/includes/image.php';
    $editor = wp_get_image_editor($f['tmp_name']);
    if (is_wp_error($editor)) {
        return new WP_Error('lm_avatar', 'We couldn\'t read that photo. Try another one.', ['status' => 400]);
    }
    if (method_exists($editor, 'maybe_exif_rotate')) {
        $editor->maybe_exif_rotate();
    }
    $editor->resize(320, 320, true);
    $editor->set_quality(85);
    $up = wp_upload_dir();
    $dir = $up['basedir'] . '/lotmates-avatars';
    wp_mkdir_p($dir);
    if (!file_exists($dir . '/index.html')) {
        @file_put_contents($dir . '/index.html', '');
    }
    $name = $user->ID . '-' . wp_generate_password(10, false, false) . '.jpg';
    $saved = $editor->save($dir . '/' . $name, 'image/jpeg');
    if (is_wp_error($saved)) {
        return new WP_Error('lm_avatar', 'We couldn\'t save that photo. Try again.', ['status' => 500]);
    }
    lm_avatar_delete_file($user->ID);
    update_user_meta($user->ID, 'lm_avatar', 'lotmates-avatars/' . $name);
    $u = get_user_by('id', $user->ID);
    return ['profile' => lm_me_payload($u), 'user' => lm_user_payload($u)];
}
