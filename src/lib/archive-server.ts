import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArchiveIndexItem } from "./archive";

/**
 * Arşiv indeksi derleme anında okunur — kayıtlar depoda statik dosya olarak
 * durduğu için çalışma anında ne FIRMS'e ne diske gidilir.
 */
export function archiveIndex(): ArchiveIndexItem[] {
  try {
    const raw = readFileSync(
      join(process.cwd(), "public", "arsiv", "index.json"),
      "utf8"
    );
    return JSON.parse(raw) as ArchiveIndexItem[];
  } catch {
    return [];
  }
}
