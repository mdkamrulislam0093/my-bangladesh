// Builds src/data/district-shapes.json from the raw geoBoundaries ADM2 GeoJSON.
//
// Source: geoBoundaries gbOpen BGD ADM2 (Bangladesh Bureau of Statistics / OCHA ROAP),
// CC BY 3.0 IGO. https://www.geoboundaries.org
//
// Steps: topology-preserving simplification (mapshaper) → Mercator projection
// fitted to a fixed width (d3-geo) → rounded SVG path strings. Shipping
// pre-projected paths means the browser needs no geo library at all.
import fs from "node:fs";
import path from "node:path";
import mapshaper from "mapshaper";
import { geoArea, geoMercator, geoPath } from "d3-geo";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "data/raw/bgd-adm2.geojson");
const OUT = path.join(ROOT, "src/data/district-shapes.json");
const WIDTH = 600;
const PAD = 8;

// geoBoundaries uses older spellings; map them to our ids.
const NAME_TO_ID = {
  Bagerhat: "bagerhat", Bandarban: "bandarban", Barguna: "barguna", Barisal: "barishal",
  Bhola: "bhola", Bogra: "bogura", Brahamanbaria: "brahmanbaria", Chandpur: "chandpur",
  Chittagong: "chattogram", Chuadanga: "chuadanga", Comilla: "cumilla", "Cox's Bazar": "coxs-bazar",
  Dhaka: "dhaka", Dinajpur: "dinajpur", Faridpur: "faridpur", Feni: "feni", Gaibandha: "gaibandha",
  Gazipur: "gazipur", Gopalganj: "gopalganj", Habiganj: "habiganj", Jamalpur: "jamalpur",
  Jessore: "jashore", Jhalokati: "jhalokathi", Jhenaidah: "jhenaidah", Joypurhat: "joypurhat",
  Khagrachhari: "khagrachhari", Khulna: "khulna", Kishoreganj: "kishoreganj", Kurigram: "kurigram",
  Kushtia: "kushtia", Lakshmipur: "lakshmipur", Lalmonirhat: "lalmonirhat", Madaripur: "madaripur",
  Magura: "magura", Manikganj: "manikganj", Maulvibazar: "moulvibazar", Meherpur: "meherpur",
  Munshiganj: "munshiganj", Mymensingh: "mymensingh", Naogaon: "naogaon", Narail: "narail",
  Narayanganj: "narayanganj", Narsingdi: "narsingdi", Natore: "natore", Nawabganj: "chapai-nawabganj",
  Netrakona: "netrokona", Nilphamari: "nilphamari", Noakhali: "noakhali", Pabna: "pabna",
  Panchagarh: "panchagarh", Patuakhali: "patuakhali", Pirojpur: "pirojpur", Rajbari: "rajbari",
  Rajshahi: "rajshahi", Rangamati: "rangamati", Rangpur: "rangpur", Satkhira: "satkhira",
  Shariatpur: "shariatpur", Sherpur: "sherpur", Sirajganj: "sirajganj", Sunamganj: "sunamganj",
  Sylhet: "sylhet", Tangail: "tangail", Thakurgaon: "thakurgaon",
};

const raw = fs.readFileSync(RAW, "utf8");

// d3-geo wants clockwise exterior rings (spherical winding). A polygon wound the
// other way is read as "the whole globe minus this shape", so flip those.
function rewind(fc) {
  const geoms = fc.features ? fc.features.map((f) => f.geometry) : fc.geometries;
  for (const g of geoms) {
    if (!g || g.type === "Point") continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const rings of polys) {
      if (geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI) rings.forEach((r) => r.reverse());
    }
  }
  return fc;
}

async function run(cmd) {
  const out = await mapshaper.applyCommands(cmd, { "in.json": raw });
  return rewind(JSON.parse(out["out.json"].toString()));
}

const simplified = await run(
  "-i in.json -filter-slivers min-area=40km2 -simplify dp 6% keep-shapes -filter-islands min-area=25km2 -o out.json format=geojson precision=0.0001",
);
const outline = await run(
  "-i in.json -filter-slivers min-area=40km2 -simplify dp 6% keep-shapes -filter-islands min-area=25km2 -dissolve -o out.json format=geojson precision=0.0001",
);
const inner = await run("-i in.json -points inner -o out.json format=geojson");

const projection = geoMercator().fitWidth(WIDTH - PAD * 2, simplified);
const [[, y0], [, y1]] = geoPath(projection).bounds(simplified);
projection.translate([projection.translate()[0] + PAD, projection.translate()[1] - y0 + PAD]);
const height = Math.ceil(y1 - y0 + PAD * 2);

const toPath = geoPath(projection).digits(1);
const round = (n) => Math.round(n * 10) / 10;

const innerById = {};
for (const f of inner.features) innerById[NAME_TO_ID[f.properties.shapeName]] = f.geometry.coordinates;

const districts = {};
for (const f of simplified.features) {
  const id = NAME_TO_ID[f.properties.shapeName];
  if (!id) throw new Error(`Unmapped district: ${f.properties.shapeName}`);
  const lonLat = innerById[id];
  const [cx, cy] = projection(lonLat);
  districts[id] = {
    d: toPath(f),
    cx: round(cx),
    cy: round(cy),
    lonLat: lonLat.map((n) => Math.round(n * 1000) / 1000),
  };
}

if (Object.keys(districts).length !== 64) throw new Error(`Expected 64 districts, got ${Object.keys(districts).length}`);

const result = { width: WIDTH, height, outline: toPath(outline), districts };
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`Wrote ${OUT} — ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB, ${WIDTH}×${height}`);
