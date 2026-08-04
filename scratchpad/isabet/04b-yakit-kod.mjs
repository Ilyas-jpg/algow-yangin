/**
 * CORINE 2018 kodu → yakıt sınıfı. 04b-yakit.mjs'ten AYNEN çıkarıldı;
 * o dosya import edilince en üst seviyede WMS çekmeye başlıyor (script),
 * bu yüzden saf fonksiyon ayrı modülde.
 */
export function yakitOf(code) {
  if (code == null) return null;
  const c = +code;
  if ((c >= 311 && c <= 313) || c === 324) return "ORMAN";
  if (c === 323 || c === 322) return "MAKI";
  if (c === 321 || c === 231 || c === 333) return "OT";
  if (c >= 211 && c <= 244) return "TARIM";
  if (c >= 331 && c <= 335) return "CIPLAK";
  if (c >= 400) return "SU";
  if (c < 200) return "YAPI";
  return "DIGER";
}
