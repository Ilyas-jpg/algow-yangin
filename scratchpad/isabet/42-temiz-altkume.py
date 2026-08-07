"""
42 — TEMİZ ALT KÜMEDE EĞİT: §7.1'in bıraktığı TEK denenmemiş yol

§7.1 sonucu: yön ML'i Türkiye holdout'unda Rothermel'den ayrışmıyor.
§7.3 sebebi ölçmüştü — etiket gürültüsü sabit DEĞİL:
    rüzgâr 0-5 km/sa  → temel çizgi hatası 95,2°
    rüzgâr 20-30      → 60,9°
Az kıpırdayan yangında "yön" iyi tanımlı bir büyüklük değil; eşit ağırlıkla
eğitmek modele gürültü ezberletiyor.

HİPOTEZ: yüksek sinyalli rejimde eğit, modeli YALNIZ orada kullan, gerisinde
fiziğe (Rothermel) düş.

🔴 KAPI t0'DA BİLİNEN DEĞİŞKENLERDEN KURULMALI. Vault'un "temiz alt küme"
tarifi `q_hucreSayisi`/`q_ilerlemeKm` diyordu ama ikisi de t1'den türüyor —
tahmin anında yangının kaç hücre yakacağını bilmiyoruz. Onlarla kapı kurmak
DAĞITILAMAZ bir model üretir (ve §7.3 bunları zaten "özellik değil ağırlık"
diye işaretlemişti). Kapı adayları yalnız t0'da bilinenler:
    f_ruzgarHiz (rüzgâr hızı)   — §7.3'ün bağımsız fizik sinyali
    f_nA / f_spanA (t0 boyutu)
    f_saat (pencere uzunluğu)

🔴 TEMEL ÇİZGİ AYNI ALT KÜMEDE YENİDEN HESAPLANIR. Alt kümedeki modeli tüm
setin Rothermel'iyle kıyaslamak sahte kazanç üretir — rejim zaten kolay olduğu
için model iyi görünür. §7.1'de tam bu hata yapılmış ve düzeltilmişti
("temel çizgi saf rüzgârdı, doğrusu Rothermel").

🔴 TEK TOHUMLA KARAR YOK. §7.1'de ilk koşum "geçti" demişti, 5 tohum yayılımı
sonucu tersine çevirdi.

Koşum: py -3.14 scratchpad/isabet/42-temiz-altkume.py
"""
import json
import warnings
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

warnings.filterwarnings("ignore", category=UserWarning)
BURADA = Path(__file__).parent
KAT = 5
TOHUMLAR = [20260805, 7, 1234, 99, 2718]

meta = json.loads((BURADA / "ornekler-sutunlar.json").read_text(encoding="utf8"))
OZ = meta["ozellikler"]
df = pd.read_csv(BURADA / "ornekler.csv")
df = df[df.t_sapma.notna()].reset_index(drop=True)
df["ruzgarYon"] = (df.t_yonHam - df.t_sapma) % 360

egitim = df[df.holdout == 0].reset_index(drop=True)
holdout = df[df.holdout == 1].reset_index(drop=True)
print(
    f"Yön içeren: {len(df)} satır · eğitim {len(egitim)} ({egitim.ev.nunique()} olay) · "
    f"Türkiye holdout {len(holdout)} ({holdout.ev.nunique()} olay)\n" + "═" * 78
)


def aci_fark(a, b):
    d = np.abs((a - b) % 360)
    return np.minimum(d, 360 - d)


def rothermel_yon(d):
    """ÜRETİMDEKİ bar — 28-model.py ile birebir."""
    wr = np.deg2rad(d.ruzgarYon)
    er = np.deg2rad((d.ruzgarYon + d.f_yokusSapma) % 360)
    x = d.f_phiW * np.sin(wr) + d.f_phiS * np.sin(er)
    y = d.f_phiW * np.cos(wr) + d.f_phiS * np.cos(er)
    return np.rad2deg(np.arctan2(x, y)) % 360


ORTAK = dict(
    verbosity=-1, num_leaves=31, learning_rate=0.05, min_data_in_leaf=40,
    feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1,
    deterministic=True, force_row_wise=True, objective="regression", metric="l2",
)


def yon_modeli(egt, tst, tohum):
    """sin/cos → atan2. Dairesel hedef doğrudan L2'ye sokulmaz."""
    p = {**ORTAK, "seed": tohum, "bagging_seed": tohum, "feature_fraction_seed": tohum}
    rad = np.deg2rad(egt.t_sapma)
    ms = lgb.train(p, lgb.Dataset(egt[OZ], pd.Series(np.sin(rad))), num_boost_round=400)
    mc = lgb.train(p, lgb.Dataset(egt[OZ], pd.Series(np.cos(rad))), num_boost_round=400)
    sapma = np.rad2deg(np.arctan2(ms.predict(tst[OZ]), mc.predict(tst[OZ])))
    return aci_fark((tst.ruzgarYon + sapma) % 360, tst.t_yonHam)


def cv_medyan(egt, tohum):
    """Grup-bazlı katman-dışı hata medyanı (aynı olay iki tarafta olmaz)."""
    hata = np.full(len(egt), np.nan)
    for tr, te in GroupKFold(n_splits=KAT).split(egt[OZ], egt.t_sapma, egt.ev):
        h = yon_modeli(egt.iloc[tr].reset_index(drop=True), egt.iloc[te].reset_index(drop=True), tohum)
        hata[te] = h.to_numpy() if hasattr(h, "to_numpy") else h
    return float(np.nanmedian(hata))


# ══════════════════ KAPILAR ══════════════════
KAPILAR = {
    "TÜMÜ (kapı yok)": lambda d: pd.Series(True, index=d.index),
    "rüzgâr ≥ 10 km/sa": lambda d: d.f_ruzgarHiz >= 10,
    "rüzgâr ≥ 15 km/sa": lambda d: d.f_ruzgarHiz >= 15,
    "rüzgâr ≥ 20 km/sa": lambda d: d.f_ruzgarHiz >= 20,
    "t0 boyutu nA ≥ 10": lambda d: d.f_nA >= 10,
    "rüzgâr ≥ 15 VE nA ≥ 10": lambda d: (d.f_ruzgarHiz >= 15) & (d.f_nA >= 10),
}

print(f"{'kapı':26s} {'eğit n':>7s} {'TR n':>6s} {'TR kaps.':>9s} "
      f"{'ROTHERMEL':>10s} {'LGBM (5 tohum)':>22s}  hüküm")
print("─" * 100)

sonuclar = {}
for ad, kapi in KAPILAR.items():
    e = egitim[kapi(egitim)].reset_index(drop=True)
    h = holdout[kapi(holdout)].reset_index(drop=True)
    kaps = 100 * len(h) / len(holdout)

    # 🔴 n çok küçükse HÜKÜM VERME — §7.1'in tohum dersi burada da geçerli.
    if len(h) < 40 or len(e) < 200:
        print(f"{ad:26s} {len(e):7d} {len(h):6d} {kaps:8.1f}%  {'—':>10s} {'n YETERSİZ':>22s}  hüküm yok")
        sonuclar[ad] = {"n_egitim": len(e), "n_holdout": len(h), "hukum": "n yetersiz"}
        continue

    # temel çizgi AYNI alt kümede
    ro = float(np.median(aci_fark(rothermel_yon(h), h.t_yonHam)))

    medyanlar = [float(np.median(yon_modeli(e, h, s))) for s in TOHUMLAR]
    lo, hi = min(medyanlar), max(medyanlar)
    # Rothermel yayılımın İÇİNDEYSE fark tohum gürültüsü kadardır → ayrışma yok.
    ayristi = hi < ro
    print(
        f"{ad:26s} {len(e):7d} {len(h):6d} {kaps:8.1f}%  {ro:9.1f}° "
        f"{lo:8.1f}–{hi:.1f}° (ort {np.mean(medyanlar):.1f}) "
        f" {'✅ AYRIŞTI' if ayristi else '🔴 ayrışmadı'}"
    )
    sonuclar[ad] = {
        "n_egitim": len(e), "n_holdout": len(h), "tr_kapsam_yuzde": round(kaps, 1),
        "rothermel_medyan": round(ro, 1),
        "lgbm_yayilim": [round(lo, 1), round(hi, 1)],
        "ayristi": bool(ayristi),
    }

# ══════════════════ MELEZ: kapıda model, dışında fizik ══════════════════
print("\n" + "═" * 78)
print("MELEZ DAĞITIM — kapı içinde LGBM, dışında Rothermel (tüm Türkiye holdout'unda)")
print("═" * 78)
ro_tum = float(np.median(aci_fark(rothermel_yon(holdout), holdout.t_yonHam)))
print(f"  temel çizgi: her yerde Rothermel → medyan {ro_tum:.1f}°  (n={len(holdout)})")

for ad, kapi in KAPILAR.items():
    if ad == "TÜMÜ (kapı yok)":
        continue
    e = egitim[kapi(egitim)].reset_index(drop=True)
    h_in = holdout[kapi(holdout)].reset_index(drop=True)
    h_out = holdout[~kapi(holdout)].reset_index(drop=True)
    if len(h_in) < 40 or len(e) < 200:
        continue
    melez = []
    for s in TOHUMLAR:
        icerde = yon_modeli(e, h_in, s)
        disarda = aci_fark(rothermel_yon(h_out), h_out.t_yonHam)
        melez.append(float(np.median(np.concatenate([np.asarray(icerde), np.asarray(disarda)]))))
    lo, hi = min(melez), max(melez)
    iyi = hi < ro_tum
    print(
        f"  {ad:26s} melez medyan {lo:.1f}–{hi:.1f}°  "
        f"{'✅ Rothermel''i geçiyor' if iyi else '🔴 geçmiyor (yayılım tabanı içeriyor)'}"
    )
    sonuclar.setdefault(ad, {})["melez_yayilim"] = [round(lo, 1), round(hi, 1)]

sonuclar["_taban_rothermel_tum_holdout"] = round(ro_tum, 1)
(BURADA / "temiz-altkume-karne.json").write_text(
    json.dumps(sonuclar, ensure_ascii=False, indent=1), encoding="utf8"
)
print("\ntemiz-altkume-karne.json yazıldı.")
