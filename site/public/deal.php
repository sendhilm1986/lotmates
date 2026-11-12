<?php
/**
 * Link previews for one deal. Apps that unfurl links (WhatsApp, X, Facebook, LinkedIn,
 * Slack, Telegram) don't run JavaScript, so they're sent here: the same app page, with
 * the deal's own title, description and share card in the head.
 */
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$shell = @file_get_contents(__DIR__ . '/deals/index.html') ?: @file_get_contents(__DIR__ . '/index.html');
header('Content-Type: text/html; charset=utf-8');
if (!$shell) {
    http_response_code(404);
    exit;
}

$meta = null;
try {
    define('WP_USE_THEMES', false);
    require __DIR__ . '/cms/wp-load.php';
    if ($id && function_exists('lm_row') && function_exists('lm_og_facts')) {
        $deal = lm_row('deals_c', $id);
        if ($deal && $deal['status_c'] !== 'Draft') {
            $f = lm_og_facts($deal);
            $price = $f['price'] !== null ? lm_og_inr($f['price']) . ' per ' . $f['unit'] : '';
            $meta = [
                'title' => $deal['Name'] . ($price ? ', ' . $price : '') . ' | Lotmates',
                'description' => trim($f['line'] . ' Book with your neighbours' . ($f['where'] ? ' in ' . $f['where'] : '') . ' on Lotmates. Early bookers get the difference back.'),
                'image' => lm_og_url($deal),
                'alt' => $deal['Name'] . ($price ? ', ' . $price : ''),
                'url' => LM_SITE_URL . '/deals/' . $id,
            ];
        }
    }
} catch (Throwable $e) {
    $meta = null;
}

if (!$meta) {
    echo $shell;
    exit;
}

$e = function ($s) {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
};
$tags = "\n    <title>{$e($meta['title'])}</title>"
    . "\n    <meta name=\"description\" content=\"{$e($meta['description'])}\" />"
    . "\n    <link rel=\"canonical\" href=\"{$e($meta['url'])}\" />"
    . "\n    <meta property=\"og:title\" content=\"{$e($meta['title'])}\" />"
    . "\n    <meta property=\"og:description\" content=\"{$e($meta['description'])}\" />"
    . "\n    <meta property=\"og:url\" content=\"{$e($meta['url'])}\" />"
    . "\n    <meta property=\"og:image\" content=\"{$e($meta['image'])}\" />"
    . "\n    <meta property=\"og:image:type\" content=\"image/png\" />"
    . "\n    <meta property=\"og:image:width\" content=\"1200\" />"
    . "\n    <meta property=\"og:image:height\" content=\"630\" />"
    . "\n    <meta property=\"og:image:alt\" content=\"{$e($meta['alt'])}\" />"
    . "\n    <meta name=\"twitter:card\" content=\"summary_large_image\" />"
    . "\n    <meta name=\"twitter:title\" content=\"{$e($meta['title'])}\" />"
    . "\n    <meta name=\"twitter:description\" content=\"{$e($meta['description'])}\" />"
    . "\n    <meta name=\"twitter:image\" content=\"{$e($meta['image'])}\" />"
    . "\n    <meta name=\"twitter:image:alt\" content=\"{$e($meta['alt'])}\" />";

// Replace the site-wide tags with the deal's own.
$html = preg_replace('~<title>.*?</title>~s', '', $shell);
$html = preg_replace('~\s*<meta\s+(?:name|property)="(?:description|og:title|og:description|og:url|og:image[^"]*|twitter:[^"]+)"[^>]*>~', '', $html);
$html = preg_replace('~\s*<link\s+rel="canonical"[^>]*>~', '', $html);
$html = preg_replace_callback('~<meta\s+name="viewport"[^>]*>~', function ($m) use ($tags) {
    return $m[0] . $tags;
}, $html, 1);
header('Cache-Control: public, max-age=600');
echo $html;
