"use client";

import { useEffect, useState } from "react";

export function AppIntro() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      closeIntro();
    }, 3800);

    return () => window.clearTimeout(fallback);
  }, []);

  function closeIntro() {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 420);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className={`app-intro ${leaving ? "app-intro-leaving" : ""}`} aria-hidden="true">
      <video
        className="app-intro-video"
        src="/blgasm-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={closeIntro}
        onError={closeIntro}
      />
    </div>
  );
}
