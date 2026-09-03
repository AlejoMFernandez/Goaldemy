// Genera los PNG derivados de la marca vectorial (public/brand/*.svg).
// Lee los SVG reales en vez de duplicar geometría, para que nunca queden desincronizados.
// Correr de nuevo cada vez que cambie la geometría de la marca: node scripts/build-brand-assets.cjs
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const PUBLIC = path.join(__dirname, '..', 'public')
const BRAND = path.join(PUBLIC, 'brand')

function readSvg(file) {
  const raw = fs.readFileSync(path.join(BRAND, file), 'utf8')
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/)
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100'
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return { viewBox, inner }
}

function iconWithBg(size, { bg = '#0f172a', mono = false } = {}) {
  const inset = size * 0.2
  const innerSize = size * 0.6
  const { viewBox, inner } = readSvg(mono ? 'isotipo-mono.svg' : 'isotipo.svg')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}"/>
    <svg x="${inset}" y="${inset}" width="${innerSize}" height="${innerSize}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${inner}</svg>
  </svg>`
}

function ogSvg() {
  const { viewBox, inner: wordInner } = readSvg('logotipo-mono.svg')
  const [, , vbW] = viewBox.split(' ').map(Number)
  const scale = 900 / vbW
  const tx = (1200 - vbW * scale) / 2 - -16 * scale
  const ty = 152
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="glow" cx="50%" cy="32%" r="65%">
        <stop offset="0%" stop-color="#4338ca" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#0b1120" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="#0b1120"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <g transform="translate(${tx.toFixed(2)},${ty}) scale(${scale.toFixed(4)})">${wordInner}</g>
    <text x="600" y="560" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#c7cdd8" letter-spacing="0.5">Entrená tu conocimiento de fútbol</text>
  </svg>`
}

async function run() {
  const isotipoSvg = fs.readFileSync(path.join(BRAND, 'isotipo.svg'))
  const fitContain = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }

  await sharp(isotipoSvg).resize(32, 32, fitContain).png().toFile(path.join(PUBLIC, 'favicon-32.png'))
  await sharp(isotipoSvg).resize(16, 16, fitContain).png().toFile(path.join(PUBLIC, 'favicon-16.png'))

  await sharp(Buffer.from(iconWithBg(180))).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'))
  await sharp(Buffer.from(iconWithBg(192))).png().toFile(path.join(PUBLIC, 'pwa-192.png'))
  await sharp(Buffer.from(iconWithBg(512))).png().toFile(path.join(PUBLIC, 'pwa-512.png'))

  await sharp(Buffer.from(ogSvg())).png().toFile(path.join(PUBLIC, 'og-image.png'))

  console.log('Brand assets generados en public/: favicon-16.png, favicon-32.png, apple-touch-icon.png, pwa-192.png, pwa-512.png, og-image.png')
}

run().catch((e) => { console.error(e); process.exit(1) })
