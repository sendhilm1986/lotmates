<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Link preview images (1200 x 630) for WhatsApp, X/Twitter, Facebook and LinkedIn.
 * Each deal gets its own card: photo, title, current price and how many neighbours joined.
 * Cards are cached and redrawn only when the price, count or photo changes.
 */

const LM_OG_PHOTOS = [
    'Health' => ['photo-1639772823849-6efbd173043c', 'photo-1615461066159-fea0960485d5'],
    'Cleaning' => ['photo-1686178827149-6d55c72d81df', 'photo-1740657254989-42fe9c3b8cce'],
    'Solar' => ['photo-1613665813446-82a78c468a1d', 'photo-1658298775754-5839ffd434cc'],
    'Products' => ['photo-1586208958839-06c17cacdf08', 'photo-1484154218962-a197022b5858'],
    'Pest' => ['photo-1747659629851-a92bd71149f6', 'photo-1581578017093-cd30fce4eeb7'],
    'AC' => ['photo-1718203862467-c33159fdc504', 'photo-1700124113583-81aa99ea2aa2'],
];

/** Same pick as the front end, so the card matches the photo people see on the page. */
function lm_og_stock_id($category, $seed)
{
    $list = LM_OG_PHOTOS[$category] ?? LM_OG_PHOTOS['Cleaning'];
    $h = 0;
    $s = (string) $seed;
    for ($i = 0; $i < strlen($s); $i++) {
        $h = ($h * 31 + ord($s[$i])) & 0xFFFFFFFF;
    }
    return $list[$s === '' ? 0 : $h % count($list)];
}

function lm_og_inr($n)
{
    return '₹' . preg_replace('/^INR /', '', lm_money($n, 0));
}

/** The facts a share card and the page's meta tags both use. */
function lm_og_facts($deal)
{
    $st = lm_deal_state($deal);
    $price = $st['current']['price'] ?? null;
    $tiers = $st['tiers'] ?? [];
    $best = $tiers ? end($tiers)['price'] : null;
    $next = $tiers[$st['reached']] ?? null;
    $min = (int) ($deal['minHomes_c'] ?? 0);
    $unit = preg_replace('/^per\s+/i', '', (string) ($deal['unit_c'] ?: 'home'));
    $booked = (int) $st['booked'];
    $where = null;
    if ($deal['community_c']) {
        $where = lm_row('communities_c', $deal['community_c'])['Name'] ?? null;
    }
    if (!$where && $deal['locality_c']) {
        $where = lm_row('localities_c', $deal['locality_c'])['Name'] ?? null;
    }
    if ($deal['status_c'] === 'Live') {
        if ($min && $booked < $min) {
            $line = sprintf('%d neighbours in. %d more to go ahead.', $booked, $min - $booked);
        } elseif ($next) {
            $line = sprintf('%d neighbours in. %d more for %s.', $booked, max(1, (int) $next['from'] - $booked), lm_og_inr($next['price']));
        } else {
            $line = sprintf('%d neighbours in. Best price reached.', $booked);
        }
    } elseif ($deal['status_c'] === 'Closed') {
        $line = sprintf('Closed with %d neighbours at the group price.', $booked);
    } else {
        $line = 'This round has ended. Ask for the next one.';
    }
    return [
        'price' => $price,
        'best' => $best,
        'unit' => $unit,
        'booked' => $booked,
        'where' => $where,
        'line' => $line,
        'regular' => (float) $deal['regularPrice_c'],
    ];
}

function lm_og_photo_path($deal)
{
    $gallery = json_decode((string) ($deal['gallery_c'] ?? ''), true);
    if (!empty($gallery[0]['id'])) {
        $meta = image_get_intermediate_size((int) $gallery[0]['id'], 'large');
        $file = $meta && !empty($meta['path']) ? trailingslashit(wp_upload_dir()['basedir']) . $meta['path'] : get_attached_file((int) $gallery[0]['id']);
        if ($file && file_exists($file)) {
            return $file;
        }
    }
    // Stock photo for the category, downloaded once and kept.
    $id = lm_og_stock_id($deal['category_c'], $deal['Id']);
    $dir = trailingslashit(wp_upload_dir()['basedir']) . 'lotmates-og';
    wp_mkdir_p($dir);
    $file = "$dir/stock-$id.jpg";
    if (!file_exists($file)) {
        $res = wp_remote_get("https://images.unsplash.com/$id?w=900&h=1050&fit=crop&fm=jpg&q=80", ['timeout' => 10, 'user-agent' => 'Mozilla/5.0 (compatible; Lotmates/1.0; +https://lotmates.in)']);
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
            return null;
        }
        $body = wp_remote_retrieve_body($res);
        if (!@imagecreatefromstring($body)) {
            return null;
        }
        file_put_contents($file, $body);
    }
    return $file;
}

function lm_og_text($img, $size, $x, $y, $color, $font, $text)
{
    imagettftext($img, $size, 0, (int) $x, (int) $y, $color, $font, $text);
    $box = imagettfbbox($size, 0, $font, $text);
    return $box[2] - $box[0];
}

function lm_og_wrap($text, $size, $font, $max, $lines = 3)
{
    $words = preg_split('/\s+/', trim($text));
    $out = [];
    $line = '';
    foreach ($words as $w) {
        $try = $line === '' ? $w : "$line $w";
        $box = imagettfbbox($size, 0, $font, $try);
        if ($line !== '' && ($box[2] - $box[0]) > $max) {
            $out[] = $line;
            $line = $w;
            if (count($out) === $lines) {
                break;
            }
        } else {
            $line = $try;
        }
    }
    if (count($out) < $lines && $line !== '') {
        $out[] = $line;
    } elseif (count($out) === $lines) {
        $out[$lines - 1] = rtrim($out[$lines - 1], ' ,.') . '…';
    }
    return $out;
}

function lm_og_render($deal, $file)
{
    $W = 1200;
    $H = 630;
    $img = imagecreatetruecolor($W, $H);
    imageantialias($img, true);
    $green = imagecolorallocate($img, 31, 92, 69);
    $deep = imagecolorallocate($img, 23, 72, 54);
    $white = imagecolorallocate($img, 255, 255, 255);
    $soft = imagecolorallocatealpha($img, 255, 255, 255, 30);
    $turmeric = imagecolorallocate($img, 236, 177, 48);
    imagefilledrectangle($img, 0, 0, $W, $H, $green);

    $bold = LM_DIR . 'assets/fonts/BricolageGrotesque-Bold.ttf';
    $text = LM_DIR . 'assets/fonts/SpaceGrotesk-Medium.ttf';
    $facts = lm_og_facts($deal);

    // Photo on the right, cropped to fill.
    $px = 700;
    $photo = lm_og_photo_path($deal);
    if ($photo) {
        $src = @imagecreatefromstring((string) file_get_contents($photo));
        if ($src) {
            $sw = imagesx($src);
            $sh = imagesy($src);
            $tw = $W - $px;
            $scale = max($tw / $sw, $H / $sh);
            $cw = (int) ($tw / $scale);
            $ch = (int) ($H / $scale);
            imagecopyresampled($img, $src, $px, 0, (int) (($sw - $cw) / 2), (int) (($sh - $ch) / 2), $tw, $H, $cw, $ch);
            imagedestroy($src);
        }
    } else {
        imagefilledrectangle($img, $px, 0, $W, $H, $deep);
    }

    // Brand mark and name.
    $mx = 72;
    $my = 82;
    imagefilledellipse($img, $mx + 16, $my, 15, 31, $turmeric);
    imagesetthickness($img, 5);
    imagearc($img, $mx + 8, $my, 36, 36, 0, 360, $white);
    imagearc($img, $mx + 24, $my, 36, 36, 0, 360, $white);
    imagesetthickness($img, 1);
    lm_og_text($img, 26, $mx + 54, $my + 10, $white, $bold, 'lotmates');

    // Title.
    $y = 190;
    $lines = lm_og_wrap($deal['Name'], 44, $bold, 560, 3);
    foreach ($lines as $line) {
        lm_og_text($img, 44, $mx, $y, $white, $bold, $line);
        $y += 60;
    }

    // Price.
    $y += 44;
    if ($facts['price'] !== null) {
        $w = lm_og_text($img, 58, $mx, $y, $turmeric, $bold, lm_og_inr($facts['price']));
        lm_og_text($img, 22, $mx + $w + 16, $y - 4, $soft, $text, 'per ' . $facts['unit']);
        if ($facts['regular'] > $facts['price']) {
            $y += 40;
            $save = round(($facts['regular'] - $facts['price']) / $facts['regular'] * 100);
            lm_og_text($img, 20, $mx, $y, $soft, $text, $save . '% less than booking alone');
        }
    }

    // Who joined, and where.
    $y = $H - 92;
    foreach (lm_og_wrap($facts['line'], 20, $text, 570, 1) as $line) {
        lm_og_text($img, 20, $mx, $y, $white, $text, $line);
    }
    lm_og_text($img, 18, $mx, $H - 56, $soft, $text, ($facts['where'] ? $facts['where'] . ', ' : '') . 'lotmates.in');

    wp_mkdir_p(dirname($file));
    imagepng($img, $file, 6);
    imagedestroy($img);
}

function lm_og_signature($deal)
{
    return substr(md5(implode('|', [$deal['Name'], $deal['status_c'], $deal['bookedHomes_c'], $deal['unlockedTier_c'], $deal['gallery_c'] ?? '', $deal['tier1Price_c'], $deal['regularPrice_c'], '3'])), 0, 10);
}

function lm_og_url($deal)
{
    return rest_url('lotmates/v1/og/deal/' . (int) $deal['Id']) . '?v=' . lm_og_signature($deal);
}

function lm_register_og_routes()
{
    register_rest_route('lotmates/v1', '/og/deal/(?P<id>\d+)', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $r) {
            $deal = lm_row('deals_c', (int) $r['id']);
            $fallback = LM_SITE_URL . '/og-default.png';
            if (!$deal || $deal['status_c'] === 'Draft' || !function_exists('imagettftext')) {
                wp_redirect($fallback, 302);
                exit;
            }
            $dir = trailingslashit(wp_upload_dir()['basedir']) . 'lotmates-og';
            $file = "$dir/deal-{$deal['Id']}-" . lm_og_signature($deal) . '.png';
            if (!file_exists($file)) {
                foreach (glob("$dir/deal-{$deal['Id']}-*.png") ?: [] as $old) {
                    @unlink($old);
                }
                try {
                    lm_og_render($deal, $file);
                } catch (Throwable $e) {
                    wp_redirect($fallback, 302);
                    exit;
                }
            }
            header('Content-Type: image/png');
            header('Cache-Control: public, max-age=3600');
            header('Content-Length: ' . filesize($file));
            readfile($file);
            exit;
        },
    ]);
}
