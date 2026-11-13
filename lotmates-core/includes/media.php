<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Deal photos. The team uploads images into the WordPress media library; a deal keeps an
 * ordered list of {id, caption}. Image addresses are always worked out here from the
 * attachment, never taken from the browser.
 */

const LM_GALLERY_MAX = 8;

function lm_gallery_item($id, $caption = '')
{
    $id = (int) $id;
    if (!$id || get_post_type($id) !== 'attachment' || strpos((string) get_post_mime_type($id), 'image/') !== 0) {
        return null;
    }
    $full = wp_get_attachment_image_src($id, 'full');
    $large = wp_get_attachment_image_src($id, 'large');
    $medium = wp_get_attachment_image_src($id, 'medium_large');
    $thumb = wp_get_attachment_image_src($id, 'medium');
    if (!$full) {
        return null;
    }
    return [
        'id' => $id,
        'full' => $full[0],
        'large' => $large ? $large[0] : $full[0],
        'medium' => $medium ? $medium[0] : ($large ? $large[0] : $full[0]),
        'thumb' => $thumb ? $thumb[0] : $full[0],
        'width' => (int) $full[1],
        'height' => (int) $full[2],
        'caption' => mb_substr(sanitize_text_field((string) $caption), 0, 140),
    ];
}

/** Validate an incoming gallery and return it as stored JSON (or null when empty). */
function lm_clean_gallery($v)
{
    if (is_string($v)) {
        $v = json_decode($v, true);
    }
    if (!is_array($v)) {
        return null;
    }
    $out = [];
    $seen = [];
    foreach ($v as $item) {
        $id = is_array($item) ? (int) ($item['id'] ?? 0) : (int) $item;
        if (!$id || isset($seen[$id])) {
            continue;
        }
        $clean = lm_gallery_item($id, is_array($item) ? ($item['caption'] ?? '') : '');
        if ($clean) {
            $out[] = $clean;
            $seen[$id] = true;
        }
        if (count($out) >= LM_GALLERY_MAX) {
            break;
        }
    }
    return $out ? wp_json_encode($out) : null;
}

function lm_register_media_routes()
{
    register_rest_route('lotmates/v1', '/media', [
        'methods' => 'POST',
        'permission_callback' => function () {
            $u = wp_get_current_user();
            return lm_is_admin($u) || lm_profile_of($u) === 'Vendor_c' ? true : new WP_Error('lm_forbidden', 'Only the Lotmates team and vendors can add deal photos.', ['status' => 403]);
        },
        'callback' => function (WP_REST_Request $r) {
            $files = $r->get_file_params();
            if (empty($files['file']) || !empty($files['file']['error'])) {
                return new WP_Error('lm_file', 'Choose a photo to upload.', ['status' => 400]);
            }
            $f = $files['file'];
            if ((int) $f['size'] > 8 * 1024 * 1024) {
                return new WP_Error('lm_big', 'That photo is over 8 MB. Use a smaller one.', ['status' => 400]);
            }
            $type = wp_check_filetype_and_ext($f['tmp_name'], $f['name'], ['jpg|jpeg|jpe' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp']);
            if (empty($type['type'])) {
                return new WP_Error('lm_type', 'Use a JPG, PNG or WebP photo.', ['status' => 400]);
            }
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
            $_FILES['lm_upload'] = $f;
            $title = sanitize_text_field((string) $r->get_param('title'));
            $id = media_handle_upload('lm_upload', 0, $title ? ['post_title' => $title] : [], [
                'test_form' => false,
                'mimes' => ['jpg|jpeg|jpe' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'],
            ]);
            if (is_wp_error($id)) {
                return new WP_Error('lm_upload', 'The photo didn\'t upload: ' . $id->get_error_message(), ['status' => 500]);
            }
            return lm_gallery_item($id, '');
        },
    ]);
}

/** Accept a YouTube or Vimeo link and store it in one standard form, or nothing. */
function lm_parse_video($url)
{
    $url = trim((string) $url);
    if ($url === '') {
        return null;
    }
    if (preg_match('~(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})~', $url, $m)) {
        return ['provider' => 'youtube', 'id' => $m[1], 'url' => 'https://www.youtube.com/watch?v=' . $m[1]];
    }
    if (preg_match('~vimeo\.com/(?:video/)?(\d{6,12})~', $url, $m)) {
        return ['provider' => 'vimeo', 'id' => $m[1], 'url' => 'https://vimeo.com/' . $m[1]];
    }
    return null;
}

function lm_clean_video($v)
{
    $p = lm_parse_video(is_array($v) ? ($v['url'] ?? '') : $v);
    return $p ? $p['url'] : null;
}
