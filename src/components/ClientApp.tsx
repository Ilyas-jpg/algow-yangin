"use client";

import dynamic from "next/dynamic";

/**
 * Harita uygulaması tamamen tarayıcı-tarafı (Date.now, canvas, WebGL) —
 * SSR kapalı; kabuk yüklenene dek sade bir yer tutucu gösterilir.
 */
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-obsidian-1">
      <span className="font-mono text-xs text-ink-3">harita yükleniyor…</span>
    </div>
  ),
});

export default App;
