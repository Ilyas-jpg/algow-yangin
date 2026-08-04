/**
 * Yapılandırılmış veriyi belgeye gömer.
 *
 * `application/ld+json` çalıştırılabilir betik değil; tarayıcı ayrıştırıp
 * bırakıyor. Yine de gövde JSON.stringify'dan geçiyor ve `<` kaçırılıyor:
 * veri sözlükten geliyor ama arşiv/il adları veriye bağlı ve bir gün
 * içlerinde `</script>` geçerse belge kapanırdı.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
