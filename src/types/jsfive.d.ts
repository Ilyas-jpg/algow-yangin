/**
 * jsfive tip bildirimi — paket kendi tiplerini getirmiyor.
 * Yalnız kullandığımız yüzey tanımlanıyor.
 */
declare module "jsfive" {
  interface Dataset {
    value: ArrayLike<number> & { length: number };
    attrs?: Record<string, unknown>;
    shape?: number[];
  }

  export class File {
    constructor(buffer: ArrayBuffer, filename?: string);
    keys: string[];
    attrs?: Record<string, unknown>;
    get(name: string): Dataset | null;
  }
}
