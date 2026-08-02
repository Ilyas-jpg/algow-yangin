/**
 * Node test koşucusu için modül çözümleyici kancası.
 *
 * Kaynak dosyalar Next'in çözümleyicisine göre yazılmış: uzantısız göreli
 * import (`./geo`) ve `@/` takma adı. Node'un ESM çözümleyicisi ikisini de
 * bilmez. Test yüzünden üretim kaynağını değiştirmemek için çözümlemeyi
 * burada tamamlıyoruz — böylece testler gerçek üretim dosyalarını çalıştırır,
 * kopyasını değil.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as joinPath } from "node:path";

const SRC = joinPath(dirname(fileURLToPath(import.meta.url)), "..", "src");
const UZANTILAR = [".ts", ".tsx", "/index.ts"];
const zatenUzantili = (s) => /\.[cm]?[jt]sx?$/.test(s);

function ilkVarOlan(taban, specifier) {
  for (const ext of UZANTILAR) {
    const p = joinPath(taban, specifier + ext);
    if (existsSync(p)) return pathToFileURL(p).href;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const hit = ilkVarOlan(SRC, specifier.slice(2));
    if (hit) return next(hit, context);
  }
  if (specifier.startsWith(".") && !zatenUzantili(specifier) && context.parentURL) {
    const hit = ilkVarOlan(dirname(fileURLToPath(context.parentURL)), specifier);
    if (hit) return next(hit, context);
  }
  return next(specifier, context);
}
