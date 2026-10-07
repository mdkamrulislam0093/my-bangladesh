# My Bangladesh Life Map 🇧🇩

> Your life is a journey. Show it on the map.

Pick the places in Bangladesh's 64 districts that matter to you (born, studied, worked, met someone…), then share your story as a beautiful image on Facebook, WhatsApp, Messenger or Instagram. Bangla is the default language, and English is one tap away. No sign-up is needed, and the map never leaves the user's device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
```

The site is **fully static**: no backend, no database, no API keys.

### Deploy (Hostinger, cPanel or any static host)

1. Run `npm run build`.
2. Upload the **contents** of `dist/` to the site's web root. In File Manager, turn on "show hidden files" so `.htaccess` is uploaded too; it sends old links (like `/create`) to the page.
3. On another host (Netlify, Vercel, Cloudflare Pages), make every unknown path serve `index.html`.

Optional build-time settings:

| Env var | Purpose |
| --- | --- |
| `VITE_SITE_HOST` | Domain printed on share images (defaults to the current host; hidden on localhost). |
| `VITE_ANALYTICS_URL` | Endpoint that receives anonymous `POST {event, props}` counts. Unset = nothing is sent. |

## How it works

```
src/
  data/
    districts.ts          64 districts: id, English and Bangla names, division (edit names here)
    district-shapes.json  pre-projected SVG paths and label points (generated)
    categories.ts         life categories: emoji, colours, labels, guided questions (add one here)
  i18n/                   typed string table (bn/en), Bangla digits
  lib/
    draftStore.ts         the user's map → localStorage, survives refreshes
    mapModel.ts           pure logic: timeline, journey line, stats, sanitising
    shareImage.ts         share image drawn on <canvas>: 2 formats × 3 styles (lazy-loaded)
    analytics.ts          anonymous event counts, off unless configured; respects Do Not Track
  components/
    BangladeshMap.tsx     SVG map: badges, labels, journey line (also supports tap/zoom if needed)
    QuestionFlow.tsx      the direct questions (the only way to add places)
    DistrictPicker.tsx    searchable district list used by each question
    ShareSheet.tsx        format and style pickers, preview, Share / Download
  pages/Home.tsx          the whole app on one page: intro → questions + live map → your story → share
  components/JourneyEditor.tsx  name, title, timeline with years, numbers
  lib/useOverlayHistory.ts  phone Back button closes the share sheet instead of leaving
scripts/build-map.mjs     raw GeoJSON → simplified, projected SVG paths
```

**One page, question-first.** Everything happens on `/`. The user answers direct questions one at a time ("Where were you born?", "Where did you study?" … 9 in all, each skippable) by picking districts from a searchable list (Bangla, English, old spellings). The map beside it is display-only and colours in live. Then "Your story" adds name, title, years and one line about the journey, and the share button makes the image. Questions live in `src/components/QuestionFlow.tsx` (order, single/multi), and their text is in `categories.ts`.

**Sharing.** The image is drawn in the browser:
- *Post* is 1080×1350 (4:5, Facebook and Instagram feeds). *Story* is 1080×1920 (WhatsApp status and stories).
- Styles: *Paper*, *Forest* (deep green) and *Night*.
- Each image holds the title, the map with district names and the life-journey line, a timeline with years, a personal quote, numbers (districts, divisions, life chapters) and an invitation.

On phones, "Share image" opens the system share menu (Facebook, Messenger, WhatsApp…), and "Download" works everywhere.

**Map data.** The boundaries come from [geoBoundaries](https://www.geoboundaries.org) BGD ADM2 (Bangladesh Bureau of Statistics / OCHA ROAP, CC BY 3.0 IGO). Run `npm run build:map` to regenerate them; it installs `mapshaper` temporarily, so that tool stays out of the project's dependencies.

## Product decisions worth knowing

- Each district holds at most one event per category. Year and note are optional per event, and each place can also have a one-line memory.
- The timeline uses a manual order. When a year is added, dated events are re-sorted, and undated ones stay next to the event before them.
- The journey line follows life moves (born, lived, studied, worked…) and leaves out "visited" trips, so it stays readable.
- "Important memory" uses 📸 rather than 🏥, which reads as "hospital".
- Data is district-level only. There is no address, phone number or email field, and nothing is uploaded.

## Ideas for later

Accounts and cloud save, multiple maps, family, couple and school maps, photos, custom categories, year-by-year animation, yearly recap, printable poster, video export.
