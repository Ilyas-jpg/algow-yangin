"""
28 — §7.1 ÜÇ HEDEF, LightGBM

Girdi:  ornekler.csv (27-ornek.mjs) · ornekler-sutunlar.json
Çıktı:  model-karne.json + ekrana karne

Hedefler:
  1. t_buyudu  ikili   — bir sonraki geçişe kadar ölçülebilir ilerleme oldu mu
  2. t_mesafe  km      — olduysa ne kadar (yalnız pozitiflerde, sansürlüler hariç)
  3. yön       derece  — sapmanın SIN/COS'u, atan2 ile birleştirilir

🔑 Yön neden sin/cos: t_sapma [-180,180] aralığında ama KENDİSİ DE DAİRESEL.
   L2 ile doğrudan regresyona sokulursa −179° ile +179° arası 358° sanılır,
   oysa 2°. Veride kütlenin çoğu ±180 civarında (%90 dilim 158°), yani bu
   teorik değil pratik bir hata olurdu. İki regresör → atan2.

🔴 BÖLME OLAY (`ev`) BAZLI. Aynı yangının vakaları bağımsız değil (olay başına
   medyan 1 vaka ama max 34). Satır bazlı bölme aynı yangını hem eğitime hem
   teste koyar ve skoru şişirir.

🔴 TÜRKİYE HOLDOUT hiç görülmez — ne eğitimde ne çapraz doğrulamada.

Koşum:  py -3.14 scratchpad/isabet/28-model.py
"""
import json
import warnings
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import GroupKFold

warnings.filterwarnings("ignore", category=UserWarning)
BURADA = Path(__file__).parent
TOHUM = 20260805
KAT = 5

meta = json.loads((BURADA / "ornekler-sutunlar.json").read_text(encoding="utf8"))
OZ = meta["ozellikler"]
df = pd.read_csv(BURADA / "ornekler.csv")

egitim = df[df.holdout == 0].reset_index(drop=True)
holdout = df[df.holdout == 1].reset_index(drop=True)
print(
    f"{len(df)} satır · {len(OZ)} özellik\n"
    f"eğitim  {len(egitim):5d} satır / {egitim.ev.nunique():4d} olay\n"
    f"holdout {len(holdout):5d} satır / {holdout.ev.nunique():4d} olay (Türkiye, hiç görülmez)\n"
    + "═" * 74
)

# Rüzgâr yönü özelliklerde yok (bölgeye ezberlemesin) ama geri çevirme için
# lazım: t_yonHam = rüzgâr + t_sapma ⇒ rüzgâr = t_yonHam − t_sapma.
for d in (egitim, holdout):
    d["ruzgarYon"] = (d.t_yonHam - d.t_sapma) % 360


def aci_fark(a, b):
    """Mutlak açı farkı, derece, [0,180]."""
    d = np.abs((a - b) % 360)
    return np.minimum(d, 360 - d)


def gruplu_cv(X, y, gruplar, params, agirlik=None, n_tur=400):
    """GroupKFold ile katman-dışı tahmin üret. Aynı olay asla iki tarafta olmaz."""
    oof = np.full(len(y), np.nan)
    gkf = GroupKFold(n_splits=KAT)
    for tr, te in gkf.split(X, y, gruplar):
        ds = lgb.Dataset(
            X.iloc[tr], y.iloc[tr] if hasattr(y, "iloc") else y[tr],
            weight=None if agirlik is None else agirlik[tr],
        )
        m = lgb.train(params, ds, num_boost_round=n_tur)
        oof[te] = m.predict(X.iloc[te])
    return oof


def tam_model(X, y, params, agirlik=None, n_tur=400):
    ds = lgb.Dataset(X, y, weight=agirlik)
    return lgb.train(params, ds, num_boost_round=n_tur)


ORTAK = dict(
    verbosity=-1, seed=TOHUM, num_leaves=31, learning_rate=0.05,
    min_data_in_leaf=40, feature_fraction=0.8, bagging_fraction=0.8,
    bagging_freq=1, deterministic=True, force_row_wise=True,
)
karne = {}

# ══════════════════ HEDEF 1: BÜYÜME OLASILIĞI ══════════════════
print("\nHEDEF 1 — büyüme olasılığı (ikili)")
X1, y1 = egitim[OZ], egitim.t_buyudu
p1 = {**ORTAK, "objective": "binary", "metric": "average_precision"}
oof1 = gruplu_cv(X1, y1, egitim.ev, p1)
m1 = tam_model(X1, y1, p1)
h1 = m1.predict(holdout[OZ])

taban = y1.mean()  # her şeye "büyür" demenin PR-AUC'si
karne["buyume"] = {
    "taban_oran": round(float(taban), 4),
    "cv_pr_auc": round(float(average_precision_score(y1, oof1)), 4),
    "cv_roc_auc": round(float(roc_auc_score(y1, oof1)), 4),
    "holdout_pr_auc": round(float(average_precision_score(holdout.t_buyudu, h1)), 4),
    "holdout_roc_auc": round(float(roc_auc_score(holdout.t_buyudu, h1)), 4),
}
print(
    f"  taban (hep 'büyür') PR-AUC {taban:.4f}\n"
    f"  CV      PR-AUC {karne['buyume']['cv_pr_auc']:.4f} · ROC-AUC {karne['buyume']['cv_roc_auc']:.4f}\n"
    f"  HOLDOUT PR-AUC {karne['buyume']['holdout_pr_auc']:.4f} · ROC-AUC {karne['buyume']['holdout_roc_auc']:.4f}"
)

# ══════════════════ HEDEF 2: BÜYÜME MESAFESİ ══════════════════
print("\nHEDEF 2 — büyüme mesafesi (km, yalnız büyüyenler, sansürlüler hariç)")
me = egitim[(egitim.t_mesafe.notna()) & (egitim.t_mesafeSansur == 0)].reset_index(drop=True)
mh = holdout[(holdout.t_mesafe.notna()) & (holdout.t_mesafeSansur == 0)].reset_index(drop=True)
X2, y2 = me[OZ], me.t_mesafe
taban2 = float(y2.median())  # sabit medyan tahmini
karne["mesafe"] = {"n_egitim": len(me), "n_holdout": len(mh), "taban_medyan_km": round(taban2, 3)}
print(f"  n eğitim {len(me)} · holdout {len(mh)}")
print(f"  {'':26s} {'CV MAE':>9s} {'HOLD MAE':>10s}  (km, düşük iyi)")
print(
    f"  {'taban: sabit medyan':26s} {np.abs(y2 - taban2).mean():8.3f} {np.abs(mh.t_mesafe - taban2).mean():9.3f}"
)
karne["mesafe"]["taban_MAE_km"] = round(float(np.abs(y2 - taban2).mean()), 3)
karne["mesafe"]["holdout_taban_MAE_km"] = round(float(np.abs(mh.t_mesafe - taban2).mean()), 3)

# Dağılım çarpık (medyan 1,63 · %90 6,08). Ham L1 ile log1p'yi İKİSİNİ de koş —
# "sinyal yok" ile "dönüşüm yanlış" ayrılsın.
for etiket, don, geri in (
    ("LGBM ham km (L1)", lambda v: v, lambda v: v),
    ("LGBM log1p (L1)", np.log1p, np.expm1),
):
    p2 = {**ORTAK, "objective": "regression_l1", "metric": "l1"}
    oof = geri(gruplu_cv(X2, pd.Series(don(y2.to_numpy())), me.ev, p2))
    m = tam_model(X2, pd.Series(don(y2.to_numpy())), p2)
    hp = geri(m.predict(mh[OZ]))
    cv_mae = float(np.abs(y2 - oof).mean())
    ho_mae = float(np.abs(mh.t_mesafe - hp).mean())
    print(f"  {etiket:26s} {cv_mae:8.3f} {ho_mae:9.3f}")
    karne["mesafe"][etiket] = {"cv_MAE_km": round(cv_mae, 3), "holdout_MAE_km": round(ho_mae, 3)}

# ══════════════════ HEDEF 3: YÖN ══════════════════
print("\nHEDEF 3 — yön (sapmanın sin/cos'u → atan2)")
yo = egitim[egitim.t_sapma.notna()].reset_index(drop=True)
yh = holdout[holdout.t_sapma.notna()].reset_index(drop=True)


def yon_kos(egt, tst, agirlik, etiket):
    X, Xt = egt[OZ], tst[OZ]
    rad = np.deg2rad(egt.t_sapma)
    p = {**ORTAK, "objective": "regression", "metric": "l2"}
    oof_s = gruplu_cv(X, pd.Series(np.sin(rad)), egt.ev, p, agirlik)
    oof_c = gruplu_cv(X, pd.Series(np.cos(rad)), egt.ev, p, agirlik)
    cv_sapma = np.rad2deg(np.arctan2(oof_s, oof_c))
    cv_yon = (egt.ruzgarYon + cv_sapma) % 360
    cv_hata = aci_fark(cv_yon, egt.t_yonHam)

    ms = tam_model(X, pd.Series(np.sin(rad)), p, agirlik)
    mc = tam_model(X, pd.Series(np.cos(rad)), p, agirlik)
    h_sapma = np.rad2deg(np.arctan2(ms.predict(Xt), mc.predict(Xt)))
    h_yon = (tst.ruzgarYon + h_sapma) % 360
    h_hata = aci_fark(h_yon, tst.t_yonHam)
    return cv_hata, h_hata, (ms, mc)


def ozet(h):
    return dict(
        medyan=round(float(np.median(h)), 1),
        ort=round(float(np.mean(h)), 1),
        oran45=round(float((h <= 45).mean() * 100), 1),
        oran90=round(float((h <= 90).mean() * 100), 1),
    )


# ── temel çizgiler ──
# (a) saf rüzgâr: sapma = 0, "yangın rüzgârla gider"
tc_cv = aci_fark(yo.ruzgarYon, yo.t_yonHam)
tc_h = aci_fark(yh.ruzgarYon, yh.t_yonHam)


def rothermel_yon(d):
    """ÜRETİMDEKİ bar: rüzgâr ve yokuş vektörlerinin φw/φs ağırlıklı toplamı
    (05b-model.mjs `vecSum`). Saf rüzgâr fazla kolay bir bar — asıl yenilmesi
    gereken bu."""
    wr = np.deg2rad(d.ruzgarYon)
    er = np.deg2rad((d.ruzgarYon + d.f_yokusSapma) % 360)  # yokuş-yukarı bearing
    x = d.f_phiW * np.sin(wr) + d.f_phiS * np.sin(er)
    y = d.f_phiW * np.cos(wr) + d.f_phiS * np.cos(er)
    return np.rad2deg(np.arctan2(x, y)) % 360


ro_cv = aci_fark(rothermel_yon(yo), yo.t_yonHam)
ro_h = aci_fark(rothermel_yon(yh), yh.t_yonHam)

# ölçüm dedi ki: etiket gürültüsü hücre sayısıyla azalıyor. Ağırlıklı ve
# ağırlıksız İKİSİNİ de koş — varsayma, ölç.
agir = np.log1p(yo.q_hucreSayisi.fillna(0).to_numpy())
sonuc = {}
# 🔴 TEK TOHUMLA KARAR VERME. Holdout n=404; "model Rothermel'i geçti/geçemedi"
# sonucu tohum gürültüsü kadarsa hiçbir şey söylememiştir. Yayılımı ölç.
TOHUMLAR = [20260805, 7, 1234, 99, 2718]
for etiket, w in (("ağırlıksız", None), ("ağırlıklı log1p(hücre)", agir)):
    cvler, holar = [], []
    for s in TOHUMLAR:
        ORTAK["seed"] = s
        ORTAK["bagging_seed"] = s
        ORTAK["feature_fraction_seed"] = s
        cv_h, ho_h, _ = yon_kos(yo, yh, w, etiket)
        cvler.append(ozet(cv_h)["medyan"])
        holar.append(ozet(ho_h)["medyan"])
    ORTAK["seed"] = TOHUM
    ORTAK.pop("bagging_seed", None)
    ORTAK.pop("feature_fraction_seed", None)
    cv_h, ho_h, _ = yon_kos(yo, yh, w, etiket)
    sonuc[etiket] = {
        "cv": ozet(cv_h), "holdout": ozet(ho_h),
        "tohum_yayilim_cv": [min(cvler), max(cvler)],
        "tohum_yayilim_holdout": [min(holar), max(holar)],
    }

karne["yon"] = {
    "n_egitim": len(yo), "n_holdout": len(yh),
    "taban_ruzgar_cv": ozet(tc_cv), "taban_ruzgar_holdout": ozet(tc_h),
    "taban_rothermel_cv": ozet(ro_cv), "taban_rothermel_holdout": ozet(ro_h),
    **sonuc,
}
print(f"  n eğitim {len(yo)} · holdout {len(yh)}")
print(f"  {'':26s} {'CV medyan':>10s} {'≤45°':>7s} {'HOLD medyan':>12s} {'≤45°':>7s}")
for ad, c, h in (
    ("temel çizgi: saf rüzgâr", tc_cv, tc_h),
    ("temel çizgi: ROTHERMEL", ro_cv, ro_h),
):
    print(f"  {ad:26s} {ozet(c)['medyan']:9.1f}° {ozet(c)['oran45']:6.1f}% {ozet(h)['medyan']:11.1f}° {ozet(h)['oran45']:6.1f}%")
for e, s in sonuc.items():
    print(
        f"  LGBM {e:21s} {s['cv']['medyan']:9.1f}° {s['cv']['oran45']:6.1f}% "
        f"{s['holdout']['medyan']:11.1f}° {s['holdout']['oran45']:6.1f}%"
    )
print(f"  {'':26s} {'':>10s} {'':>7s}   5 tohumda yayılım:")
for e, s in sonuc.items():
    print(
        f"  LGBM {e:21s} CV {s['tohum_yayilim_cv'][0]:.1f}–{s['tohum_yayilim_cv'][1]:.1f}° · "
        f"HOLDOUT {s['tohum_yayilim_holdout'][0]:.1f}–{s['tohum_yayilim_holdout'][1]:.1f}°"
    )

# ══════════════════ ÖZELLİK ÖNEMİ ══════════════════
print("\nÖZELLİK ÖNEMİ (kazanç, hedef 1)")
onem = sorted(zip(OZ, m1.feature_importance("gain")), key=lambda x: -x[1])
top = sum(v for _, v in onem)
for ad, v in onem[:12]:
    print(f"  {ad:22s} {100 * v / top:5.1f}%")
karne["onem_buyume"] = {a: round(float(100 * v / top), 2) for a, v in onem}

(BURADA / "model-karne.json").write_text(json.dumps(karne, ensure_ascii=False, indent=1), encoding="utf8")

# ══════════════════ BÜYÜME TAHMİNLERİNİ DIŞA VER ══════════════════
# 30-koni-kisitla.mjs bunları kullanıp "büyümeyecek yangına koni çizme"
# fikrinin kapsama/alan bilançosunu çıkarıyor. CV tahmini katman-dışı
# (oof1), holdout tahmini modeli hiç görmemiş sette.
tahmin = pd.concat(
    [
        pd.DataFrame({"ev": egitim.ev, "t0": egitim.t0, "holdout": 0, "p": oof1, "t_buyudu": egitim.t_buyudu}),
        pd.DataFrame({"ev": holdout.ev, "t0": holdout.t0, "holdout": 1, "p": h1, "t_buyudu": holdout.t_buyudu}),
    ]
)
tahmin.to_csv(BURADA / "buyume-tahmin.csv", index=False)
print(f"\nmodel-karne.json + buyume-tahmin.csv ({len(tahmin)} satır) yazıldı.")
