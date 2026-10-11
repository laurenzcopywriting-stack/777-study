/**
 * Die Bühne: zwei Bildsequenzen auf einem fixierten Canvas.
 *
 * Kein Video-Scrubbing — currentTime ist auf iOS-Safari unzuverlässig.
 * Der Scroll schreibt einen Fortschritt (0..1) in `ziel`, die Renderschleife
 * zieht `ist` gedämpft hinterher und malt das passende Frame. Bewusst kein
 * Framework-State: ScrollTrigger schreibt, requestAnimationFrame liest.
 */

/** Wohin die Choreografie will. ScrollTrigger schreibt hier hinein. */
export const ziel = {
  flug: 0, // Fortschritt der Anflug-Sequenz, 0..1
  fluegel: 0, // Fortschritt der Flügelspitze, 0..1
  mix: 0, // 0 = Anflug sichtbar, 1 = Flügel sichtbar
  dunkel: 0.1, // Abdunklung über dem Bild, 0..1
  zoom: 1, // leichte Skalierung als Gegenbewegung
  drift: 0, // seitlicher Versatz in Bildbreiten, Gegenbewegung zur Passage
}

/** Was gerade zu sehen ist — läuft `ziel` gedämpft hinterher. */
export const ist = { ...ziel }

/** Nähert `wert` an `soll` an, unabhängig von der Bildrate. */
function daempfen(wert, soll, lambda, dt) {
  return wert + (soll - wert) * (1 - Math.exp(-lambda * dt))
}

/** Eine Bildsequenz: lädt Frames, liefert das nächste bereits geladene. */
class Sequenz {
  constructor(name, anzahl, breite) {
    this.anzahl = anzahl
    this.bilder = new Array(anzahl)
    this.fertig = new Array(anzahl).fill(false)
    this.pfad = (i) => `frames/${name}/${breite}/${String(i + 1).padStart(4, '0')}.webp`
  }

  /** Grobe Abdeckung zuerst (jedes 8. Frame), dann auffüllen. So steht die
   *  ganze Strecke früh in grober Auflösung und wird dann feiner. */
  reihenfolge() {
    const ordnung = []
    for (const schritt of [8, 4, 2, 1]) {
      for (let i = 0; i < this.anzahl; i += schritt) {
        if (!ordnung.includes(i)) ordnung.push(i)
      }
    }
    return ordnung
  }

  async laden(i) {
    const img = new Image()
    img.decoding = 'async'
    img.src = this.pfad(i)
    try {
      await img.decode()
      this.bilder[i] = img
      this.fertig[i] = true
    } catch {
      // Ein fehlendes Frame darf die Seite nicht anhalten — das nächste
      // geladene Nachbarframe springt ein.
    }
  }

  async alleLaden(gleichzeitig = 6) {
    const warteschlange = this.reihenfolge()
    const arbeiter = Array.from({ length: gleichzeitig }, async () => {
      while (warteschlange.length) await this.laden(warteschlange.shift())
    })
    await Promise.all(arbeiter)
  }

  /** Frame zum Fortschritt; fehlt es noch, das nächstgelegene geladene. */
  frame(fortschritt) {
    const soll = Math.round(Math.min(Math.max(fortschritt, 0), 1) * (this.anzahl - 1))
    for (let d = 0; d < this.anzahl; d++) {
      if (this.fertig[soll - d]) return this.bilder[soll - d]
      if (this.fertig[soll + d]) return this.bilder[soll + d]
    }
    return null
  }
}

/**
 * Startet die Bühne. `ruhig` = reduzierte Bewegung: keine Dämpfung, die
 * Werte springen direkt auf ihr Ziel.
 */
export async function buehneStarten({ canvas, scrim, ruhig }) {
  const manifest = await fetch('frames/manifest.json').then((r) => r.json())

  // Auflösung nach tatsächlich benötigten Pixeln, nicht nach Gerätetyp.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const breite = window.innerWidth * dpr > 1100 ? 1600 : 900

  const flug = new Sequenz('flight', manifest.flight.count, breite)
  const fluegel = new Sequenz('wing', manifest.wing.count, breite)

  // Das erste Frame vor allem anderen — es ist das Hero-Bild.
  await flug.laden(0)

  const ctx = canvas.getContext('2d', { alpha: false })
  let w = 0
  let h = 0

  function groesse() {
    w = Math.round(window.innerWidth * dpr)
    h = Math.round(window.innerHeight * dpr)
    canvas.width = w
    canvas.height = h
    zuletzt = null
  }

  /** Malt ein Bild formatfüllend (cover), mit Zoom und seitlicher Drift. */
  function malen(img, alpha) {
    if (!img) return
    const skal = Math.max(w / img.naturalWidth, h / img.naturalHeight) * ist.zoom
    const bw = img.naturalWidth * skal
    const bh = img.naturalHeight * skal
    // Drift nur so weit, wie Bild übersteht — nie eine leere Kante zeigen.
    const reserve = Math.max(0, (bw - w) / 2)
    const x = (w - bw) / 2 + Math.max(-reserve, Math.min(reserve, ist.drift * w))
    const y = (h - bh) / 2
    ctx.globalAlpha = alpha
    ctx.drawImage(img, x, y, bw, bh)
  }

  let zuletzt = null
  let vorher = performance.now()

  /** Malt den aktuellen Zustand von `ist`. Auch direkt aufrufbar — im
   *  versteckten Tab friert requestAnimationFrame ein. */
  function zeichnen() {
    const a = flug.frame(ist.flug)
    const b = fluegel.frame(ist.fluegel)
    const schluessel = `${a?.src}|${b?.src}|${ist.mix.toFixed(3)}|${ist.dunkel.toFixed(3)}|${ist.zoom.toFixed(4)}|${ist.drift.toFixed(4)}`

    // Nur malen, wenn sich etwas geändert hat — spart Akku im Stillstand.
    if (schluessel !== zuletzt) {
      zuletzt = schluessel
      ctx.globalAlpha = 1
      ctx.fillStyle = '#05080c'
      ctx.fillRect(0, 0, w, h)
      if (ist.mix < 0.999) malen(a, 1)
      if (ist.mix > 0.001) malen(b, ist.mix)
      ctx.globalAlpha = ist.dunkel
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
      scrim.style.setProperty('--scrim', String(1 - ist.dunkel * 0.6))
    }
  }

  function bild(jetzt) {
    const dt = Math.min((jetzt - vorher) / 1000, 0.1)
    vorher = jetzt

    for (const k of Object.keys(ziel)) {
      // Frames etwas zügiger als Licht und Zoom — sonst wirkt die Fahrt zäh.
      const lambda = k === 'mix' ? 14 : k === 'flug' || k === 'fluegel' ? 7 : 3.5
      ist[k] = ruhig ? ziel[k] : daempfen(ist[k], ziel[k], lambda, dt)
    }

    zeichnen()
    requestAnimationFrame(bild)
  }

  groesse()
  window.addEventListener('resize', groesse)
  requestAnimationFrame(bild)

  // Der Rest lädt im Hintergrund: erst die Anflug-Strecke, dann der Flügel.
  flug.alleLaden().then(() => fluegel.alleLaden())

  return { flug, fluegel, zeichnen }
}
