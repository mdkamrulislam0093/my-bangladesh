const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** URL-safe random id without ambiguous characters (no 0/o/1/l). */
export function randomId(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
