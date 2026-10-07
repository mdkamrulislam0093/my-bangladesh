import shapes from "./district-shapes.json";

export type Division =
  | "Dhaka"
  | "Chattogram"
  | "Rajshahi"
  | "Khulna"
  | "Barishal"
  | "Sylhet"
  | "Rangpur"
  | "Mymensingh";

export interface DistrictMeta {
  id: string;
  nameEn: string;
  nameBn: string;
  division: Division;
}

export interface District extends DistrictMeta {
  /** Pre-projected SVG path in map viewBox units (see scripts/build-map.mjs). */
  d: string;
  /** Visual centre (pole of inaccessibility-ish) in viewBox units. */
  cx: number;
  cy: number;
  /** Geographic centre [lon, lat]. */
  lonLat: [number, number];
}

export const DIVISIONS: Record<Division, { bn: string }> = {
  Dhaka: { bn: "ঢাকা" },
  Chattogram: { bn: "চট্টগ্রাম" },
  Rajshahi: { bn: "রাজশাহী" },
  Khulna: { bn: "খুলনা" },
  Barishal: { bn: "বরিশাল" },
  Sylhet: { bn: "সিলেট" },
  Rangpur: { bn: "রংপুর" },
  Mymensingh: { bn: "ময়মনসিংহ" },
};

/**
 * The 64 districts of Bangladesh. Edit names here; boundaries come from
 * district-shapes.json, regenerated with `npm run build:map`.
 */
export const DISTRICT_META: DistrictMeta[] = [
  // Dhaka
  { id: "dhaka", nameEn: "Dhaka", nameBn: "ঢাকা", division: "Dhaka" },
  { id: "faridpur", nameEn: "Faridpur", nameBn: "ফরিদপুর", division: "Dhaka" },
  { id: "gazipur", nameEn: "Gazipur", nameBn: "গাজীপুর", division: "Dhaka" },
  { id: "gopalganj", nameEn: "Gopalganj", nameBn: "গোপালগঞ্জ", division: "Dhaka" },
  { id: "kishoreganj", nameEn: "Kishoreganj", nameBn: "কিশোরগঞ্জ", division: "Dhaka" },
  { id: "madaripur", nameEn: "Madaripur", nameBn: "মাদারীপুর", division: "Dhaka" },
  { id: "manikganj", nameEn: "Manikganj", nameBn: "মানিকগঞ্জ", division: "Dhaka" },
  { id: "munshiganj", nameEn: "Munshiganj", nameBn: "মুন্সিগঞ্জ", division: "Dhaka" },
  { id: "narayanganj", nameEn: "Narayanganj", nameBn: "নারায়ণগঞ্জ", division: "Dhaka" },
  { id: "narsingdi", nameEn: "Narsingdi", nameBn: "নরসিংদী", division: "Dhaka" },
  { id: "rajbari", nameEn: "Rajbari", nameBn: "রাজবাড়ী", division: "Dhaka" },
  { id: "shariatpur", nameEn: "Shariatpur", nameBn: "শরীয়তপুর", division: "Dhaka" },
  { id: "tangail", nameEn: "Tangail", nameBn: "টাঙ্গাইল", division: "Dhaka" },
  // Mymensingh
  { id: "mymensingh", nameEn: "Mymensingh", nameBn: "ময়মনসিংহ", division: "Mymensingh" },
  { id: "jamalpur", nameEn: "Jamalpur", nameBn: "জামালপুর", division: "Mymensingh" },
  { id: "netrokona", nameEn: "Netrokona", nameBn: "নেত্রকোণা", division: "Mymensingh" },
  { id: "sherpur", nameEn: "Sherpur", nameBn: "শেরপুর", division: "Mymensingh" },
  // Chattogram
  { id: "chattogram", nameEn: "Chattogram", nameBn: "চট্টগ্রাম", division: "Chattogram" },
  { id: "coxs-bazar", nameEn: "Cox's Bazar", nameBn: "কক্সবাজার", division: "Chattogram" },
  { id: "bandarban", nameEn: "Bandarban", nameBn: "বান্দরবান", division: "Chattogram" },
  { id: "rangamati", nameEn: "Rangamati", nameBn: "রাঙ্গামাটি", division: "Chattogram" },
  { id: "khagrachhari", nameEn: "Khagrachhari", nameBn: "খাগড়াছড়ি", division: "Chattogram" },
  { id: "feni", nameEn: "Feni", nameBn: "ফেনী", division: "Chattogram" },
  { id: "noakhali", nameEn: "Noakhali", nameBn: "নোয়াখালী", division: "Chattogram" },
  { id: "lakshmipur", nameEn: "Lakshmipur", nameBn: "লক্ষ্মীপুর", division: "Chattogram" },
  { id: "chandpur", nameEn: "Chandpur", nameBn: "চাঁদপুর", division: "Chattogram" },
  { id: "cumilla", nameEn: "Cumilla", nameBn: "কুমিল্লা", division: "Chattogram" },
  { id: "brahmanbaria", nameEn: "Brahmanbaria", nameBn: "ব্রাহ্মণবাড়িয়া", division: "Chattogram" },
  // Rajshahi
  { id: "rajshahi", nameEn: "Rajshahi", nameBn: "রাজশাহী", division: "Rajshahi" },
  { id: "chapai-nawabganj", nameEn: "Chapai Nawabganj", nameBn: "চাঁপাইনবাবগঞ্জ", division: "Rajshahi" },
  { id: "naogaon", nameEn: "Naogaon", nameBn: "নওগাঁ", division: "Rajshahi" },
  { id: "natore", nameEn: "Natore", nameBn: "নাটোর", division: "Rajshahi" },
  { id: "bogura", nameEn: "Bogura", nameBn: "বগুড়া", division: "Rajshahi" },
  { id: "joypurhat", nameEn: "Joypurhat", nameBn: "জয়পুরহাট", division: "Rajshahi" },
  { id: "pabna", nameEn: "Pabna", nameBn: "পাবনা", division: "Rajshahi" },
  { id: "sirajganj", nameEn: "Sirajganj", nameBn: "সিরাজগঞ্জ", division: "Rajshahi" },
  // Rangpur
  { id: "rangpur", nameEn: "Rangpur", nameBn: "রংপুর", division: "Rangpur" },
  { id: "dinajpur", nameEn: "Dinajpur", nameBn: "দিনাজপুর", division: "Rangpur" },
  { id: "thakurgaon", nameEn: "Thakurgaon", nameBn: "ঠাকুরগাঁও", division: "Rangpur" },
  { id: "panchagarh", nameEn: "Panchagarh", nameBn: "পঞ্চগড়", division: "Rangpur" },
  { id: "nilphamari", nameEn: "Nilphamari", nameBn: "নীলফামারী", division: "Rangpur" },
  { id: "lalmonirhat", nameEn: "Lalmonirhat", nameBn: "লালমনিরহাট", division: "Rangpur" },
  { id: "kurigram", nameEn: "Kurigram", nameBn: "কুড়িগ্রাম", division: "Rangpur" },
  { id: "gaibandha", nameEn: "Gaibandha", nameBn: "গাইবান্ধা", division: "Rangpur" },
  // Khulna
  { id: "khulna", nameEn: "Khulna", nameBn: "খুলনা", division: "Khulna" },
  { id: "bagerhat", nameEn: "Bagerhat", nameBn: "বাগেরহাট", division: "Khulna" },
  { id: "satkhira", nameEn: "Satkhira", nameBn: "সাতক্ষীরা", division: "Khulna" },
  { id: "jashore", nameEn: "Jashore", nameBn: "যশোর", division: "Khulna" },
  { id: "narail", nameEn: "Narail", nameBn: "নড়াইল", division: "Khulna" },
  { id: "magura", nameEn: "Magura", nameBn: "মাগুরা", division: "Khulna" },
  { id: "jhenaidah", nameEn: "Jhenaidah", nameBn: "ঝিনাইদহ", division: "Khulna" },
  { id: "chuadanga", nameEn: "Chuadanga", nameBn: "চুয়াডাঙ্গা", division: "Khulna" },
  { id: "kushtia", nameEn: "Kushtia", nameBn: "কুষ্টিয়া", division: "Khulna" },
  { id: "meherpur", nameEn: "Meherpur", nameBn: "মেহেরপুর", division: "Khulna" },
  // Barishal
  { id: "barishal", nameEn: "Barishal", nameBn: "বরিশাল", division: "Barishal" },
  { id: "bhola", nameEn: "Bhola", nameBn: "ভোলা", division: "Barishal" },
  { id: "patuakhali", nameEn: "Patuakhali", nameBn: "পটুয়াখালী", division: "Barishal" },
  { id: "barguna", nameEn: "Barguna", nameBn: "বরগুনা", division: "Barishal" },
  { id: "pirojpur", nameEn: "Pirojpur", nameBn: "পিরোজপুর", division: "Barishal" },
  { id: "jhalokathi", nameEn: "Jhalokathi", nameBn: "ঝালকাঠি", division: "Barishal" },
  // Sylhet
  { id: "sylhet", nameEn: "Sylhet", nameBn: "সিলেট", division: "Sylhet" },
  { id: "moulvibazar", nameEn: "Moulvibazar", nameBn: "মৌলভীবাজার", division: "Sylhet" },
  { id: "habiganj", nameEn: "Habiganj", nameBn: "হবিগঞ্জ", division: "Sylhet" },
  { id: "sunamganj", nameEn: "Sunamganj", nameBn: "সুনামগঞ্জ", division: "Sylhet" },
];

type ShapeFile = {
  width: number;
  height: number;
  outline: string;
  districts: Record<string, { d: string; cx: number; cy: number; lonLat: [number, number] }>;
};

const shapeData = shapes as unknown as ShapeFile;

export const MAP_WIDTH = shapeData.width;
export const MAP_HEIGHT = shapeData.height;
export const COUNTRY_OUTLINE = shapeData.outline;

export const DISTRICTS: District[] = DISTRICT_META.map((m) => {
  const s = shapeData.districts[m.id];
  if (!s) throw new Error(`Missing shape for district ${m.id}`);
  return { ...m, ...s };
});

export const DISTRICT_BY_ID: Record<string, District> = Object.fromEntries(
  DISTRICTS.map((d) => [d.id, d]),
);

export function districtName(id: string, lang: "bn" | "en"): string {
  const d = DISTRICT_BY_ID[id];
  if (!d) return id;
  return lang === "bn" ? d.nameBn : d.nameEn;
}
