#!/usr/bin/env node
/**
 * Kit de rangos v2 → archivos estáticos, todo generado desde src/services/rank-crest.js:
 *   docs/relanzamiento/rangos-preview.html  (11 escudos / medallones / banners en S/M/L, fondo de la app)
 *   public/badges/rangos/<key>.svg          (escudo M: lo usan los <img :src="tier.image"> existentes)
 *
 *   node scripts/build-rangos-preview.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { TIERS } from '../src/services/tiers.js'
import { crestSvg, medallionSvg, bannerSvg, METALS, PATTERN_LABELS, EMBLEM_LABELS, SHAPE_LABELS } from '../src/services/rank-crest.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 1) Badges estáticos
const badgeDir = resolve(ROOT, 'public/badges/rangos')
mkdirSync(badgeDir, { recursive: true })
for (const t of TIERS) {
  writeFileSync(resolve(badgeDir, `${t.key}.svg`), crestSvg(t, { size: 'm', uid: `b-${t.key}` }) + '\n')
}

// 2) Preview HTML
const rows = TIERS.map((t, i) => {
  const k = t.kit
  const range = t.minLevel === t.maxLevel ? `NV ${t.minLevel}` : `NV ${t.minLevel}–${t.maxLevel}`
  const iconCopy = `Ícono de rango ${t.label}`
  return `
  <section class="tier">
    <header>
      <span class="n">${String(i + 1).padStart(2, '0')}</span>
      <h2>${t.label}</h2>
      <span class="r">${range} · ${t.collection}</span>
    </header>
    <p class="spec">
      <i style="background:${k.primary}"></i><i style="background:${k.secondary}"></i>
      ${PATTERN_LABELS[k.pattern]} · ${METALS[k.metal].name} · ${EMBLEM_LABELS[k.emblem]} · escudo ${SHAPE_LABELS[k.shape].toLowerCase()}
    </p>
    <div class="grid">
      <figure><div class="sizes">${crestSvg(t, { size: 's', uid: `p${i}cs` })}${crestSvg(t, { size: 'm', uid: `p${i}cm` })}${crestSvg(t, { size: 'l', uid: `p${i}cl` })}</div><figcaption>${iconCopy} · S / M / L</figcaption></figure>
      <figure><div class="sizes">${medallionSvg(t, { size: 's', uid: `p${i}ms` })}${medallionSvg(t, { size: 'm', uid: `p${i}mm` })}${medallionSvg(t, { size: 'l', uid: `p${i}ml` })}</div><figcaption>Medallón · S / M / L</figcaption></figure>
      <figure class="wide"><div class="sizes col">${bannerSvg(t, { size: 's', uid: `p${i}bs` })}${bannerSvg(t, { size: 'm', uid: `p${i}bm` })}</div><figcaption>Banner · S / M</figcaption></figure>
    </div>
  </section>`
}).join('\n')

const strip = TIERS.map((t, i) => `<div class="st">${crestSvg(t, { size: 72, uid: `s${i}` })}<span>${t.label}</span></div>`).join('')

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FULVO · Kit de rangos v2 (preview)</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #e2e8f0;
    background: radial-gradient(120% 60% at 50% 0%, #17204d 0%, #0b1024 55%, #070a1a 100%) fixed; }
  main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { margin: 0; font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-style: italic; font-weight: 800; text-transform: uppercase; font-size: 44px; color: #fff; }
  .lead { color: #94a3b8; max-width: 760px; line-height: 1.5; }
  .strip { display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0 36px; padding: 18px; border-radius: 16px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); justify-content: center; }
  .st { display: grid; justify-items: center; gap: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #cbd5e1; }
  .tier { margin: 0 0 28px; padding: 18px 20px 20px; border-radius: 18px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); }
  .tier header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .tier .n { font-weight: 800; color: #64748b; }
  .tier h2 { margin: 0; font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-style: italic; font-weight: 800; text-transform: uppercase; font-size: 30px; color: #fff; }
  .tier .r { color: #fcd34d; font-weight: 700; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
  .spec { margin: 6px 0 14px; color: #94a3b8; font-size: 13px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .spec i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; border: 1px solid rgba(255,255,255,.25); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid .wide { grid-column: 1 / -1; }
  figure { margin: 0; padding: 14px; border-radius: 14px; background: rgba(3,6,18,.45); border: 1px solid rgba(255,255,255,.06); }
  .sizes { display: flex; align-items: flex-end; gap: 18px; flex-wrap: wrap; }
  .sizes.col { flex-direction: column; align-items: flex-start; }
  .sizes svg { max-width: 100%; height: auto; filter: drop-shadow(0 8px 14px rgba(0,0,0,.45)); }
  figcaption { margin-top: 10px; font-size: 12px; color: #8b93b8; letter-spacing: .04em; }
  @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
  <h1>Kit de rangos v2</h1>
  <p class="lead">Los 11 rangos de FULVO (niveles 1–100). Escudos, medallones y banners generados por código desde
  <code>src/services/rank-crest.js</code> (template + parámetros: forma, campo con el dibujo de la camiseta, aro de metal,
  medallón central con emblema monolínea y cinta con el nombre). Archivo generado por
  <code>node scripts/build-rangos-preview.mjs</code> — no editar a mano.</p>
  <div class="strip">${strip}</div>
  ${rows}
</main>
</body>
</html>
`
mkdirSync(resolve(ROOT, 'docs/relanzamiento'), { recursive: true })
writeFileSync(resolve(ROOT, 'docs/relanzamiento/rangos-preview.html'), html)
console.log('OK · preview + ' + TIERS.length + ' badges')
