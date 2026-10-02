/**
 * FORJA DEL ASCENSO DE RANGO (docs/rango/moodboards/ascenso-forja.html)
 *
 * El escudo se arma POR PARTES desde rank-tiers.json (campo, filo, línea interior, gema,
 * emblema, estrellas) y cada pieza se anima por separado:
 *   1 se calienta → 2 se desarma (emblema y estrellas viejas caen) → 3 cae el filo con
 *   desenfoque y el color se expande → 4 cae el emblema y se incrusta → 5 caen las estrellas
 *   de a una (en Crack y GOAT las viejas se funden en una) → 6 ¡PUM! con el nombre.
 *
 * Uso (desde LevelUpOverlay): createForge({ root, canvas }) → { play(from, to), skip(), destroy() }
 *   root   = contenedor con .forge (escudo + nombre: es lo que tiembla), #rays, #flash y los ids
 *            #sv #wrap #nk #nn #nl adentro
 *   canvas = <canvas> para las chispas (fijo a pantalla, fuera de lo que tiembla)
 * Respeta prefers-reduced-motion (salta directo al escudo final) y se adelanta con skip().
 * Sonidos: mp3 reservados forja-clang / -rumble / -clink / -fuse / -chime; si no existen suenan
 * los sintetizados del moodboard.
 */
import DATA from '@/data/rank-tiers.json'
import { soundManager } from '@/services/sounds'

const NS = 'http://www.w3.org/2000/svg'
const SH = 'M60 6L108 26V72C108 100 84 124 60 134C36 124 12 100 12 72V26L60 6Z'
const IN = 'M60 15L99 32V72C99 95 79 115 60 124C41 115 21 95 21 72V32L60 15Z'

export const FORGE_SOUNDS = ['forjaClang', 'forjaRumble', 'forjaClink', 'forjaFuse', 'forjaChime']

export function forgeTier(key) {
  return DATA.find(t => t.k === key) || null
}

// ─── geometría ─────────────────────────────────────────────
function starPts(R, r) {
  const p = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5
    const rr = i % 2 ? r : R
    p.push((rr * Math.cos(a)).toFixed(2) + ',' + (rr * Math.sin(a)).toFixed(2))
  }
  return p.join(' ')
}
function starPos(n) {
  return n === 1 ? [[60, 104, 6.2]]
    : n === 2 ? [[52, 104, 6], [68, 104, 6]]
    : n === 3 ? [[46, 102, 6], [60, 105.5, 6], [74, 102, 6]]
    : n === 4 ? [[41, 102, 5.6], [53.5, 105.5, 5.6], [66.5, 105.5, 5.6], [79, 102, 5.6]]
    : [[38, 100, 5.2], [49, 104, 5.2], [60, 106, 5.2], [71, 104, 5.2], [82, 100, 5.2]]
}
function defs(t) {
  const st = t.met.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')
  return `<linearGradient id="${t.p}-bg" x1="60" y1="0" x2="60" y2="140" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.bg[0]}"/><stop offset="1" stop-color="${t.bg[1]}"/></linearGradient>
 <linearGradient id="${t.p}-met" x1="24" y1="20" x2="96" y2="120" gradientUnits="userSpaceOnUse">${st}</linearGradient>
 <linearGradient id="${t.p}-shine" x1="30" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.shine}" stop-opacity=".32"/><stop offset="1" stop-color="${t.shine}" stop-opacity="0"/></linearGradient>
 <linearGradient id="${t.p}-holo" x1="12" y1="20" x2="108" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f0abfc" stop-opacity=".22"/><stop offset=".35" stop-color="#a5f3fc" stop-opacity=".06"/><stop offset=".6" stop-color="#fde68a" stop-opacity=".18"/><stop offset="1" stop-color="#86efac" stop-opacity=".05"/></linearGradient>
 <linearGradient id="${t.p}-star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0abfc"/><stop offset=".5" stop-color="#a5f3fc"/><stop offset="1" stop-color="#fde68a"/></linearGradient>`
}
function field(t) {
  return `<path d="${SH}" fill="url(#${t.p}-bg)"/><path d="${SH}" fill="url(#${t.p}-shine)"/>${t.holo ? `<path d="${SH}" fill="url(#${t.p}-holo)"/>` : ''}`
}
function lineStroke(t) { return t.line.startsWith('url') ? `url(#${t.p}-met)` : t.line }
function starEl(t, x, y, R) {
  const g = document.createElementNS(NS, 'g')
  g.classList.add('st')
  g.style.transform = `translate(${x}px,${y}px)`
  g.innerHTML = t.stars.big
    ? `<polygon class="sp" points="${starPts(8.5, 3.7)}" fill="url(#${t.p}-star)" stroke="#fff" stroke-opacity=".7" stroke-width=".8" stroke-linejoin="round"/>`
    : `<polygon class="sp" points="${starPts(R, R * .44)}" fill="${t.stars.c}" opacity="${t.stars.op}"/>`
  return g
}

// ─── sonido (mp3 reservado → sintetizado del moodboard) ─────
// Cada sintetizado recibe (ctx, out) y arma sus voces con osc()/noise().
function voices(c, out) {
  const env = (g, t, a, d, v) => {
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(v, t + a)
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d)
  }
  return {
    osc(type, f1, f2, dur, v = .2, delay = 0) {
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain()
      o.type = type
      o.frequency.setValueAtTime(f1, t)
      o.frequency.exponentialRampToValueAtTime(f2, t + dur)
      env(g, t, .01, dur, v)
      o.connect(g).connect(out)
      o.start(t); o.stop(t + dur + .05)
    },
    noise(dur, f1, f2, v = .25, q = 1, delay = 0) {
      const t = c.currentTime + delay
      const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
      s.buffer = b
      f.type = 'bandpass'; f.Q.value = q
      f.frequency.setValueAtTime(f1, t)
      f.frequency.exponentialRampToValueAtTime(f2, t + dur)
      env(g, t, .01, dur, v)
      s.connect(f).connect(g).connect(out)
      s.start(t)
    },
  }
}
const synth = fn => (c, out) => fn(voices(c, out))
const snd = (name, fn, opts) => soundManager.playOrSynth(name, synth(fn), opts)

const S = {
  chime: () => snd('forjaChime', ({ osc }) => [1047, 1319, 1568, 2093].forEach((f, i) => osc('sine', f, f, .6, .045, .07 * i))),
  clang: p => snd('forjaClang', ({ osc, noise }) => {
    osc('sine', 130, 38, .45, .35 + p * .25)
    noise(.25, 2400, 400, .25 + p * .15, .7)
    ;[211, 563, 1033, 1687, 2410].forEach((f, i) => osc(i % 2 ? 'triangle' : 'sine', f * (1 + p * .05), f * (1 + p * .05) * .985, .5 + p * .5 - i * .06, (.09 - i * .012) * (.6 + p * .6)))
  }, { vol: .55 + Math.min(1, p) * .45 }),
  rumble: d => snd('forjaRumble', ({ osc, noise }) => { osc('sawtooth', 55, 48, d, .08); noise(d, 180, 420, .12, .6) }),
  clatter: () => snd('forjaClang', ({ osc, noise }) => {
    for (let i = 0; i < 4; i++) { osc('triangle', 700 + Math.random() * 900, 300, .12, .08, i * .07); noise(.08, 3000, 1500, .08, 1, i * .07) }
  }, { vol: .5, rate: 1.5 }),
  clink: i => snd('forjaClink', ({ osc }) => {
    const f = [1320, 1480, 1660, 1760, 1980][i % 5]
    osc('sine', f, f * .99, .4, .12); osc('triangle', f * 2.7, f * 2.6, .2, .04); osc('sine', 140, 50, .15, .18)
  }, { rate: 1 + (i % 5) * .06 }),
  fuse: () => snd('forjaFuse', ({ osc, noise }) => { osc('sine', 300, 1400, .45, .12); noise(.45, 800, 5000, .1, 2) }),
  pum: () => soundManager.playBig('pum'),
}

// ─── la forja ──────────────────────────────────────────────
export function createForge({ root, canvas, reduced = false }) {
  const $ = s => root.querySelector(s)
  const fx = canvas.getContext('2d')
  const ease3 = t => 1 - Math.pow(1 - t, 3)
  let P = []
  let runId = 0
  let raf = 0
  let alive = true
  let doneResolve = null
  let sizeOk = false
  const onResize = () => resize()
  window.addEventListener('resize', onResize)
  let target = null

  // —— partículas ——
  function resize() {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1
    canvas.width = r.width * d; canvas.height = r.height * d
    fx.setTransform(d, 0, 0, d, 0, 0)
    sizeOk = true
  }
  function toStage(x, y) {
    const sv = $('#sv'), m = sv.getScreenCTM(), pt = sv.createSVGPoint()
    pt.x = x; pt.y = y
    const q = pt.matrixTransform(m), r = canvas.getBoundingClientRect()
    return [q.x - r.left, q.y - r.top]
  }
  function burst(x, y, n, cols, sp = 4, life = 50, size = 2.6, grav = .06) {
    if (reduced) return
    const [X, Y] = toStage(x, y)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (.35 + Math.random())
      P.push({ x: X, y: Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: life * (.6 + Math.random() * .6), m: 0, c: cols[i % cols.length], s: size * (.6 + Math.random() * .8), g: grav, k: Math.random() < .5 ? 'r' : 'c' })
    }
  }
  function tick() {
    if (!alive) return
    fx.clearRect(0, 0, canvas.width, canvas.height)
    fx.globalCompositeOperation = 'lighter'
    P = P.filter(p => {
      p.m++
      const f = p.m / p.l
      if (f >= 1) return false
      p.vx *= .97; p.vy = p.vy * .97 + p.g; p.x += p.vx; p.y += p.vy
      fx.globalAlpha = 1 - f; fx.fillStyle = p.c
      if (p.k === 'r') { fx.save(); fx.translate(p.x, p.y); fx.rotate(p.m * .2); fx.fillRect(-p.s, -p.s * .35, p.s * 2, p.s * .7); fx.restore() }
      else { fx.beginPath(); fx.arc(p.x, p.y, p.s * .8, 0, 7); fx.fill() }
      return true
    })
    fx.globalAlpha = 1
    raf = requestAnimationFrame(tick)
  }

  // —— utilidades ——
  const wait = ms => new Promise(r => setTimeout(r, ms))
  function an(el, kf, ms, o = {}) {
    if (!el) return { finished: Promise.resolve() }
    return el.animate(kf, { duration: ms, fill: 'forwards', easing: o.e || 'ease-out', delay: o.d || 0 })
  }
  function shake(el, amp, ms) {
    if (reduced) return
    const k = []
    for (let i = 0; i < 10; i++) k.push({ translate: `${(Math.random() * 2 - 1) * amp}px ${(Math.random() * 2 - 1) * amp}px` })
    k.push({ translate: '0 0' })
    return an(el, k, ms, { e: 'linear' })
  }
  function tween(ms, fn, ease = t => t) {
    return new Promise(r => {
      const t0 = performance.now()
      ;(function f(n) { const t = Math.min(1, (n - t0) / ms); fn(ease(t)); t < 1 ? requestAnimationFrame(f) : r() })(t0)
    })
  }

  let blurN = 0
  function mkBlur() {
    const id = 'mb' + (blurN++), f = document.createElementNS(NS, 'filter')
    f.id = id
    f.setAttribute('filterUnits', 'userSpaceOnUse')
    f.setAttribute('x', -60); f.setAttribute('y', -200); f.setAttribute('width', 240); f.setAttribute('height', 420)
    const g = document.createElementNS(NS, 'feGaussianBlur')
    g.setAttribute('stdDeviation', '0 0')
    f.appendChild(g)
    $('#sv defs').appendChild(f)
    return { id, g }
  }
  function fall(el, { cx = 60, cy = 70, dy = -160, s0 = 1.35, ms = 420, blur = 7 } = {}) {
    const f = mkBlur()
    el.setAttribute('filter', `url(#${f.id})`)
    el.setAttribute('opacity', 0)
    return tween(ms, t => {
      const e = t * t, y = dy * (1 - e), sc = s0 + (1 - s0) * e
      el.setAttribute('transform', `translate(${cx} ${cy + y}) scale(${sc}) translate(${-cx} ${-cy})`)
      f.g.setAttribute('stdDeviation', `0 ${(blur * t).toFixed(2)}`)
      el.setAttribute('opacity', Math.min(1, t * 4))
    }).then(() => { el.removeAttribute('filter'); el.setAttribute('transform', ''); el.setAttribute('opacity', 1) })
  }
  function impact(p, x, y, b) {
    shake($('#sv'), 3 + p * 7, 240 + p * 140)
    an($('#wrap'), [{ filter: 'blur(0px)' }, { filter: `blur(${(.8 + p * 1.8).toFixed(1)}px)` }, { filter: 'blur(0px)' }], 260)
    S.clang(p)
    burst(x, y, Math.round(14 + p * 30), ['#fb923c', '#fdba74', '#fde68a', '#fff', b.glow], 2.6 + p * 2.6, 30 + p * 16, 2.2, .14)
    // humo gris
    if (reduced) return
    const [X, Y] = toStage(x, y)
    for (let i = 0; i < Math.round(6 + p * 10); i++) {
      const d = Math.random() < .5 ? -1 : 1
      P.push({ x: X, y: Y, vx: d * (1 + Math.random() * 3 * p), vy: -Math.random() * .6, l: 40, m: 0, c: '#64748b', s: 3 + Math.random() * 3, g: -.01, k: 'c' })
    }
  }

  // —— armado del escudo por partes ——
  function setup(a, b) {
    root.getAnimations({ subtree: true }).forEach(x => x.cancel())
    P = []
    const sv = $('#sv')
    sv.innerHTML = `<defs>${defs(a)}${defs(b)}<clipPath id="rise"><rect id="riseR" x="0" y="140" width="120" height="150"/></clipPath><clipPath id="flood"><circle id="floodC" cx="60" cy="72" r="0"/></clipPath><filter id="sil" x="-20%" y="-20%" width="140%" height="140%"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .65 0"/><feGaussianBlur stdDeviation=".9"/></filter><clipPath id="shclip"><path d="${SH}"/></clipPath>
 <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
 <g id="shield" style="transform-box:fill-box;transform-origin:50% 50%">
  <g id="fOld">${field(a)}</g>
  <path id="iron" d="${SH}" fill="#16181d" opacity="0"/>
  <g id="fNewF" clip-path="url(#flood)">${field(b)}</g>
  <g id="fNew" clip-path="url(#rise)">${field(b)}<path id="surf" d="M0 0" fill="none"/></g>
  <path id="rOld" d="${SH}" fill="none" stroke="url(#${a.p}-met)" stroke-width="${a.rim}"/>
  <path id="iOld" d="${IN}" fill="none" stroke="${lineStroke(a)}" stroke-width="${a.linew}" opacity="${a.lineop}"/>
  <g id="rimW"><path id="rNew" d="${SH}" fill="none" stroke="url(#${b.p}-met)" stroke-width="${b.rim}" stroke-linejoin="round"/></g>
  <g id="inW"><path id="iNew" d="${IN}" fill="none" stroke="${lineStroke(b)}" stroke-width="${b.linew}" opacity="${b.lineop}"/></g>
  <g id="gemW">${b.gem ? `<path id="gem" d="M60 19 l4.5 5.5 -4.5 5.5 -4.5 -5.5 z" fill="url(#${b.p}-met)"/>` : ''}</g>
  <g id="eOld" style="transform-box:fill-box;transform-origin:50% 50%">${a.emb}</g>
  <g id="embW"><g id="eShadow" filter="url(#sil)" transform="translate(1.6 2.4)" opacity="0">${b.emb}</g><g id="eNew" style="transform-box:fill-box;transform-origin:50% 50%;opacity:0">${b.emb}</g></g>
  <g id="cracks" opacity="0" stroke-linecap="round">${[...Array(8)].map((_, i) => { const an = i * Math.PI / 4 + .39, r1 = 25 + (i % 2) * 2, r2 = 33 + (i % 3) * 3; return `<path d="M${(60 + Math.cos(an) * r1).toFixed(1)} ${(64 + Math.sin(an) * r1).toFixed(1)} L${(60 + Math.cos(an) * r2).toFixed(1)} ${(64 + Math.sin(an) * r2).toFixed(1)}" stroke="#fdba74" stroke-width="1.6"/>` }).join('')}</g>
  <circle id="wave" style="transform-box:fill-box;transform-origin:50% 50%" cx="60" cy="64" r="10" fill="none" stroke="url(#${b.p}-met)" stroke-width="3" opacity="0"/>
  <g id="stars"></g>
  <g clip-path="url(#shclip)"><rect id="sw" x="-60" y="0" width="40" height="140" fill="url(#sweep)" transform="skewX(-18)" opacity="0"/></g>
 </g>`
    const sg = $('#stars')
    starPos(a.stars.n).forEach(([x, y, R]) => sg.appendChild(starEl(a, x, y, R)))
    root.style.setProperty('--glow', a.glow)
    const rays = $('#rays')
    rays.className = 'rays'; rays.style.opacity = 0
    ;['nk', 'nn', 'nl'].forEach(i => { $('#' + i).style.opacity = 0 })
    $('#sv').style.filter = ''
    $('#flash').style.opacity = 0
  }

  // Escudo ya forjado (salto directo: tocar para adelantar o movimiento reducido)
  function renderFinal(b) {
    root.getAnimations({ subtree: true }).forEach(x => x.cancel())
    P = []
    const sv = $('#sv')
    const stars = b.stars.big ? [[60, 105, 8]] : starPos(b.stars.n)
    sv.innerHTML = `<defs>${defs(b)}</defs><g id="shield">${field(b)}
  <path d="${SH}" fill="none" stroke="url(#${b.p}-met)" stroke-width="${b.rim}" stroke-linejoin="round"/>
  <path d="${IN}" fill="none" stroke="${lineStroke(b)}" stroke-width="${b.linew}" opacity="${b.lineop}"/>
  ${b.gem ? `<path d="M60 19 l4.5 5.5 -4.5 5.5 -4.5 -5.5 z" fill="url(#${b.p}-met)"/>` : ''}
  <g>${b.emb}</g><g id="stars"></g></g>`
    const sg = $('#stars')
    stars.forEach(([x, y, R]) => sg.appendChild(starEl(b, x, y, R)))
    root.style.setProperty('--glow', b.glow)
    const rays = $('#rays')
    rays.className = b.holo ? 'rays holo' : 'rays'
    rays.style.opacity = reduced ? 0 : .55
    $('#nn').textContent = b.n
    $('#nl').textContent = b.lv === '100' ? 'Nivel 100' : 'Niveles ' + b.lv
    ;['nk', 'nn', 'nl'].forEach(i => { $('#' + i).style.opacity = 1 })
    $('#flash').style.opacity = 0
  }

  function finish() {
    const r = doneResolve
    doneResolve = null
    r?.()
  }

  async function run(a, b, id) {
    const ok = () => id === runId && alive
    const sv = $('#sv'), box = $('.forge')
    const merge = b.stars.big || b.stars.n < a.stars.n
    $('#rNew').style.strokeDashoffset = 0
    $('#iNew').style.strokeDashoffset = 0
    ;['rimW', 'inW', 'embW', 'gemW'].forEach(i => $('#' + i).setAttribute('opacity', 0))
    $('#eNew').style.opacity = 1
    await wait(300); if (!ok()) return

    // 1 · se calienta
    S.rumble(.8)
    an(sv, [{ filter: 'brightness(1) sepia(0) saturate(1)' }, { filter: 'brightness(1.45) sepia(.7) saturate(2.4) hue-rotate(-15deg)' }], 800)
    const sk = []
    for (let i = 0; i < 14; i++) { const am = (i / 14) * 3.5; sk.push({ translate: `${(Math.random() * 2 - 1) * am}px ${(Math.random() * 2 - 1) * am}px` }) }
    sk.push({ translate: '0 0' })
    an(sv, sk, 800, { e: 'linear' })
    for (let i = 0; i < 5; i++) setTimeout(() => ok() && burst(30 + Math.random() * 60, 40 + Math.random() * 80, 6, ['#fb923c', '#fdba74', '#fde68a'], 1.2, 50, 1.8, -.04), i * 150)
    await wait(800); if (!ok()) return

    // 2 · se desarma
    S.clatter()
    an(sv, [{ filter: 'brightness(1.45) sepia(.7) saturate(2.4) hue-rotate(-15deg)' }, { filter: 'brightness(1) sepia(0) saturate(1) hue-rotate(0deg)' }], 500)
    an($('#iron'), [{ opacity: 0 }, { opacity: .88 }], 500)
    an($('#rOld'), [{ opacity: 1 }, { opacity: .25 }], 500)
    an($('#iOld'), [{ opacity: a.lineop }, { opacity: 0 }], 300)
    const eo = $('#eOld')
    tween(620, t => { eo.setAttribute('transform', `translate(${t * 14} ${t * t * 190}) rotate(${t * 28} 60 64)`); eo.style.opacity = 1 - t * t })
    if (!merge) {
      ;[...$('#stars').children].forEach((g, i) => {
        const sp = g.firstChild
        tween(520 + i * 60, t => { sp.setAttribute('transform', `translate(${(i - 2) * t * 10} ${t * t * 120}) rotate(${t * (i - 2) * 60})`); sp.style.opacity = 1 - t })
      })
    }
    await wait(650); if (!ok()) return
    if (!merge) $('#stars').innerHTML = ''

    // 3 · cae el filo (y el color se expande)
    await fall($('#rimW'), { cy: 70, dy: -170, s0: 1.3, ms: 400, blur: 8 }); if (!ok()) return
    impact(1, 60, 134, b)
    burst(12, 72, 10, ['#fb923c', '#fde68a'], 3, 26, 2, .12)
    burst(108, 72, 10, ['#fb923c', '#fde68a'], 3, 26, 2, .12)
    an($('#rOld'), [{ opacity: .25 }, { opacity: 0 }], 120)
    root.style.setProperty('--glow', b.glow)
    const fc = $('#floodC')
    tween(380, t => fc.setAttribute('r', t * 110), ease3)
    an($('#iron'), [{ opacity: .88 }, { opacity: 0 }], 420, { d: 120 })
    await wait(420); if (!ok()) return
    if (b.linew > 1) {
      await fall($('#inW'), { dy: -130, s0: 1.2, ms: 300, blur: 6 }); if (!ok()) return
      impact(.55, 60, 124, b)
      await wait(260)
    } else $('#inW').setAttribute('opacity', 1)
    if (b.gem) {
      await fall($('#gemW'), { cy: 24, dy: -80, s0: 1.6, ms: 240, blur: 5 }); if (!ok()) return
      impact(.35, 60, 26, b); S.clink(4)
      await wait(220)
    }
    if (!ok()) return

    // 4 · cae el emblema y se incrusta
    await wait(120)
    await fall($('#embW'), { cy: 64, dy: -190, s0: 1.6, ms: 460, blur: 10 }); if (!ok()) return
    impact(1.4, 60, 64, b)
    an($('#eNew'), [{ transform: 'scale(1.06,.8)', filter: 'brightness(2.6) sepia(.8) saturate(3) hue-rotate(-20deg)' }, { transform: 'scale(.96,1.05)', offset: .35 }, { transform: 'scale(1,1)', filter: 'brightness(1) sepia(0) saturate(1) hue-rotate(0deg)' }], 900, { e: 'cubic-bezier(.2,.8,.3,1)' })
    an($('#eShadow'), [{ opacity: 0 }, { opacity: 1 }], 180)
    an($('#cracks'), [{ opacity: 1 }, { opacity: 1, offset: .3 }, { opacity: 0 }], 900)
    an($('#wave'), [{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(4.6)', opacity: 0 }], 460)
    await wait(820); if (!ok()) return

    // 5 · estrellas
    const sg = $('#stars'), NP = starPos(b.stars.n)
    if (merge) {
      const olds = [...sg.children]
      const [x, y, Rr] = b.stars.big ? [60, 105, 8] : NP[0]
      olds.forEach(g => an(g.firstChild, [{ filter: 'brightness(1)' }, { filter: 'brightness(2.5)' }], 300))
      await Promise.all(olds.map((g, i) => an(g, [{ transform: g.style.transform }, { transform: `translate(${x}px,${y}px)` }], 420, { e: 'cubic-bezier(.7,0,.3,1)', d: i * 30 }).finished))
      if (!ok()) return
      olds.forEach(g => g.remove())
      S.fuse()
      an($('#flash'), [{ opacity: 0 }, { opacity: .35 }, { opacity: 0 }], 220)
      const w = document.createElementNS(NS, 'g')
      sg.appendChild(w)
      const ng = starEl(b, x, y, Rr)
      w.appendChild(ng)
      const sp = ng.firstChild
      sp.style.transformBox = 'fill-box'; sp.style.transformOrigin = '50% 50%'
      an(sp, [{ transform: 'scale(2.4)', filter: 'brightness(3)' }, { transform: 'scale(.85)', filter: 'brightness(1.6)', offset: .4 }, { transform: 'scale(1)', filter: 'brightness(1)' }], 560, { e: 'cubic-bezier(.5,0,.3,1)' })
      await wait(200)
      impact(.8, x, y, b)
      burst(x, y, 30, b.stars.big ? ['#f0abfc', '#a5f3fc', '#fde68a', '#fff'] : ['#fde047', '#fff'], 3.4, 36, 2.2, .03)
    } else {
      for (let i = 0; i < NP.length; i++) {
        if (!ok()) return
        const [x, y, Rr] = NP[i]
        const w = document.createElementNS(NS, 'g')
        sg.appendChild(w)
        w.appendChild(starEl(b, x, y, Rr))
        const last = i === NP.length - 1
        await fall(w, { cx: x, cy: y, dy: -110, s0: last ? 2 : 1.5, ms: last ? 260 : 200, blur: 5 })
        S.clink(i)
        const p = last ? .75 : .3
        shake($('#sv'), 2 + p * 6, 200)
        burst(x, y, last ? 26 : 10, [b.stars.c, '#fde68a', '#fff'], 2 + p * 2, 26, 1.8, .1)
        if (last) an(w.firstChild.firstChild, [{ filter: 'brightness(2.5)' }, { filter: 'brightness(1)' }], 500)
        await wait(last ? 0 : 90)
      }
    }
    await wait(560); if (!ok()) return

    // 6 · ¡PUM! forjado
    S.pum()
    an($('#flash'), [{ opacity: 0 }, { opacity: .9 }, { opacity: 0 }], 380)
    an($('#shield'), [{ transform: 'scale(1)' }, { transform: 'scale(1.14,.9)' }, { transform: 'scale(.96,1.06)' }, { transform: 'scale(1)' }], 520, { e: 'cubic-bezier(.3,1.4,.5,1)' })
    shake(box, 12, 420)
    an($('#wrap'), [{ filter: 'blur(0px)' }, { filter: 'blur(3px)' }, { filter: 'blur(0px)' }], 320)
    const rays = $('#rays')
    if (b.holo) rays.classList.add('holo')
    an(rays, [{ opacity: 0, scale: .5 }, { opacity: .55, scale: 1 }], 600)
    const cols = b.holo ? ['#f0abfc', '#a5f3fc', '#fde68a', '#86efac', '#fff'] : ['#fb923c', '#fde68a', '#fff', b.glow, b.met[0][1]]
    burst(60, 64, 100, cols, 7, 64, 3, .12)
    setTimeout(() => ok() && burst(60, 134, 40, ['#fb923c', '#fde68a', '#fff'], 5, 46, 2.4, .14), 90)
    $('#nn').textContent = b.n
    $('#nl').textContent = b.lv === '100' ? 'Nivel 100' : 'Niveles ' + b.lv
    an($('#nk'), [{ opacity: 0 }, { opacity: 1 }], 300, { d: 300 })
    await an($('#nn'), [{ opacity: 0, transform: 'translateY(-70px) scale(1.5)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], 300, { e: 'cubic-bezier(.55,0,1,.45)', d: 120 }).finished
    if (!ok()) return
    S.chime()
    an($('#nn'), [{ transform: 'scale(1.08,.86)' }, { transform: 'scale(1)' }], 260)
    shake(box, 6, 240)
    an($('#nl'), [{ opacity: 0 }, { opacity: 1 }], 300, { d: 100 })
    await wait(500); if (!ok()) return
    const sw = $('#sw')
    sw.setAttribute('opacity', 1)
    an(sw, [{ transform: 'skewX(-18deg) translateX(0)' }, { transform: 'skewX(-18deg) translateX(200px)' }], 900, { e: 'ease-in-out' })
    await wait(700); if (!ok()) return
    finish()
  }

  return {
    /** Reproduce la forja de `fromKey` a `toKey`. Resuelve cuando el nombre quedó estampado. */
    play(fromKey, toKey) {
      const a = forgeTier(fromKey), b = forgeTier(toKey)
      return new Promise(resolve => {
        doneResolve = resolve
        if (!a || !b) { finish(); return }
        const id = ++runId
        if (!sizeOk) resize()
        if (!raf) tick()
        setup(a, b)
        if (reduced) {
          renderFinal(b)
          setTimeout(() => id === runId && finish(), 500)
          return
        }
        run(a, b, id).catch(() => { if (id === runId) { renderFinal(b); finish() } })
        target = b
      })
    },
    /** Adelanta: corta la animación y deja el escudo ya forjado con su nombre. */
    skip() {
      if (!doneResolve) return false
      runId++
      if (target) renderFinal(target)
      setTimeout(finish, 350)
      return true
    },
    get running() { return !!doneResolve },
    resize,
    destroy() {
      alive = false
      window.removeEventListener('resize', onResize)
      runId++
      cancelAnimationFrame(raf)
      try { root.getAnimations({ subtree: true }).forEach(x => x.cancel()) } catch {}
      finish()
    },
  }
}
