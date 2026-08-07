"""
43 — 42'nin TEK POZİTİF SONUCUNU KIRMAYA ÇALIŞ

42'de altı kapı denendi, biri geçti: `f_nA >= 10` (t0'da ≥10 tespit).
LGBM 5 tohum 68,2–78,9° · Rothermel 80,8° · melez 70,6–78,6° vs 79,9°.

🔴 ALTI DENEMEDEN BİRİ GEÇTİ — bu tam olarak çoklu karşılaştırma tuzağı.
Bu projede ölçümler defalarca ikinci bakışta tersine döndü (§7.6 alan kazancı,
WindNinja k'sı, "büyüyor" rozeti, karne kapsaması). İnanmadan önce kırmayı dene:

  ① EŞİK DUYARLILIĞI — kazanç yalnız nA=10'da varsa bıçak sırtıdır, gürültüdür.
    (WindNinja dersi: "en iyi k her katta gürültüyü takip ediyor".)
  ② DAHA ÇOK TOHUM — 5 az; 12 tohumda yayılım tabanı içeriyor mu?
  ③ MEDYAN DIŞI ÖLÇÜT — medyan tek bir noktadır; ortalama ve ≤45° oranı da
    aynı yöne mi gidiyor?
  ④ CV TARAFI — holdout'ta kazanıp CV'de kaybediyorsa şüpheli.
  ⑤ SAHTE KAPI (plasebo) — nA yerine ALAKASIZ bir değişkenle aynı orana kapı
    kur; o da "kazanıyorsa" kazandıran şey kapı değil alt küme büyüklüğüdür.

Koşum: py -3.14 scratchpad/isabet/43-nA-saglamlik.py
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
TOHUMLAR = [20260805, 7, 1234, 99, 2718, 31337, 512, 8080, 424242, 11, 65537, 3]

meta = json.loads((BURADA / "ornekler-sutunlar.json").read_text(encoding="utf8"))
OZ = meta["ozellikler"]
df = pd.read_csv(BURADA / "ornekler.csv")
df = df[df.t_sapma.notna()].reset_index(drop=True)
df["ruzgarYon"] = (df.t_yonHam - df.t_sapma) % 360
egitim = df[df.holdout == 0].reset_index(drop=True)
holdout = df[df.holdout == 1].reset_index(drop=True)


def aci_fark(a, b):
    d = np.abs((a - b) % 360)
    return np.minimum(d, 360 - d)


def rothermel_yon(d):
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


def yon_hata(egt, tst, tohum):
    p = {**ORTAK, "seed": tohum, "bagging_seed": tohum, "feature_fraction_seed": tohum}
    rad = np.deg2rad(egt.t_sapma)
    ms = lgb.train(p, lgb.Dataset(egt[OZ], pd.Series(np.sin(rad))), num_boost_round=400)
    mc = lgb.train(p, lgb.Dataset(egt[OZ], pd.Series(np.cos(rad))), num_boost_round=400)
    sapma = np.rad2deg(np.arctan2(ms.predict(tst[OZ]), mc.predict(tst[OZ])))
    return np.asarray(aci_fark((tst.ruzgarYon + sapma) % 360, tst.t_yonHam))


# ══════════ ① + ② + ③ EŞİK DUYARLILIĞI, 12 TOHUM, ÜÇ ÖLÇÜT ══════════
print("① EŞİK DUYARLILIĞI (12 tohum) — kazanç yalnız nA=10'da mı?\n")
print(f"{'eşik':>7s} {'eğit':>6s} {'TR':>5s} {'ROTH med':>9s} {'LGBM med yayılım':>20s} "
      f"{'ROTH ort':>9s} {'LGBM ort':>9s} {'ROTH≤45':>8s} {'LGBM≤45':>8s}  hüküm")
print("─" * 108)
esik_sonuc = {}
for esik in [5, 8, 10, 12, 15, 20, 30]:
    e = egitim[egitim.f_nA >= esik].reset_index(drop=True)
    h = holdout[holdout.f_nA >= esik].reset_index(drop=True)
    if len(h) < 40 or len(e) < 200:
        print(f"{esik:7d} {len(e):6d} {len(h):5d}   n yetersiz")
        continue
    ro_h = aci_fark(rothermel_yon(h), h.t_yonHam)
    med, ort, o45 = [], [], []
    for s in TOHUMLAR:
        x = yon_hata(e, h, s)
        med.append(float(np.median(x)))
        ort.append(float(np.mean(x)))
        o45.append(float((x <= 45).mean() * 100))
    ayr = max(med) < float(np.median(ro_h))
    print(
        f"{esik:7d} {len(e):6d} {len(h):5d} {float(np.median(ro_h)):8.1f}° "
        f"{min(med):8.1f}–{max(med):.1f}° {float(np.mean(ro_h)):8.1f}° {np.mean(ort):8.1f}° "
        f"{float((ro_h <= 45).mean() * 100):7.1f}% {np.mean(o45):7.1f}%  {'✅' if ayr else '🔴'}"
    )
    esik_sonuc[esik] = {
        "n_egitim": len(e), "n_holdout": len(h),
        "roth_medyan": round(float(np.median(ro_h)), 1),
        "lgbm_medyan_yayilim": [round(min(med), 1), round(max(med), 1)],
        "roth_ort": round(float(np.mean(ro_h)), 1), "lgbm_ort": round(float(np.mean(ort)), 1),
        "roth_45": round(float((ro_h <= 45).mean() * 100), 1), "lgbm_45": round(float(np.mean(o45)), 1),
        "ayristi": bool(ayr),
    }

# ══════════ ④ CV TARAFI (nA ≥ 10) ══════════
print("\n④ CV TARAFI (nA ≥ 10, grup-bazlı katman-dışı) — holdout'takiyle aynı yöne mi gidiyor?")
e10 = egitim[egitim.f_nA >= 10].reset_index(drop=True)
ro_cv = aci_fark(rothermel_yon(e10), e10.t_yonHam)
cv_med = []
for s in TOHUMLAR[:5]:
    hata = np.full(len(e10), np.nan)
    for tr, te in GroupKFold(n_splits=5).split(e10[OZ], e10.t_sapma, e10.ev):
        hata[te] = yon_hata(e10.iloc[tr].reset_index(drop=True), e10.iloc[te].reset_index(drop=True), s)
    cv_med.append(float(np.nanmedian(hata)))
cv_roth = float(np.median(ro_cv))
cv_hukum = "✅ aynı yön" if max(cv_med) < cv_roth else "🔴 CV tarafinda kazanmiyor"
print(f"  Rothermel CV medyan {cv_roth:.1f}° · LGBM CV {min(cv_med):.1f}–{max(cv_med):.1f}° {cv_hukum}")

# ══════════ ⑤ PLASEBO KAPI ══════════
# nA≥10 Türkiye holdout'unun %63,9'unu tutuyor. Aynı oranı ALAKASIZ bir
# değişkenle tutan kapılar da "kazanıyorsa", kazandıran şey nA değil.
print("\n⑤ PLASEBO KAPI — nA ile aynı oranı tutan alakasız değişkenler")
hedef_oran = (holdout.f_nA >= 10).mean()
print(f"  hedef kapsam: %{100 * hedef_oran:.1f}")
plasebo_sonuc = {}
for ad in ["f_yilGunu", "f_yukseklik", "f_gunSaati", "f_nem"]:
    kes = float(egitim[ad].quantile(1 - hedef_oran))
    e = egitim[egitim[ad] >= kes].reset_index(drop=True)
    h = holdout[holdout[ad] >= kes].reset_index(drop=True)
    if len(h) < 40 or len(e) < 200:
        print(f"  {ad:14s} n yetersiz (TR {len(h)})")
        continue
    ro_h = aci_fark(rothermel_yon(h), h.t_yonHam)
    med = [float(np.median(yon_hata(e, h, s))) for s in TOHUMLAR[:5]]
    ayr = max(med) < float(np.median(ro_h))
    print(
        f"  {ad:14s} TR n={len(h):4d} (%{100 * len(h) / len(holdout):.0f})  "
        f"ROTH {float(np.median(ro_h)):5.1f}° · LGBM {min(med):.1f}–{max(med):.1f}°  "
        f"{'⚠️ BU DA KAZANDI' if ayr else 'kazanmadı'}"
    )
    plasebo_sonuc[ad] = {"ayristi": bool(ayr), "n_holdout": len(h)}

(BURADA / "nA-saglamlik-karne.json").write_text(
    json.dumps({"esik": esik_sonuc, "cv_nA10": [round(min(cv_med), 1), round(max(cv_med), 1)],
                "cv_rothermel": round(float(np.median(ro_cv)), 1), "plasebo": plasebo_sonuc},
               ensure_ascii=False, indent=1), encoding="utf8")
print("\nnA-saglamlik-karne.json yazıldı.")
