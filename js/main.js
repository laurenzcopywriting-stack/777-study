/**
 * Choreografie der 777-Konzeptseite.
 *
 * Motorik aus cinema-scroll/ („ATLAS"): ScrollSmoother, ein gepinntes Kapitel,
 * eine horizontale Passage, Masken-Reveal, Spannungsbogen. Das durchgehende
 * Element ist hier keine Shader-Wolke, sondern eine Bildsequenz am Scroll.
 */
import { buehneStarten, ist, ziel } from './sequence.js'

const { gsap, ScrollTrigger, ScrollSmoother } = window
gsap.registerPlugin(ScrollTrigger, ScrollSmoother)

const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const breitGenug = () => window.matchMedia('(min-width: 860px)').matches

/** Elemente, die die Hauptchoreografie bereits bewegt. Szenen dürfen sie
 *  nicht anfassen — siehe konflikt(). */
const belegt = new WeakSet()

// --- Wort-Masken ----------------------------------------------------------
// Jedes Wort in einen Kasten mit overflow: hidden. Das aria-label trägt den
// Satz am Stück, sonst liest der Screenreader Wort für Wort.
function maskieren(el) {
  // Nur echte Leerzeichen trennen — ein geschütztes (&nbsp;) hält zwei
  // Wörter in einer Maske zusammen, damit kein Wort allein in der Zeile steht.
  const roh = el.textContent.replace(/[ \t\n\r]+/g, ' ').trim()
  const satz = roh.replace(/\u00a0/g, ' ')
  const woerter = roh.split(' ')
  const akzent = Number(el.dataset.accent ?? 0)
  el.setAttribute('aria-label', satz)
  const huelle = document.createElement('span')
  huelle.setAttribute('aria-hidden', 'true')
  woerter.forEach((wort, i) => {
    const maske = document.createElement('span')
    maske.className = 'mask'
    const innen = document.createElement('span')
    innen.className = 'word' + (akzent && i >= woerter.length - akzent ? ' word--accent' : '')
    innen.textContent = wort
    maske.append(innen)
    huelle.append(maske, ' ')
  })
  el.replaceChildren(huelle)
}
document.querySelectorAll('.masked').forEach(maskieren)

/** Eine Flug-Strecke 0..1 in den Frame-Fortschritt übersetzen. Die
 *  generierte Fahrt ist vorn langsam und hinten schnell; die Kurve gleicht
 *  das aus, damit sich der Anflug über den Scroll gleichmäßig anfühlt. */
const anflug = (p) => 1 - Math.pow(1 - p, 1.7)

// --- Bühne ------------------------------------------------------------------
const buehne = buehneStarten({
  canvas: document.querySelector('.stage__canvas'),
  scrim: document.querySelector('.stage__scrim'),
  ruhig,
})

// --- Smooth Scrolling ------------------------------------------------------
// Muss vor allen anderen ScrollTriggern entstehen, weil es den Scroller ersetzt.
let smoother
if (!ruhig) {
  smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.15,
    normalizeScroll: true,
  })
}

// --- Einstieg ----------------------------------------------------------------
// fromTo statt to: die Prozent-Startwerte kann GSAP nicht aus dem CSS lesen.
const intro = gsap.timeline({ paused: true })
intro
  .set('.hero__inner, .hero__cue', { autoAlpha: 1 })
  .fromTo('.hero__kicker', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0)
  .fromTo(
    '.hero__title .word',
    { yPercent: 108 },
    { yPercent: 0, duration: ruhig ? 0 : 1.15, ease: 'expo.out', stagger: 0.06 },
    0.15
  )
  .fromTo(
    '.hero__meta, .hero__cue',
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.12 },
    '-=0.6'
  )
  .fromTo(ziel, { dunkel: 1 }, { dunkel: 0.12, duration: 2.2, ease: 'power1.inOut' }, 0)

// Auftritt erst, wenn das Hero-Frame steht — sonst blendet Text auf Schwarz.
buehne.then(() => (ruhig ? intro.progress(1) : intro.play())).catch(() => intro.progress(1))

/** Schreibt eine Kennzahl formatiert ins Element. */
function zahlSetzen(el, wert) {
  const stellen = Number(el.dataset.decimals ?? 0)
  const zahl = wert.toLocaleString('en-US', { minimumFractionDigits: stellen, maximumFractionDigits: stellen })
  const einheit = (el.dataset.suffix ?? '').trim()
  el.textContent = zahl
  if (einheit) {
    const span = document.createElement('span')
    span.className = 'figure__unit'
    span.textContent = einheit
    el.append(span)
  }
}


function choreografie() {
  // --- 1 · Hero verlässt die Bühne -------------------------------------------
  // Text steigt, das Flugzeug kommt näher: gegenläufig auf derselben Strecke.
  belegt.add(document.querySelector('.hero__inner'))
  gsap
    .timeline({
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.8,
        onUpdate: (self) => {
          ziel.flug = anflug(self.progress * 0.24)
          ziel.dunkel = 0.12 + self.progress * 0.06
        },
      },
    })
    .to('.hero__inner', { yPercent: -45, opacity: 0, ease: 'none' }, 0)
    .to('.hero__cue', { opacity: 0, ease: 'none' }, 0)

  // --- 2 · Gepinntes Kapitel ---------------------------------------------------
  const panels = gsap.utils.toArray('.panel')
  const kapitel = gsap.timeline({
    scrollTrigger: {
      trigger: '.chapter',
      start: 'top top',
      end: '+=300%',
      pin: '.chapter__stage',
      scrub: 1,
      onUpdate: (self) => {
        const p = self.progress
        ziel.flug = anflug(0.24 + p * 0.76)
        // Spannungsbogen statt Rampe: am Höhepunkt des Kapitels tritt das
        // Bild am weitesten hervor, davor und danach liegt es ruhiger.
        ziel.dunkel = 0.18 - Math.sin(p * Math.PI) * 0.1
        ziel.zoom = 1 + Math.sin(p * Math.PI) * 0.025
        // Das Flugzeug rückt nach rechts, je größer es wird — links bleibt
        // Platz für die Schrift. Gegenläufig zu den Wörtern, die nach oben gehen.
        ziel.drift = gsap.parseEase('power2.inOut')(p) * 0.07
      },
    },
  })

  panels.forEach((panel, i) => {
    const woerter = panel.querySelectorAll('.word')
    const rumpf = panel.querySelector('.panel__body')
    const linie = panel.querySelector('.panel__rule')
    const index = panel.querySelector('.panel__index')
    ;[rumpf, linie, index].forEach((el) => belegt.add(el))
    const bei = i * 1.0

    kapitel
      .fromTo(index, { opacity: 0 }, { opacity: 1, duration: 0.25 }, bei)
      .fromTo(woerter, { yPercent: 108 }, { yPercent: 0, ease: 'expo.out', stagger: 0.04, duration: 0.4 }, bei)
      .fromTo(linie, { scaleX: 0 }, { scaleX: 1, ease: 'power2.inOut', duration: 0.4 }, bei + 0.05)
      .fromTo(rumpf, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.35 }, bei + 0.12)

    if (i < panels.length - 1) {
      kapitel
        .to(woerter, { yPercent: -135, ease: 'power2.in', stagger: 0.02, duration: 0.3 }, bei + 0.68)
        .to([rumpf, linie, index], { opacity: 0, y: -16, ease: 'power2.in', duration: 0.25 }, bei + 0.7)
    }
  })

  // --- 3 · Horizontale Passage -------------------------------------------------
  // Unter 860 px läuft sie nicht; dort ist die Spur per CSS eine Liste.
  const mm = gsap.matchMedia()
  mm.add('(min-width: 860px)', () => {
    const spur = document.querySelector('.family__track')
    belegt.add(spur)
    const weite = () => Math.max(0, spur.scrollWidth - window.innerWidth)

    gsap.to(spur, {
      x: () => -weite(),
      ease: 'none', // MUSS none sein, sonst laufen Scroll und Spur auseinander
      scrollTrigger: {
        trigger: '.family',
        start: 'top top',
        end: () => `+=${weite()}`,
        pin: '.family__stage',
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Das Bild weicht zurück und driftet gegen die Spur nach rechts.
          ziel.dunkel = 0.76 + self.progress * 0.06
          ziel.drift = 0.07 + self.progress * 0.03
          ziel.zoom = 1.025 + self.progress * 0.04
        },
      },
    })
  })
  mm.add('(max-width: 859px)', () => {
    ScrollTrigger.create({
      trigger: '.family',
      start: 'top bottom',
      end: 'top top',
      scrub: true,
      onUpdate: (self) => (ziel.dunkel = 0.18 + self.progress * 0.64),
    })
  })

  // Übergang Kapitel → Passage: das Bild tritt zurück, bevor die Karten kommen.
  ScrollTrigger.create({
    trigger: '.family',
    start: 'top bottom',
    end: 'top top',
    scrub: true,
    onUpdate: (self) => {
      if (breitGenug()) ziel.dunkel = 0.18 + self.progress * 0.58
    },
  })

  // --- 4 · Flügel: Abblende, dann die Spitze am Scroll -----------------
  ScrollTrigger.create({
    trigger: '.wing',
    start: 'top bottom',
    end: 'top top',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress
      // Abblende über Schwarz statt Überblendung: zwei Motive gleichzeitig
      // ergäben eine Doppelbelichtung. Erst ins Dunkel, dann Motivwechsel,
      // dann wieder heraus.
      ziel.mix = p < 0.5 ? 0 : 1
      ziel.fluegel = 0
      ziel.drift = p < 0.5 ? 0.1 : 0
      ziel.zoom = p < 0.5 ? 1.065 : 1.04 - (p - 0.5) * 0.08
      ziel.dunkel = p < 0.5 ? 0.82 + p * 0.36 : 1 - (p - 0.5) * 1.84
    },
  })

  ScrollTrigger.create({
    trigger: '.wing',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      ziel.mix = 1
      ziel.fluegel = self.progress
      ziel.dunkel = 0.08
    },
  })

  // --- 5 · Zahlen ----------------------------------------------------------------
  ScrollTrigger.create({
    trigger: '.figures',
    start: 'top bottom',
    end: 'top 30%',
    scrub: true,
    onUpdate: (self) => (ziel.dunkel = 0.08 + self.progress * 0.8),
  })

  gsap.utils.toArray('.figure__value').forEach((el) => {
    const zaehler = { v: 0 }
    zahlSetzen(el, 0)
    gsap.to(zaehler, {
      v: Number(el.dataset.value ?? 0),
      duration: 1.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: () => zahlSetzen(el, zaehler.v),
    })
  })

  gsap.from('.figure', {
    opacity: 0,
    y: 32,
    duration: 0.9,
    ease: 'power2.out',
    stagger: 0.1,
    scrollTrigger: { trigger: '.figures__grid', start: 'top 85%', once: true },
  })
  gsap.utils.toArray('.figure').forEach((el) => belegt.add(el))

  // --- 6 · Specs: das Bild tritt fast ganz zurück ----------------------------
  ScrollTrigger.create({
    trigger: '.specs',
    start: 'top bottom',
    end: 'top top',
    scrub: true,
    onUpdate: (self) => (ziel.dunkel = 0.88 + self.progress * 0.06),
  })

  // --- 7 · Ausklang: der ausgeklappte Flügel kommt noch einmal leise hervor ---
  gsap
    .timeline({
      scrollTrigger: {
        trigger: '.outro',
        start: 'top bottom',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: (self) => (ziel.dunkel = 0.94 - self.progress * 0.34),
      },
    })
    .fromTo('.outro__title .word', { yPercent: 108 }, { yPercent: 0, ease: 'expo.out', stagger: 0.05, duration: 0.5 }, 0.15)

  // --- Keyframe-Ebene --------------------------------------------------------------
  szenenAnlegen()

  // --- Fortschrittsleiste ------------------------------------------------------
  gsap.to('.progress__fill', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  })
}

/**
 * Bewegung als Datensatz, nicht als Code (Muster aus daniel-schwarz-web/).
 * Ein Element, ein Driver (die Scrollstrecke), Keyframes zwischen 0 und 1.
 * Zu heftig? Zahl kleiner machen. Jede Szene nennt in `gegen`, wogegen sie
 * geschichtet ist — eine Bewegung ohne Gegenstück ist meist eine zu viel.
 */
const SZENEN = [
  {
    name: 'Flügel: Maß am Gate sinkt',
    ziel: '.wing__block--a .wing__figure',
    auf: '.wing__block--a',
    von: 'top top',
    bis: 'bottom top',
    weiche: 0.9,
    bei: { 0: { yPercent: 0 }, 1: { yPercent: 28 } },
    gegen: 'Flügelspitze klappt nach unten, der Block steigt — die Zahl bleibt zurück',
  },
  {
    name: 'Flügel: Maß in der Luft steigt auf',
    ziel: '.wing__block--c .wing__figure',
    auf: '.wing__block--c',
    von: 'top bottom',
    bis: 'center center',
    weiche: 0.9,
    bei: { 0: { yPercent: 40 }, 1: { yPercent: 0 } },
    gegen: 'Spitze rastet waagerecht ein, die Zahl kommt von unten dagegen',
  },
  {
    name: 'Familie: Modellname zieht nach',
    ziel: '.model__name',
    auf: '.family',
    von: 'top top',
    bis: () => `+=${Math.max(0, document.querySelector('.family__track').scrollWidth - window.innerWidth)}`,
    weiche: 1,
    abBreite: 860,
    bei: { 0: { x: 60 }, 1: { x: -60 } },
    versatz: (i, n) => 1 - i / (n * 1.6),
    gegen: 'Spur fährt nach links, das Bild driftet nach rechts, die Namen liegen dazwischen',
  },
  {
    name: 'Zahlen: Wert gegen Beschriftung',
    ziel: '.figure__label',
    auf: '.figures',
    von: 'top bottom',
    bis: 'bottom top',
    weiche: 0.8,
    bei: { 0: { y: 18 }, 1: { y: -10 } },
    gegen: 'Werte stehen, Beschriftung wandert langsam nach oben',
  },
]

/** Wege und Winkel lassen sich skalieren, Größe und Deckkraft nicht. */
const SKALIERBAR = ['x', 'y', 'xPercent', 'yPercent', 'rotation']

/** Ziele, die schon eine Transform bekommen, werden übersprungen und gemeldet.
 *  Kinder eines bewegten Containers sind erlaubt — wer mehr Tiefe will,
 *  bewegt die Kinder, nicht den Container. */
function konflikt(el, szene) {
  if (!belegt.has(el)) return false
  console.warn(`[Szene „${szene.name}"] übersprungen: Ziel wird bereits bewegt.`, el)
  return true
}

function szenenAnlegen() {
  SZENEN.forEach((szene) => {
    if (szene.abBreite && window.innerWidth < szene.abBreite) return
    const ziele = gsap.utils.toArray(szene.ziel)
    ziele.forEach((el, i) => {
      if (konflikt(el, szene)) return
      const faktor = szene.versatz ? szene.versatz(i, ziele.length) : 1
      const skaliert = (werte) =>
        Object.fromEntries(Object.entries(werte).map(([k, v]) => [k, SKALIERBAR.includes(k) ? v * faktor : v]))
      gsap.fromTo(el, skaliert(szene.bei[0]), {
        ...skaliert(szene.bei[1]),
        ease: 'none',
        scrollTrigger: {
          trigger: szene.auf,
          start: szene.von,
          end: szene.bis,
          scrub: szene.weiche,
          invalidateOnRefresh: true,
        },
      })
      belegt.add(el)
    })
  })
}

// --- Start ---------------------------------------------------------------------
// Erst hier: SZENEN und Helfer sind deklariert (const liegt sonst in der TDZ).
if (ruhig) {
  // Reduzierte Bewegung: kein Pin, keine Passage, keine Scrub-Fahrt. Die
  // Bühne zeigt pro Abschnitt ein festes Standbild — harter Schnitt statt
  // Bewegung. Alle Texte stehen im Endzustand (siehe CSS).
  document.documentElement.classList.add('no-pin')
  const STANDBILD = {
    hero: { flug: 0.3, mix: 0, fluegel: 0, dunkel: 0.12, drift: 0 },
    chapter: { flug: 1, mix: 0, fluegel: 0, dunkel: 0.3, drift: 0.07 },
    family: { flug: 1, mix: 0, fluegel: 0, dunkel: 0.8, drift: 0.07 },
    wing: { mix: 1, fluegel: 1, dunkel: 0.12, drift: 0 },
    figures: { mix: 1, fluegel: 1, dunkel: 0.85, drift: 0 },
    specs: { mix: 1, fluegel: 1, dunkel: 0.94, drift: 0 },
    outro: { mix: 1, fluegel: 1, dunkel: 0.6, drift: 0 },
  }
  const beobachter = new IntersectionObserver(
    (eintraege) => {
      eintraege.forEach((e) => {
        if (e.isIntersecting) Object.assign(ziel, STANDBILD[e.target.dataset.section] ?? {})
      })
    },
    // Nur die Linie in der Bildmitte zählt — genau ein Abschnitt ist aktiv.
    { rootMargin: '-50% 0px -50% 0px' }
  )
  document.querySelectorAll('[data-section]').forEach((el) => beobachter.observe(el))
} else {
  choreografie()
}

// Nach dem Laden der Schriften verschieben sich Zeilen — Marken neu setzen.
document.fonts?.ready.then(() => ScrollTrigger.refresh())

// Dev-Hooks: Zustände direkt prüfen, ohne dorthin zu scrollen.
window.__b777 = { ziel, ist, smoother, ScrollTrigger, settleIntro: () => intro.progress(1) }
buehne.then((b) => (window.__b777.zeichnen = b.zeichnen))
