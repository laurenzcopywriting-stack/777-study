# 777 — Designstudie

Freie Studie: Produktseite einer Langstrecken-Flugzeugfamilie im Stil
„Cinematic Editorial". Eine KI-generierte Bildsequenz hängt am Scroll —
Anflug durch die Dämmerung, später die Flügelspitze, die am Scroll ausklappt.

Unabhängige Arbeit, nicht verbunden mit dem Hersteller. Produktnamen sind
Marken ihrer jeweiligen Inhaber. Die Bilder sind KI-generiert und zeigen kein
reales Flugzeug.

**Technik:** statisches HTML, GSAP 3.15 (ScrollTrigger, ScrollSmoother) lokal in
`vendor/`, Bildsequenz als WebP auf einem Canvas, `prefers-reduced-motion` mit
Standbildern statt Bewegung.

Lokal starten: `python3 -m http.server` im Ordner, dann `http://localhost:8000`.
