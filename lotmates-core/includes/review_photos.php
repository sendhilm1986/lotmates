<?php
/**
 * Photos on reviews and complaints. The browser shrinks and re-encodes each photo before upload; the server
 * re-encodes it again (WebP when available) at a fixed size and makes a small thumbnail, which
 * also drops any location data a phone camera stored in the file. Photos wait as "pending"
 * until the review is saved, and pending ones nobody used are deleted after a day.
 */
if (!defined('ABSPATH')) {
    exit;
}

const LM_REVIEW_PHOTO_MAX = 4;     // per review
const LM_REVIEW_PHOTO_EDGE = 1600; // longest side, in pixels
const LM_REVIEW_THUMB_EDGE = 400;

function lm_review_photo_dir($uid)
{
    $up = wp_upload_dir();
    $rel = 'lotmates-reviews/u' . (int) $uid;
    $dir = $up['basedir'] . '/' . $rel;
    if (!is_dir($dir)) {
        wp_mkdir_p($dir);
        @file_put_contents($up['basedir'] . '/lotmates-reviews/index.html', '');
        @file_put_contents($dir . '/index.html', '');
    }
    return [$dir, $up['baseurl'] . '/' . $rel, $rel];
}

function lm_review_pending($uid)
{
    $p = get_user_meta($uid, 'lm_review_pending', true);
    return is_array($p) ? $p : [];
}

/** Delete a stored photo's files. Only ever touches files inside lotmates-reviews. */
function lm_review_photo_delete($photo)
{
    $base = wp_upload_dir()['basedir'];
    $root = realpath($base . '/lotmates-reviews');
    foreach (['file', 'thumbFile'] as $k) {
        if (empty($photo[$k])) {
            continue;
        }
        $path = $base . '/' . ltrim((string) $photo[$k], '/');
        $real = realpath($path);
        if ($real && $root && strpos($real, $root) === 0 && is_file($real)) {
            @unlink($real);
        }
    }
}

/** Re-encode an image at a size, as WebP if the server can, else JPEG. Returns [path, mime, w, h] or WP_Error. */
function lm_review_encode($src, $dest_noext, $edge, $quality)
{
    $ed = wp_get_image_editor($src);
    if (is_wp_error($ed)) {
        return $ed;
    }
    if (method_exists($ed, 'maybe_exif_rotate')) {
        $ed->maybe_exif_rotate();
    }
    $size = $ed->get_size();
    if (max($size['width'], $size['height']) > $edge) {
        $ed->resize($edge, $edge, false);
    }
    $ed->set_quality($quality);
    $out = $ed->save($dest_noext . '.webp', 'image/webp');
    if (is_wp_error($out)) {
        $out = $ed->save($dest_noext . '.jpg', 'image/jpeg');
    }
    if (is_wp_error($out)) {
        return $out;
    }
    return [$out['path'], $out['mime-type'], (int) $out['width'], (int) $out['height']];
}

/** Signed-in bookers: upload one photo for a review they're writing. */
function lm_review_photo_upload(WP_REST_Request $r)
{
    $user = wp_get_current_user();
    if (!$user->ID || !in_array(lm_profile_of($user), ['Customer_c', 'Ambassador_c'], true)) {
        return new WP_Error('lm_forbidden', 'Sign in with the account you booked with to add photos.', ['status' => 403]);
    }
    $ok = lm_throttle('review_photo', 30, 3600);
    if (is_wp_error($ok)) {
        return $ok;
    }
    $pending = lm_review_pending($user->ID);
    if (count($pending) >= 8) {
        return new WP_Error('lm_photo', 'Save what you\'re writing before adding more photos.', ['status' => 400]);
    }
    $f = $r->get_file_params()['file'] ?? null;
    if (!$f || !empty($f['error']) || !is_uploaded_file($f['tmp_name'])) {
        return new WP_Error('lm_photo', 'Choose a photo to upload.', ['status' => 400]);
    }
    // Photos arrive already shrunk by the browser, so anything big is unexpected.
    if ($f['size'] > 4 * MB_IN_BYTES) {
        return new WP_Error('lm_photo', 'That photo is too large. Try another one.', ['status' => 400]);
    }
    $info = @getimagesize($f['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        return new WP_Error('lm_photo', 'Use a JPG, PNG or WebP photo.', ['status' => 400]);
    }
    require_once ABSPATH . 'wp-admin/includes/image.php';
    [$dir, $url, $rel] = lm_review_photo_dir($user->ID);
    $id = strtolower(wp_generate_password(12, false, false));
    $big = lm_review_encode($f['tmp_name'], $dir . '/' . $id, LM_REVIEW_PHOTO_EDGE, 80);
    if (is_wp_error($big)) {
        return new WP_Error('lm_photo', 'We couldn\'t read that photo. Try another one.', ['status' => 400]);
    }
    $thumb = lm_review_encode($big[0], $dir . '/' . $id . '-t', LM_REVIEW_THUMB_EDGE, 75);
    if (is_wp_error($thumb)) {
        $thumb = $big;
    }
    $photo = [
        'id' => $id,
        'src' => $url . '/' . basename($big[0]),
        'thumb' => $url . '/' . basename($thumb[0]),
        'w' => $big[2],
        'h' => $big[3],
        'file' => $rel . '/' . basename($big[0]),
        'thumbFile' => $rel . '/' . basename($thumb[0]),
        'bytes' => (int) @filesize($big[0]),
        'at' => time(),
    ];
    $pending[$id] = $photo;
    update_user_meta($user->ID, 'lm_review_pending', $pending);
    return ['id' => $id, 'src' => $photo['src'], 'thumb' => $photo['thumb'], 'w' => $photo['w'], 'h' => $photo['h'], 'bytes' => $photo['bytes']];
}

/** Drop a pending photo the person removed before saving. */
function lm_review_photo_discard(WP_REST_Request $r)
{
    $user = wp_get_current_user();
    $id = (string) $r['id'];
    $pending = lm_review_pending($user->ID);
    if (isset($pending[$id])) {
        lm_review_photo_delete($pending[$id]);
        unset($pending[$id]);
        update_user_meta($user->ID, 'lm_review_pending', $pending);
    }
    return ['ok' => true];
}

/**
 * Turn the photo ids a review form sent into the stored list. Ids must be this person's
 * pending uploads or photos already on this review. Photos taken off the review are deleted.
 * Returns the JSON to store, or an error message.
 */
function lm_review_photos_resolve($ids, $user, $existing_json)
{
    $ids = array_values(array_unique(array_filter(array_map('strval', is_array($ids) ? $ids : []))));
    if (count($ids) > LM_REVIEW_PHOTO_MAX) {
        return 'Add up to ' . LM_REVIEW_PHOTO_MAX . ' photos.';
    }
    $existing = [];
    foreach ((array) json_decode((string) $existing_json, true) as $p) {
        if (!empty($p['id'])) {
            $existing[$p['id']] = $p;
        }
    }
    $pending = lm_review_pending($user->ID);
    $out = [];
    foreach ($ids as $id) {
        if (isset($existing[$id])) {
            $out[] = $existing[$id];
        } elseif (isset($pending[$id])) {
            $p = $pending[$id];
            unset($p['at']);
            $out[] = $p;
            unset($pending[$id]);
        } else {
            return 'One of the photos has expired. Remove it and add it again.';
        }
    }
    foreach ($existing as $id => $p) {
        if (!in_array($id, $ids, true)) {
            lm_review_photo_delete($p);
        }
    }
    update_user_meta($user->ID, 'lm_review_pending', $pending);
    return $out ? wp_json_encode($out) : null;
}

// A deleted review takes its photos with it.
function lm_review_photos_purge($review)
{
    foreach ((array) json_decode((string) ($review['photos_c'] ?? ''), true) as $p) {
        lm_review_photo_delete($p);
    }
}

// Pending photos nobody saved into a review are removed after a day.
add_action('lm_hourly', function () {
    $users = get_users(['meta_key' => 'lm_review_pending', 'fields' => 'ID', 'number' => 200]);
    $cutoff = time() - DAY_IN_SECONDS;
    foreach ($users as $uid) {
        $pending = lm_review_pending($uid);
        $keep = [];
        foreach ($pending as $id => $p) {
            if (($p['at'] ?? 0) < $cutoff) {
                lm_review_photo_delete($p);
            } else {
                $keep[$id] = $p;
            }
        }
        if ($keep) {
            update_user_meta($uid, 'lm_review_pending', $keep);
        } else {
            delete_user_meta($uid, 'lm_review_pending');
        }
    }
}, 40);

function lm_register_review_photo_routes()
{
    $ns = 'lotmates/v1';
    register_rest_route($ns, '/review-photos', [
        'methods' => 'POST',
        'permission_callback' => 'is_user_logged_in',
        'callback' => 'lm_review_photo_upload',
    ]);
    register_rest_route($ns, '/review-photos/(?P<id>[a-z0-9]{12})', [
        'methods' => 'DELETE',
        'permission_callback' => 'is_user_logged_in',
        'callback' => 'lm_review_photo_discard',
    ]);
}
