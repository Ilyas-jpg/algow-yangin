/**
 * Türkçe'ye özgü harf katlama.
 *
 * `toLowerCase()` tek başına yetmez: "İ" → "i̇" (i + birleşen nokta) üretir,
 * "I" → "i" olur ama Türkçe'de "ı" olmalıdır. Arama kutusunda kullanıcı
 * "cine" yazıp "Çine"yi bulabilmeli, "IZMIR" yazıp "İzmir"i bulabilmeli.
 * Bu yüzden harfleri açıkça eşliyoruz.
 */
const FOLD: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", I: "i",
  i: "i", İ: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
  â: "a", Â: "a",
  î: "i", Î: "i",
  û: "u", Û: "u",
};

/** Aksan ve büyük/küçük harf duyarsız karşılaştırma anahtarı. */
export function foldTr(s: string): string {
  let out = "";
  for (const ch of s) {
    const f = FOLD[ch];
    out += f ?? ch.toLowerCase();
  }
  return out;
}

/** URL parçası: "Şanlıurfa" → "sanliurfa", "Afyonkarahisar" → "afyonkarahisar". */
export function slugifyTr(s: string): string {
  return foldTr(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
