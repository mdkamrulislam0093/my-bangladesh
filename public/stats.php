<?php
/**
 * My Bangladesh — private usage stats.
 *
 *   POST /stats.php            {"event": "...", "props": {...}}   (sent by the app, anonymous)
 *   GET  /stats.php?key=KEY    the private dashboard (wrong/missing key → plain 404)
 *   GET  /stats.php?key=KEY&format=json   raw daily numbers
 *
 * Change STATS_KEY to your own secret if this link ever leaks.
 */

declare(strict_types=1);
require __DIR__ . '/stats-lib.php';

const STATS_KEY = 'se8x6s4shsnc54jgxprq8oph';

/** What the app may report, and which "props" values are kept as sub-counters. */
const EVENTS = [
  'landing_view' => ['ref' => ['share']],
  'map_created' => [],
  'map_completed' => [],
  'share_open' => [],
  'image_shared' => ['via' => ['native', 'facebook', 'messenger', 'whatsapp']],
  'image_download' => [],
  'link_copy' => [],
];

/* ---------- Record an event ---------- */

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
  $raw = (string) file_get_contents('php://input', false, null, 0, 2000);
  $in = json_decode($raw, true);
  $event = is_array($in) ? ($in['event'] ?? null) : null;
  if (is_string($event) && isset(EVENTS[$event]) && !mbd_is_bot()) {
    $counts = [$event => 1];
    foreach (EVENTS[$event] as $prop => $allowed) {
      $v = $in['props'][$prop] ?? null;
      if (is_string($v) && in_array($v, $allowed, true)) $counts["$event:$v"] = 1;
    }
    if ($event === 'landing_view' && mbd_first_visit_today()) $counts['visitor'] = 1;
    mbd_count($counts);
  }
  http_response_code(204);
  exit;
}

/* ---------- Private dashboard ---------- */

if (!hash_equals(STATS_KEY, (string) ($_GET['key'] ?? ''))) {
  http_response_code(404);
  exit;
}

$dir = mbd_stats_dir();
$days = [];
foreach (glob("$dir/????-??-??.json") ?: [] as $f) $days[basename($f, '.json')] = json_decode((string) file_get_contents($f), true) ?: [];
ksort($days);

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

if (($_GET['format'] ?? '') === 'json') {
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($days, JSON_PRETTY_PRINT);
  exit;
}

$tz = new DateTimeZone('Asia/Dhaka');
$today = new DateTime('now', $tz);
$dayKey = fn(int $ago) => (clone $today)->modify("-$ago day")->format('Y-m-d');
$sum = function (string $k, int $span) use ($days, $dayKey): int {
  $t = 0;
  if ($span === 0) {
    foreach ($days as $d) $t += $d[$k] ?? 0;
    return $t;
  }
  for ($i = 0; $i < $span; $i++) $t += $days[$dayKey($i)][$k] ?? 0;
  return $t;
};

$rows = [
  ['visitor', 'Visitors', 'ভিজিটর (প্রতিদিন ইউনিক)'],
  ['landing_view', 'Page views', 'পেজ ভিউ'],
  ['map_created', 'Maps started', 'ম্যাপ বানানো শুরু'],
  ['map_completed', 'Maps finished', 'সব প্রশ্ন শেষ'],
  ['share_open', 'Share window opened', 'শেয়ার উইন্ডো খোলা'],
  ['image_shared', 'Shares', 'শেয়ার'],
  ['image_download', 'Downloads', 'ডাউনলোড'],
  ['link_created', 'Map links created', 'ম্যাপ লিংক তৈরি'],
  ['share_page_view', 'Shared map views', 'শেয়ার করা ম্যাপ দেখা'],
  ['landing_view:share', 'Visits from shared maps', 'শেয়ার থেকে আসা ভিজিট'],
];
$spans = [[1, 'Today'], [7, 'Last 7 days'], [30, 'Last 30 days'], [0, 'All time']];

$visitors30 = $sum('visitor', 30);
$created30 = $sum('map_created', 30);
$shared30 = $sum('image_shared', 30);
$conv = $visitors30 ? round(100 * $created30 / $visitors30) : 0;
$shareRate = $created30 ? round(100 * $shared30 / $created30) : 0;

// 30-day chart data, oldest first.
$chart = [];
for ($i = 29; $i >= 0; $i--) {
  $k = $dayKey($i);
  $chart[] = [$k, $days[$k]['visitor'] ?? 0, $days[$k]['map_created'] ?? 0];
}
$max = max(1, ...array_map(fn($c) => max($c[1], $c[2]), $chart));

function n(int $v): string {
  return number_format($v);
}
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Stats · My Bangladesh</title>
<link rel="icon" href="/favicon.svg" />
<style>
  :root{--bg:#faf6ef;--card:#fff;--ink:#1d1b18;--muted:#7a7166;--line:#e8dfd0;--green:#0b5d3b;--soft:#e3efe7;--red:#d9473a}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Inter,"Noto Sans Bengali",system-ui,sans-serif}
  main{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
  h1{font-size:26px;margin:0}.sub{color:var(--muted);margin:2px 0 22px;font-size:13px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px}
  .kpi b{display:block;font-size:32px;line-height:1.1;color:var(--green)}.kpi span{color:var(--muted);font-size:13px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin-top:16px;overflow-x:auto}
  h2{font-size:16px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:9px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
  th:first-child,td:first-child{text-align:left}th{color:var(--muted);font-weight:600;font-size:12px}
  td small{display:block;color:var(--muted);font-size:12px}
  .legend{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:8px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
  .foot{margin-top:18px;color:var(--muted);font-size:12px}
  a{color:var(--green)}
</style>
</head>
<body>
<main>
  <h1>🇧🇩 My Bangladesh — stats</h1>
  <p class="sub">Private page · Bangladesh time · updated <?= $today->format('j M Y, g:i a') ?> · <a href="?key=<?= htmlspecialchars(STATS_KEY) ?>&amp;format=json">raw JSON</a></p>

  <div class="kpis">
    <div class="kpi"><b><?= n($sum('visitor', 1)) ?></b><span>Visitors today · আজকের ভিজিটর</span></div>
    <div class="kpi"><b><?= n($sum('map_created', 1)) ?></b><span>Maps started today · আজ ম্যাপ</span></div>
    <div class="kpi"><b><?= n($sum('visitor', 0)) ?></b><span>Visitors all time · মোট ভিজিটর</span></div>
    <div class="kpi"><b><?= n($sum('map_created', 0)) ?></b><span>Maps all time · মোট ম্যাপ</span></div>
    <div class="kpi"><b><?= $conv ?>%</b><span>Visitors who make a map (30d)</span></div>
    <div class="kpi"><b><?= $shareRate ?>%</b><span>Map makers who share (30d)</span></div>
  </div>

  <div class="card">
    <h2>Last 30 days</h2>
    <div class="legend"><span><i style="background:#9fc5b1"></i>Visitors</span><span><i style="background:var(--green)"></i>Maps started</span></div>
    <svg viewBox="0 0 900 180" width="100%" role="img" aria-label="Visitors and maps per day, last 30 days">
      <?php foreach ($chart as $i => [$d, $v, $m]):
        $x = 10 + $i * 29.5; $hv = 150 * $v / $max; $hm = 150 * $m / $max; ?>
        <rect x="<?= $x ?>" y="<?= 160 - $hv ?>" width="12" height="<?= $hv ?>" rx="3" fill="#9fc5b1"><title><?= "$d · $v visitors" ?></title></rect>
        <rect x="<?= $x + 13 ?>" y="<?= 160 - $hm ?>" width="12" height="<?= $hm ?>" rx="3" fill="#0b5d3b"><title><?= "$d · $m maps" ?></title></rect>
        <?php if ($i % 5 === 0 || $i === 29): ?><text x="<?= $x + 12 ?>" y="176" font-size="10" text-anchor="middle" fill="#7a7166"><?= (new DateTime($d))->format('j M') ?></text><?php endif; ?>
      <?php endforeach; ?>
      <line x1="0" y1="160.5" x2="900" y2="160.5" stroke="#e8dfd0" />
    </svg>
  </div>

  <div class="card">
    <h2>Totals</h2>
    <table>
      <tr><th></th><?php foreach ($spans as [, $label]): ?><th><?= $label ?></th><?php endforeach; ?></tr>
      <?php foreach ($rows as [$k, $en, $bn]): ?>
        <tr><td><?= $en ?><small><?= $bn ?></small></td><?php foreach ($spans as [$s]): ?><td><?= n($sum($k, $s)) ?></td><?php endforeach; ?></tr>
      <?php endforeach; ?>
      <?php foreach (['native' => 'phone share menu', 'facebook' => 'Facebook', 'messenger' => 'Messenger', 'whatsapp' => 'WhatsApp'] as $via => $label): ?>
        <tr><td>&nbsp;&nbsp;↳ via <?= $label ?></td><?php foreach ($spans as [$s]): ?><td><?= n($sum("image_shared:$via", $s)) ?></td><?php endforeach; ?></tr>
      <?php endforeach; ?>
    </table>
  </div>

  <div class="card">
    <h2>Daily (last 30 days)</h2>
    <table>
      <tr><th>Date</th><th>Visitors</th><th>Page views</th><th>Maps started</th><th>Finished</th><th>Shares</th><th>Downloads</th><th>From shares</th></tr>
      <?php for ($i = 0; $i < 30; $i++): $k = $dayKey($i); $d = $days[$k] ?? []; ?>
        <tr><td><?= (new DateTime($k))->format('D, j M') ?></td><td><?= n($d['visitor'] ?? 0) ?></td><td><?= n($d['landing_view'] ?? 0) ?></td><td><?= n($d['map_created'] ?? 0) ?></td><td><?= n($d['map_completed'] ?? 0) ?></td><td><?= n($d['image_shared'] ?? 0) ?></td><td><?= n($d['image_download'] ?? 0) ?></td><td><?= n($d['landing_view:share'] ?? 0) ?></td></tr>
      <?php endfor; ?>
    </table>
  </div>

  <p class="foot">Counts only — no cookies, no names, no IP addresses stored. A "visitor" is counted once per day per device (anonymous daily fingerprint). Bots and link-preview crawlers are ignored.</p>
</main>
</body>
</html>
