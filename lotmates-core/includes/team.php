<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * The team page: invite the Lotmates team, vendors and ambassadors, change what someone can
 * do, or take their access away. Invites are single-use links that last 7 days; only a hash
 * of each link is stored.
 */

const LM_INVITE_DAYS = 7;
const LM_TEAM_PROFILES = ['Admin_c', 'Vendor_c', 'Ambassador_c'];

function lm_role_for_profile($profile)
{
    $map = array_flip(LM_ROLE_PROFILES);
    return $map[$profile] ?? null;
}

function lm_profile_label($profile)
{
    return ['Admin_c' => 'Lotmates team', 'Vendor_c' => 'Vendor', 'Ambassador_c' => 'Ambassador', 'Customer_c' => 'Neighbour'][$profile] ?? 'Member';
}

function lm_invites()
{
    $all = get_option('lm_invites', []);
    // Drop expired invites as we go.
    $now = time();
    $live = array_filter($all, fn($i) => ($i['expires'] ?? 0) > $now);
    if (count($live) !== count($all)) {
        update_option('lm_invites', $live, false);
    }
    return $live;
}

function lm_invite_by_token($token)
{
    $hash = hash('sha256', (string) $token);
    foreach (lm_invites() as $id => $inv) {
        if (hash_equals($inv['hash'], $hash)) {
            return [$id, $inv];
        }
    }
    return [null, null];
}

function lm_invite_send($id)
{
    $all = lm_invites();
    if (!isset($all[$id])) {
        return false;
    }
    $token = wp_generate_password(40, false, false);
    $all[$id]['hash'] = hash('sha256', $token);
    $all[$id]['expires'] = time() + LM_INVITE_DAYS * DAY_IN_SECONDS;
    $all[$id]['count'] = (int) ($all[$id]['count'] ?? 0) + 1;
    $all[$id]['sentOn'] = gmdate('Y-m-d H:i:s');
    update_option('lm_invites', $all, false);
    $inv = $all[$id];
    $by = get_user_by('id', (int) $inv['invitedBy']);
    $ctx = [
        'email' => $inv['email'],
        'role' => lm_profile_label($inv['profile']),
        'inviter' => $by ? (trim($by->first_name . ' ' . $by->last_name) ?: $by->display_name) : 'The Lotmates team',
        'invite_link' => LM_SITE_URL . '/accept-invite?token=' . $token,
        'expires_on' => lm_ist_date(gmdate('Y-m-d H:i:s', $inv['expires']), 'j M'),
    ];
    return lm_send_template('x_team_invite', $inv['email'], $ctx, ['ref' => null, 'force' => true]);
}

/**
 * Give someone a team, vendor or ambassador role: straight away if they already have an
 * account (usually as a neighbour), otherwise by emailing an invite to set up their account.
 */
function lm_grant_or_invite($email, $profile)
{
    $existing = get_user_by('email', $email);
    if ($existing) {
        if (user_can($existing, 'manage_options')) {
            return new WP_Error('lm_exists', 'That is the site owner account.', ['status' => 400]);
        }
        $existing->set_role(lm_role_for_profile($profile));
        lm_send_template('x_access_granted', $email, lm_email_ctx_user($existing) + [
            'role' => lm_profile_label($profile),
            'signin_link' => LM_SITE_URL . '/' . ['Admin_c' => 'admin', 'Vendor_c' => 'vendor', 'Ambassador_c' => 'ambassador'][$profile] . '/login',
        ], ['ref' => $existing->ID, 'user' => $existing->ID, 'force' => true]);
        return ['existing' => true, 'userId' => $existing->ID, 'message' => $email . ' already had an account. They now have ' . lm_profile_label($profile) . ' access.'];
    }
    $all = lm_invites();
    foreach ($all as $id => $inv) {
        if ($inv['email'] === $email) {
            $all[$id]['profile'] = $profile;
            update_option('lm_invites', $all, false);
            return lm_invite_send($id) ? ['resent' => true] : new WP_Error('lm_mail', 'The invite email could not be sent from this server.', ['status' => 500]);
        }
    }
    $id = 'inv_' . wp_generate_password(10, false, false);
    $all[$id] = ['email' => $email, 'profile' => $profile, 'hash' => '', 'expires' => time() + 60, 'count' => 0, 'createdOn' => gmdate('Y-m-d H:i:s'), 'invitedBy' => get_current_user_id()];
    update_option('lm_invites', $all, false);
    if (!lm_invite_send($id)) {
        return new WP_Error('lm_mail', 'The invite was saved but the email could not be sent. Try Resend.', ['status' => 500]);
    }
    return ['invited' => true];
}

function lm_member_payload($u)
{
    $profile = lm_profile_of($u);
    return [
        'id' => (string) $u->ID,
        'name' => trim($u->first_name . ' ' . $u->last_name) ?: $u->display_name,
        'email' => $u->user_email,
        'profile' => ['name' => $profile, 'label' => lm_profile_label($profile)],
        'isOwner' => user_can($u, 'manage_options'),
        'createdOn' => gmdate('Y-m-d\TH:i:s\Z', strtotime($u->user_registered . ' UTC')),
    ];
}

function lm_register_team_routes()
{
    $ns = 'lotmates/v1';
    $admin = function () {
        return lm_is_admin(wp_get_current_user()) ? true : new WP_Error('lm_forbidden', 'Only the Lotmates team can manage the team.', ['status' => 403]);
    };

    register_rest_route($ns, '/team/members', [
        'methods' => 'GET',
        'permission_callback' => $admin,
        'callback' => function () {
            $users = get_users(['role__in' => ['lm_admin', 'lm_vendor', 'lm_ambassador', 'administrator'], 'orderby' => 'registered', 'order' => 'ASC']);
            return ['data' => array_map('lm_member_payload', $users)];
        },
    ]);

    register_rest_route($ns, '/team/members/(?P<id>\d+)', [
        [
            'methods' => 'POST',
            'permission_callback' => $admin,
            'callback' => function (WP_REST_Request $r) {
                $u = get_user_by('id', (int) $r['id']);
                $profile = (string) $r->get_param('profile');
                $role = lm_role_for_profile($profile);
                if (!$u || !$role) {
                    return new WP_Error('lm_member', 'Member not found.', ['status' => 404]);
                }
                if ((int) $u->ID === get_current_user_id() || user_can($u, 'manage_options')) {
                    return new WP_Error('lm_member', "You can't change this account's role here.", ['status' => 400]);
                }
                $u->set_role($role);
                return ['data' => lm_member_payload(get_user_by('id', $u->ID))];
            },
        ],
        [
            'methods' => 'DELETE',
            'permission_callback' => $admin,
            'callback' => function (WP_REST_Request $r) {
                $u = get_user_by('id', (int) $r['id']);
                if (!$u) {
                    return new WP_Error('lm_member', 'Member not found.', ['status' => 404]);
                }
                if ((int) $u->ID === get_current_user_id() || user_can($u, 'manage_options')) {
                    return new WP_Error('lm_member', "You can't remove this account.", ['status' => 400]);
                }
                // Access goes; the account stays as a neighbour so bookings and records keep their owner.
                $u->set_role('lm_customer');
                WP_Session_Tokens::get_instance($u->ID)->destroy_all();
                return ['ok' => true];
            },
        ],
    ]);

    register_rest_route($ns, '/team/invites', [
        [
            'methods' => 'GET',
            'permission_callback' => $admin,
            'callback' => function () {
                $out = [];
                foreach (lm_invites() as $id => $inv) {
                    $out[] = [
                        'invitationId' => $id,
                        'invitedEmail' => $inv['email'],
                        'profile' => ['name' => $inv['profile'], 'label' => lm_profile_label($inv['profile'])],
                        'createdOn' => gmdate('Y-m-d\TH:i:s\Z', strtotime(($inv['sentOn'] ?? $inv['createdOn']) . ' UTC')),
                        'expiresOn' => gmdate('Y-m-d\TH:i:s\Z', $inv['expires']),
                        'invitationCount' => (int) ($inv['count'] ?? 1),
                    ];
                }
                usort($out, fn($a, $b) => strcmp($b['createdOn'], $a['createdOn']));
                return ['data' => $out];
            },
        ],
        [
            'methods' => 'POST',
            'permission_callback' => $admin,
            'callback' => function (WP_REST_Request $r) {
                $email = strtolower(sanitize_email((string) $r->get_param('email')));
                $profile = (string) $r->get_param('profile');
                if (!is_email($email)) {
                    return new WP_Error('lm_email', 'Enter a valid email address.', ['status' => 400]);
                }
                if (!in_array($profile, LM_TEAM_PROFILES, true)) {
                    return new WP_Error('lm_role', 'Pick a role: Lotmates team, Vendor or Ambassador.', ['status' => 400]);
                }
                return lm_grant_or_invite($email, $profile);
            },
        ],
    ]);

    register_rest_route($ns, '/team/invites/(?P<id>inv_[A-Za-z0-9]+)', [
        [
            'methods' => 'POST',
            'permission_callback' => $admin,
            'callback' => function (WP_REST_Request $r) {
                return lm_invite_send($r['id']) ? ['resent' => true] : new WP_Error('lm_invite', 'That invite has expired or was cancelled. Invite them again.', ['status' => 404]);
            },
        ],
        [
            'methods' => 'DELETE',
            'permission_callback' => $admin,
            'callback' => function (WP_REST_Request $r) {
                $all = get_option('lm_invites', []);
                unset($all[$r['id']]);
                update_option('lm_invites', $all, false);
                return ['ok' => true];
            },
        ],
    ]);

    // Public: look at and accept an invite.
    register_rest_route($ns, '/invite', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            [, $inv] = lm_invite_by_token((string) $r->get_param('token'));
            if (!$inv) {
                return new WP_Error('lm_invite', 'This invite link has expired or was already used. Ask the Lotmates team for a new one.', ['status' => 404]);
            }
            return ['email' => $inv['email'], 'profile' => $inv['profile'], 'role' => lm_profile_label($inv['profile'])];
        },
    ]);

    register_rest_route($ns, '/invite/accept', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $ok = lm_throttle('invite', 10, 3600);
            if (is_wp_error($ok)) {
                return $ok;
            }
            [$id, $inv] = lm_invite_by_token((string) $r->get_param('token'));
            if (!$inv) {
                return new WP_Error('lm_invite', 'This invite link has expired or was already used. Ask the Lotmates team for a new one.', ['status' => 404]);
            }
            $first = mb_substr(sanitize_text_field((string) $r->get_param('firstName')), 0, 60);
            $last = mb_substr(sanitize_text_field((string) $r->get_param('lastName')), 0, 60);
            $password = (string) $r->get_param('password');
            if ($first === '') {
                return new WP_Error('lm_name', 'Add your first name.', ['status' => 400]);
            }
            if (strlen($password) < 8) {
                return new WP_Error('lm_password', 'Use at least 8 characters for your password.', ['status' => 400]);
            }
            if (email_exists($inv['email'])) {
                return new WP_Error('lm_exists', 'An account with this email already exists. Sign in instead.', ['status' => 409]);
            }
            $uid = wp_insert_user([
                'user_login' => $inv['email'],
                'user_email' => $inv['email'],
                'user_pass' => $password,
                'first_name' => $first,
                'last_name' => $last,
                'display_name' => trim("$first $last"),
                'role' => lm_role_for_profile($inv['profile']),
            ]);
            if (is_wp_error($uid)) {
                return new WP_Error('lm_signup', 'We couldn\'t create your account. Try again.', ['status' => 500]);
            }
            $all = get_option('lm_invites', []);
            unset($all[$id]);
            update_option('lm_invites', $all, false);
            do_action('lm_invite_accepted', (int) $uid, $inv);
            $user = wp_signon(['user_login' => $inv['email'], 'user_password' => $password, 'remember' => true], is_ssl());
            return ['user' => is_wp_error($user) ? null : lm_user_payload($user)];
        },
    ]);
}
