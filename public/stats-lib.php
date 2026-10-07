<?php
/**
 * My Bangladesh — tiny, private, cookie-free usage counters (shared by stats.php and share.php).
 *
 * Stores only daily totals per event, plus an anonymous daily visitor fingerprint
 * (a hash of IP + browser + a secret salt that changes every day; the IP itself is never stored).
 */

declare(strict_types=1);

function mbd_stats_dir(): string {
  static $dir = null;
  if ($dir !== null) return $dir;
  foreach ([dirname(__DIR__) . '/mbd-stats', __DIR__ . '/mbd-stats'] as $c) {
    if ((is_dir($c) || @mkdir($c, 0755, true)) && is_writable($c)) {
      if (!file_exists("$c/.htaccess")) @file_put_contents("$c/.htaccess", "Require all denied\nDeny from all\n");
      return $dir = $c;
    }
  }
  return $dir = '';
}

function mbd_is_bot(): bool {
  return (bool) preg_match('/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse/i', $_SERVER['HTTP_USER_AGENT'] ?? '');
}

/** Bangladesh time, so "today" matches the owner's day. */
function mbd_today(): string {
  return (new DateTime('now', new DateTimeZone('Asia/Dhaka')))->format('Y-m-d');
}

/** Adds to today's counters. $counts = ['event' => n, ...]. */
function mbd_count(array $counts): void {
  $dir = mbd_stats_dir();
  if ($dir === '' || !$counts) return;
  $fh = @fopen("$dir/" . mbd_today() . '.json', 'c+');
  if (!$fh) return;
  if (flock($fh, LOCK_EX)) {
    $data = json_decode((string) stream_get_contents($fh), true) ?: [];
    foreach ($counts as $k => $n) $data[$k] = ($data[$k] ?? 0) + $n;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    flock($fh, LOCK_UN);
  }
  fclose($fh);
}

/** True the first time this (anonymous) visitor is seen today. */
function mbd_first_visit_today(): bool {
  $dir = mbd_stats_dir();
  if ($dir === '') return false;
  $day = mbd_today();
  $saltFile = "$dir/salt";
  if (!is_file($saltFile)) @file_put_contents($saltFile, bin2hex(random_bytes(16)));
  $salt = (string) @file_get_contents($saltFile);
  $hash = substr(hash('sha256', $day . $salt . ($_SERVER['REMOTE_ADDR'] ?? '') . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 20);
  $uDir = "$dir/u-$day";
  if (!is_dir($uDir)) {
    @mkdir($uDir, 0755);
    // Yesterday's fingerprints are no longer needed: delete old ones.
    foreach (glob("$dir/u-*", GLOB_ONLYDIR) ?: [] as $old) {
      if ($old !== $uDir) {
        array_map('unlink', glob("$old/*") ?: []);
        @rmdir($old);
      }
    }
  }
  $f = "$uDir/$hash";
  if (is_file($f)) return false;
  @touch($f);
  return true;
}
