/**
 * Kanada Orman Yangını Hava İndeksi (FWI) — Van Wagner & Pickett (1985)
 * standart denklemleri.
 *
 * Neden gerekli: "rüzgâr 40 km/sa, nem %25" ham veridir. FWI bunları
 * yakıt kuruluğuyla birleştirip tek bir tehlike sayısına indirger —
 * itfaiye teşkilatlarının onlarca yıldır kullandığı ortak dil.
 *
 * Girdiler öğle (yerel 12:00) değerleridir: sıcaklık °C, bağıl nem %,
 * rüzgâr km/sa, son 24 saatin yağışı mm.
 */

export interface FwiCodes {
  /** İnce yakıt nemi — tutuşma kolaylığı */
  ffmc: number;
  /** Orta derinlik organik katman nemi */
  dmc: number;
  /** Derin katman kuruluğu — mevsimsel */
  dc: number;
  /** İlk yayılma indeksi (rüzgâr + FFMC) */
  isi: number;
  /** Yanabilir yakıt miktarı */
  bui: number;
  /** Nihai yangın hava indeksi */
  fwi: number;
}

/** Başlangıç değerleri (standart bahar başlangıcı) */
export const FWI_START = { ffmc: 85, dmc: 6, dc: 15 };

/** Aylık gündüz uzunluğu düzeltmeleri (45°K civarı — Türkiye için uygun) */
const DAY_LENGTH_DMC = [6.5, 7.5, 9, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8, 7, 6];
const DAY_LENGTH_DC = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5, 2.4, 0.4, -1.6, -1.6];

function calcFFMC(t: number, rh: number, wind: number, rain: number, prev: number): number {
  let mo = (147.2 * (101 - prev)) / (59.5 + prev);

  if (rain > 0.5) {
    const rf = rain - 0.5;
    if (mo > 150) {
      mo =
        mo +
        42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf)) +
        0.0015 * Math.pow(mo - 150, 2) * Math.sqrt(rf);
    } else {
      mo = mo + 42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf));
    }
    if (mo > 250) mo = 250;
  }

  const ed =
    0.942 * Math.pow(rh, 0.679) +
    11 * Math.exp((rh - 100) / 10) +
    0.18 * (21.1 - t) * (1 - Math.exp(-0.115 * rh));

  let m: number;
  if (mo > ed) {
    const ko =
      0.424 * (1 - Math.pow(rh / 100, 1.7)) +
      0.0694 * Math.sqrt(wind) * (1 - Math.pow(rh / 100, 8));
    const kd = ko * 0.581 * Math.exp(0.0365 * t);
    m = ed + (mo - ed) * Math.pow(10, -kd);
  } else {
    const ew =
      0.618 * Math.pow(rh, 0.753) +
      10 * Math.exp((rh - 100) / 10) +
      0.18 * (21.1 - t) * (1 - Math.exp(-0.115 * rh));
    if (mo < ew) {
      const kl =
        0.424 * (1 - Math.pow((100 - rh) / 100, 1.7)) +
        0.0694 * Math.sqrt(wind) * (1 - Math.pow((100 - rh) / 100, 8));
      const kw = kl * 0.581 * Math.exp(0.0365 * t);
      m = ew - (ew - mo) * Math.pow(10, -kw);
    } else {
      m = mo;
    }
  }

  const ffmc = (59.5 * (250 - m)) / (147.2 + m);
  return Math.max(0, Math.min(101, ffmc));
}

function calcDMC(t: number, rh: number, rain: number, prev: number, month: number): number {
  let pr = prev;
  if (rain > 1.5) {
    const re = 0.92 * rain - 1.27;
    const mo = 20 + Math.exp(5.6348 - prev / 43.43);
    let b: number;
    if (prev <= 33) b = 100 / (0.5 + 0.3 * prev);
    else if (prev <= 65) b = 14 - 1.3 * Math.log(prev);
    else b = 6.2 * Math.log(prev) - 17.2;
    const mr = mo + (1000 * re) / (48.77 + b * re);
    pr = Math.max(0, 244.72 - 43.43 * Math.log(mr - 20));
  }
  const tc = Math.max(-1.1, t);
  const k =
    1.894 * (tc + 1.1) * (100 - rh) * DAY_LENGTH_DMC[month] * 1e-6;
  return Math.max(0, pr + 100 * k);
}

function calcDC(t: number, rain: number, prev: number, month: number): number {
  let pr = prev;
  if (rain > 2.8) {
    const rd = 0.83 * rain - 1.27;
    const qo = 800 * Math.exp(-prev / 400);
    const qr = qo + 3.937 * rd;
    pr = Math.max(0, 400 * Math.log(800 / qr));
  }
  const tc = Math.max(-2.8, t);
  const v = 0.36 * (tc + 2.8) + DAY_LENGTH_DC[month];
  return Math.max(0, pr + 0.5 * Math.max(0, v));
}

function calcISI(wind: number, ffmc: number): number {
  const m = (147.2 * (101 - ffmc)) / (59.5 + ffmc);
  const ff = 91.9 * Math.exp(-0.1386 * m) * (1 + Math.pow(m, 5.31) / 4.93e7);
  return 0.208 * Math.exp(0.05039 * wind) * ff;
}

function calcBUI(dmc: number, dc: number): number {
  if (dmc === 0 && dc === 0) return 0;
  if (dmc <= 0.4 * dc) return (0.8 * dmc * dc) / (dmc + 0.4 * dc);
  return dmc - (1 - (0.8 * dc) / (dmc + 0.4 * dc)) * (0.92 + Math.pow(0.0114 * dmc, 1.7));
}

function calcFWI(isi: number, bui: number): number {
  const fd =
    bui <= 80
      ? 0.626 * Math.pow(bui, 0.809) + 2
      : 1000 / (25 + 108.64 * Math.exp(-0.023 * bui));
  const b = 0.1 * isi * fd;
  if (b <= 1) return b;
  return Math.exp(2.72 * Math.pow(0.434 * Math.log(b), 0.647));
}

export interface FwiDay {
  t: number;
  rh: number;
  wind: number;
  rain: number;
  month: number;
}

/**
 * Günlük seriyi baştan sona işleyerek son günün kodlarını verir.
 * Seri ne kadar uzunsa (tercihen 2+ hafta) DC/DMC o kadar gerçekçi olur.
 */
export function runFwiSeries(days: FwiDay[], start = FWI_START): FwiCodes | null {
  if (!days.length) return null;
  let { ffmc, dmc, dc } = start;
  for (const d of days) {
    ffmc = calcFFMC(d.t, d.rh, d.wind, d.rain, ffmc);
    dmc = calcDMC(d.t, d.rh, d.rain, dmc, d.month);
    dc = calcDC(d.t, d.rain, dc, d.month);
  }
  const last = days[days.length - 1];
  const isi = calcISI(last.wind, ffmc);
  const bui = calcBUI(dmc, dc);
  const fwi = calcFWI(isi, bui);
  const r = (x: number) => Math.round(x * 10) / 10;
  return { ffmc: r(ffmc), dmc: r(dmc), dc: r(dc), isi: r(isi), bui: r(bui), fwi: r(fwi) };
}

/** EFFIS'in Avrupa için kullandığı tehlike sınıfları */
export function fwiClass(fwi: number): { label: string; level: 0 | 1 | 2 | 3 | 4 | 5 } {
  if (fwi < 5.2) return { label: "Çok düşük", level: 0 };
  if (fwi < 11.2) return { label: "Düşük", level: 1 };
  if (fwi < 21.3) return { label: "Orta", level: 2 };
  if (fwi < 38.0) return { label: "Yüksek", level: 3 };
  if (fwi < 50.0) return { label: "Çok yüksek", level: 4 };
  return { label: "Aşırı", level: 5 };
}
