"use client";

/**
 * Bilgi bandının sağ ucundaki kapatma düğmesi.
 *
 * İlyas 2026-08-04: *"üstteki uyarı bantlarının yanında çarpı olsun ayrı olarak
 * kapatılabilsinler, mobilde sıkış tıkış oluyo"*. Üç bant üst üste binince
 * telefonda haritaya kalan yer bir avuç oluyordu; her bandı ayrı ayrı
 * kapatmak, bandları tümden kaldırmaktan iyi — hangisini okuduğuna kullanıcı
 * karar veriyor.
 *
 * ⚠️ KAPATMANIN ÖMRÜ BANDA GÖRE DEĞİŞİR ve bu bilinçli:
 *   • Kaynak açıklamaları (Meteosat taraması, haber ihbarı) `localStorage`'da
 *     kalıcı — bir kez okununca her açılışta tekrar göstermek gereksiz.
 *   • İlk-alarm bandı ASLA kalıcı kapanmaz. O bant "uydu yeni bir ısı kaynağı
 *     gördü, henüz doğrulanmadı" diyor, yani sitenin en erken uyarısı.
 *     Kapatma yalnız O ANKİ alarm kümesi için geçerli; yeni bir kaynak
 *     belirdiğinde bant geri geliyor (bkz. App.tsx alarm imzası).
 *
 * Dokunma hedefi 24 px'in altına düşmüyor (erişilebilirlik turunda ölçülmüş
 * eşik) ama bandın yüksekliğini büyütmemek için ikon 10 px.
 */
export default function BantKapat({
  onClose,
  label,
}: {
  onClose: () => void;
  /** Ekran okuyucu için: hangi bandı kapatıyor */
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      title={label}
      aria-label={label}
      className="tap-target absolute top-0 right-0 bottom-0 flex w-7 items-center justify-center text-ink-3 transition-colors hover:text-ink"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path
          d="M1.5 1.5l7 7M8.5 1.5l-7 7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
