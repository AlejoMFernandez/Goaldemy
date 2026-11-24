// Genera los íconos de la PWA / apps nativas en public/icons/.
//
//   node scripts/generate-icons.mjs [ruta-al-logo.png]
//
// Fuente por defecto: public/goaldemy.png (la pelota blanca del logo, fondo
// transparente — la misma que usan favicon y apple-touch-icon). Mide ~194px,
// así que el upscale a 512 queda un poco blando: si algún día hay un master
// vectorial o de 1024px, pasalo como argumento y regenerá.
//
// Salidas:
//   icon-192.png            ícono "any" (fondo oscuro, pelota al 66%)
//   icon-512.png            ícono "any"
//   icon-maskable-512.png   "maskable": la pelota entra en la zona segura (círculo del 80%)
//   apple-touch-icon-180.png  iOS (sin transparencia, iOS redondea solo)
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = process.argv[2] || 'public/goaldemy.png'
const OUT = 'public/icons'
const BG = '#0b1220' // fondo del body (src/style.css)

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.66 },
  { file: 'icon-512.png', size: 512, scale: 0.66 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.56 },
  { file: 'apple-touch-icon-180.png', size: 180, scale: 0.7 },
]

await mkdir(OUT, { recursive: true })

for (const t of targets) {
  const inner = Math.round(t.size * t.scale)
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png()
    .toBuffer()
  await sharp({ create: { width: t.size, height: t.size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, t.file))
  console.log(`  ✓ ${t.file} (${t.size}px)`)
}
