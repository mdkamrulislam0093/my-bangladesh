<?php
/**
 * My Bangladesh — shared map links (works on Hostinger / any Apache or LiteSpeed host with PHP 7.4+).
 *
 *   POST /share.php          multipart: image (JPEG 1200×630), title, desc, lang  →  {"id","url"}
 *   GET  /s/{id}             page with the map + Open Graph tags (Facebook/WhatsApp/Messenger preview)
 *   GET  /s/{id}.jpg         the preview image
 *
 * .htaccess maps the /s/ URLs here. Stored data lives outside the web root when possible.
 */

declare(strict_types=1);

const MAX_BYTES = 1500000;
const UPLOADS_PER_10_MIN = 40;

function data_dir(): string {
  static $dir = null;
  if ($dir !== null) return $dir;
  foreach ([dirname(__DIR__) . '/mbd-share', __DIR__ . '/mbd-share'] as $c) {
    if ((is_dir($c) || @mkdir($c, 0755, true)) && is_writable($c)) {
      if (!file_exists("$c/.htaccess")) @file_put_contents("$c/.htaccess", "Require all denied\nDeny from all\n");
      return $dir = $c;
    }
  }
  http_response_code(500);
  exit('storage not writable');
}

function valid_id($id): bool {
  return is_string($id) && preg_match('/^[a-z0-9]{6,16}$/', $id) === 1;
}

function origin(): string {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
  return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

function e(string $s): string {
  return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function json_out(int $status, array $body): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function rate_limited(): bool {
  $f = sys_get_temp_dir() . '/mbd-share-' . substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __FILE__), 0, 20);
  $now = time();
  $hits = array_filter(is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [], fn($t) => $now - $t < 600);
  $hits[] = $now;
  @file_put_contents($f, json_encode(array_values($hits)), LOCK_EX);
  return count($hits) > UPLOADS_PER_10_MIN;
}

function clean_text($v, int $max): string {
  $s = is_string($v) ? trim(preg_replace('/\s+/u', ' ', $v) ?? '') : '';
  return mb_substr($s, 0, $max, 'UTF-8');
}

/* ---------- Create a link ---------- */

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
  if (rate_limited()) json_out(429, ['error' => 'slow down']);
  $f = $_FILES['image'] ?? null;
  if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || ($f['size'] ?? 0) > MAX_BYTES) json_out(400, ['error' => 'bad image']);
  $bin = (string) file_get_contents($f['tmp_name']);
  $info = @getimagesizefromstring($bin);
  // Only real JPEGs of the expected preview size are accepted.
  if (substr($bin, 0, 3) !== "\xFF\xD8\xFF" || !$info || $info[2] !== IMAGETYPE_JPEG || $info[0] !== 1200 || $info[1] !== 630) json_out(400, ['error' => 'bad image']);

  $alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  do {
    $id = '';
    foreach (str_split(random_bytes(8)) as $b) $id .= $alphabet[ord($b) % strlen($alphabet)];
  } while (is_file(data_dir() . "/$id.jpg"));

  $meta = [
    'title' => clean_text($_POST['title'] ?? '', 80) ?: 'My Bangladesh',
    'desc' => clean_text($_POST['desc'] ?? '', 300),
    'lang' => ($_POST['lang'] ?? '') === 'en' ? 'en' : 'bn',
    'created' => gmdate('c'),
  ];
  file_put_contents(data_dir() . "/$id.jpg", $bin);
  file_put_contents(data_dir() . "/$id.json", json_encode($meta, JSON_UNESCAPED_UNICODE));
  json_out(201, ['id' => $id, 'url' => origin() . "/s/$id"]);
}

/* ---------- Preview image ---------- */

if (isset($_GET['img'])) {
  $id = (string) $_GET['img'];
  $file = valid_id($id) ? data_dir() . "/$id.jpg" : '';
  if (!$file || !is_file($file)) {
    header('Location: /og-default.png', true, 302);
    exit;
  }
  header('Content-Type: image/jpeg');
  header('Cache-Control: public, max-age=31536000, immutable');
  header('Content-Length: ' . filesize($file));
  readfile($file);
  exit;
}

/* ---------- Shared map page ---------- */

$id = (string) ($_GET['id'] ?? '');
$metaFile = valid_id($id) ? data_dir() . "/$id.json" : '';
$meta = $metaFile && is_file($metaFile) ? json_decode((string) file_get_contents($metaFile), true) : null;
$o = origin();
if (!$meta) {
  header('Location: /', true, 302);
  exit;
}
$bn = $meta['lang'] !== 'en';
$title = $meta['title'] . ' 🇧🇩';
$desc = $meta['desc'] ?: ($bn ? 'যে জায়গাগুলো আমার গল্প গড়েছে। আপনার বাংলাদেশ কোনটা?' : 'The places that made my story. What\'s your Bangladesh?');
$img = "$o/s/$id.jpg";
$url = "$o/s/$id";
$cta = $bn ? 'নিজের বাংলাদেশ ম্যাপ বানান' : 'Make your own Bangladesh map';
$ctaSub = $bn ? 'মাত্র ৫টি প্রশ্ন, ১ মিনিটও লাগবে না। কোনো সাইন-আপ নেই।' : 'Just 5 quick questions, under a minute. No sign-up.';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
?><!doctype html>
<html lang="<?= $bn ? 'bn' : 'en' ?>">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="<?= e($url) ?>" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="My Bangladesh" />
<meta property="og:url" content="<?= e($url) ?>" />
<meta property="og:title" content="<?= e($title) ?>" />
<meta property="og:description" content="<?= e($desc) ?>" />
<meta property="og:image" content="<?= e($img) ?>" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="<?= e($meta['title']) ?>" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="<?= e($img) ?>" />
<link rel="icon" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;600;700&display=swap" />
<style>
  *{box-sizing:border-box}body{margin:0;background:#faf6ef;color:#1d1b18;font-family:"Noto Sans Bengali","Inter",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  main{max-width:680px;margin:0 auto;padding:20px 16px 48px}
  .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;color:#1d1b18;text-decoration:none}
  .brand i{width:26px;height:26px;border-radius:8px;background:#0b5d3b;display:inline-block;position:relative}
  .brand i:after{content:"";position:absolute;left:6px;top:7px;width:12px;height:12px;border-radius:50%;background:#e4573d}
  h1{font-size:clamp(26px,7vw,38px);line-height:1.2;margin:22px 0 6px}
  p.sub{color:#4a443c;margin:0 0 18px;font-size:16px;line-height:1.6}
  img.map{display:block;width:100%;height:auto;border-radius:18px;box-shadow:0 2px 4px rgba(40,30,10,.05),0 24px 48px -16px rgba(40,30,10,.22)}
  .cta{margin-top:26px;background:#0b5d3b;color:#fff;border-radius:28px;padding:26px 22px;text-align:center}
  .cta h2{margin:0 0 6px;font-size:22px}.cta p{margin:0 0 18px;color:rgba(255,255,255,.82);font-size:14px}
  .cta a{display:inline-block;background:#fff;color:#0b5d3b;font-weight:700;font-size:17px;padding:14px 26px;border-radius:999px;text-decoration:none}
  footer{margin-top:28px;text-align:center;color:#8a8175;font-size:13px}footer b{color:#1d1b18}
</style>
</head>
<body>
<main>
  <a class="brand" href="/"><i></i><?= $bn ? 'আমার বাংলাদেশ' : 'My Bangladesh' ?></a>
  <h1><?= e($title) ?></h1>
  <p class="sub"><?= e($desc) ?></p>
  <img class="map" src="<?= e($img) ?>" width="1200" height="630" alt="<?= e($meta['title']) ?>" />
  <div class="cta">
    <h2><?= $bn ? 'আপনার বাংলাদেশ কোনটা?' : "What's your Bangladesh?" ?></h2>
    <p><?= e($ctaSub) ?></p>
    <a href="/"><?= e($cta) ?> 🇧🇩</a>
  </div>
  <footer>Powered by <b>Devstall</b></footer>
</main>
</body>
</html>
