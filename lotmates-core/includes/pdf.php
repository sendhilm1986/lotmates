<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * A small PDF writer for invoices: A4 pages, Helvetica and Helvetica Bold, text, lines and
 * filled boxes. No outside library, so it runs on any PHP host. Coordinates are in points
 * from the top-left corner, which is easier to lay out than PDF's bottom-left.
 */
class LM_Pdf
{
    const W = 595.28;
    const H = 841.89;

    private $pages = [];
    private $page = -1;
    private $title = '';

    // Glyph widths (1/1000 em) for characters 32–126.
    private static $widths = [
        'F1' => [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],
        'F2' => [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584],
    ];

    public function __construct($title = '')
    {
        $this->title = $title;
        $this->addPage();
    }

    public function addPage()
    {
        $this->pages[] = '';
        $this->page = count($this->pages) - 1;
    }

    public static function enc($s)
    {
        $s = str_replace(['₹', '–', '—', '’', '‘', '“', '”', '…'], ['Rs.', '-', '-', "'", "'", '"', '"', '...'], (string) $s);
        $out = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $s);
        return $out === false ? preg_replace('/[^\x20-\x7E]/', '?', $s) : $out;
    }

    public function width($text, $size, $bold = false)
    {
        $w = 0;
        $t = self::enc($text);
        $table = self::$widths[$bold ? 'F2' : 'F1'];
        for ($i = 0, $n = strlen($t); $i < $n; $i++) {
            $c = ord($t[$i]);
            $w += ($c >= 32 && $c <= 126) ? $table[$c - 32] : 556;
        }
        return $w * $size / 1000;
    }

    private function out($s)
    {
        $this->pages[$this->page] .= $s . "\n";
    }

    private static function rgb($c)
    {
        return sprintf('%.3F %.3F %.3F', $c[0] / 255, $c[1] / 255, $c[2] / 255);
    }

    private static function esc($s)
    {
        return str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', '', ' '], $s);
    }

    /** Text with its baseline at $y. $align: left, right or center around $x. */
    public function text($x, $y, $text, $size = 10, $bold = false, $color = [0, 0, 0], $align = 'left')
    {
        if ($align !== 'left') {
            $w = $this->width($text, $size, $bold);
            $x -= $align === 'right' ? $w : $w / 2;
        }
        $this->out(sprintf('BT /%s %.2F Tf %s rg %.2F %.2F Td (%s) Tj ET', $bold ? 'F2' : 'F1', $size, self::rgb($color), $x, self::H - $y, self::esc(self::enc($text))));
    }

    /** Wrap text into lines no wider than $maxWidth. */
    public function wrap($text, $size, $maxWidth, $bold = false)
    {
        $lines = [];
        foreach (preg_split("/\r?\n/", (string) $text) as $para) {
            $line = '';
            foreach (preg_split('/\s+/', trim($para)) as $word) {
                $try = $line === '' ? $word : "$line $word";
                if ($line !== '' && $this->width($try, $size, $bold) > $maxWidth) {
                    $lines[] = $line;
                    $line = $word;
                } else {
                    $line = $try;
                }
            }
            $lines[] = $line;
        }
        return $lines;
    }

    public function rect($x, $y, $w, $h, $fill)
    {
        $this->out(sprintf('%s rg %.2F %.2F %.2F %.2F re f', self::rgb($fill), $x, self::H - $y - $h, $w, $h));
    }

    public function roundRect($x, $y, $w, $h, $r, $fill)
    {
        $k = 0.5523 * $r;
        $Y = self::H - $y;
        $this->out(sprintf(
            '%s rg %.2F %.2F m %.2F %.2F l %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F l %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F l %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F l %.2F %.2F %.2F %.2F %.2F %.2F c f',
            self::rgb($fill),
            $x + $r, $Y,
            $x + $w - $r, $Y,
            $x + $w - $r + $k, $Y, $x + $w, $Y - $r + $k, $x + $w, $Y - $r,
            $x + $w, $Y - $h + $r,
            $x + $w, $Y - $h + $r - $k, $x + $w - $r + $k, $Y - $h, $x + $w - $r, $Y - $h,
            $x + $r, $Y - $h,
            $x + $r - $k, $Y - $h, $x, $Y - $h + $r - $k, $x, $Y - $h + $r,
            $x, $Y - $r,
            $x, $Y - $r + $k, $x + $r - $k, $Y, $x + $r, $Y
        ));
    }

    public function line($x1, $y1, $x2, $y2, $color, $width = 0.6)
    {
        $this->out(sprintf('%s RG %.2F w %.2F %.2F m %.2F %.2F l S', self::rgb($color), $width, $x1, self::H - $y1, $x2, self::H - $y2));
    }

    public function circle($cx, $cy, $r, $color, $width = null, $fill = false)
    {
        $k = 0.5523 * $r;
        $Y = self::H - $cy;
        $path = sprintf(
            '%.2F %.2F m %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F %.2F %.2F %.2F %.2F c',
            $cx + $r, $Y,
            $cx + $r, $Y + $k, $cx + $k, $Y + $r, $cx, $Y + $r,
            $cx - $k, $Y + $r, $cx - $r, $Y + $k, $cx - $r, $Y,
            $cx - $r, $Y - $k, $cx - $k, $Y - $r, $cx, $Y - $r,
            $cx + $k, $Y - $r, $cx + $r, $Y - $k, $cx + $r, $Y
        );
        if ($fill) {
            $this->out(self::rgb($color) . ' rg ' . $path . ' f');
        } else {
            $this->out(sprintf('%s RG %.2F w %s S', self::rgb($color), $width ?? 1, $path));
        }
    }

    public function ellipse($cx, $cy, $rx, $ry, $color)
    {
        $kx = 0.5523 * $rx;
        $ky = 0.5523 * $ry;
        $Y = self::H - $cy;
        $this->out(sprintf(
            '%s rg %.2F %.2F m %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F %.2F %.2F %.2F %.2F c %.2F %.2F %.2F %.2F %.2F %.2F c f',
            self::rgb($color),
            $cx + $rx, $Y,
            $cx + $rx, $Y + $ky, $cx + $kx, $Y + $ry, $cx, $Y + $ry,
            $cx - $kx, $Y + $ry, $cx - $rx, $Y + $ky, $cx - $rx, $Y,
            $cx - $rx, $Y - $ky, $cx - $kx, $Y - $ry, $cx, $Y - $ry,
            $cx + $kx, $Y - $ry, $cx + $rx, $Y - $ky, $cx + $rx, $Y
        ));
    }

    public function output()
    {
        $objs = [];
        $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $kids = [];
        $n = 5;
        foreach ($this->pages as $content) {
            $stream = gzcompress($content);
            $objs[$n] = '<< /Length ' . strlen($stream) . " /Filter /FlateDecode >>\nstream\n" . $stream . "\nendstream";
            $objs[$n + 1] = sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2F %.2F] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>', self::W, self::H, $n);
            $kids[] = ($n + 1) . ' 0 R';
            $n += 2;
        }
        $objs[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . count($kids) . ' >>';
        $objs[$n] = '<< /Title (' . self::esc(self::enc($this->title)) . ') /Producer (Lotmates) /CreationDate (D:' . gmdate('YmdHis') . 'Z) >>';
        $info = $n;
        ksort($objs);
        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objs as $i => $body) {
            $offsets[$i] = strlen($pdf);
            $pdf .= "$i 0 obj\n$body\nendobj\n";
        }
        $xref = strlen($pdf);
        $max = max(array_keys($objs));
        $pdf .= "xref\n0 " . ($max + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $max; $i++) {
            $pdf .= isset($offsets[$i]) ? sprintf("%010d 00000 n \n", $offsets[$i]) : "0000000000 65535 f \n";
        }
        $pdf .= "trailer\n<< /Size " . ($max + 1) . " /Root 1 0 R /Info $info 0 R >>\nstartxref\n$xref\n%%EOF";
        return $pdf;
    }
}
