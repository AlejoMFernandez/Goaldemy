// Optimiza el arte de las AYUDAS (power-ups) a .webp para el front.
//
// Fuente: PNG master en public/ayudas/ (o icon-sources/ayudas/).
// Salida: <nombre>.webp a 256px en public/ayudas/ (lo que consume el front).
// Masters (PNG) se mueven a icon-sources/ayudas/ (gitignored, no se deployan).
//
// Flujo: pegá los PNG en public/ayudas/ y corré `node scripts/build-ayudas.mjs`.
import { readdir, mkdir, rename } from 'node:fs/promises'
import { join, parse } from 'node:path'
import sharp from 'sharp'

const PUB = 'public/ayudas'
const SRC = 'icon-sources/ayudas'
const SIZE = 256
const QUALITY = 85

await mkdir(PUB, { recursive: true })
await mkdir(SRC, { recursive: true })

// 1) Mover a icon-sources/ayudas cualquier PNG master dejado en /public.
for (const f of (await readdir(PUB)).filter(f => f.toLowerCase().endsWith('.png'))) {
  await rename(join(PUB, f), join(SRC, f))
}

// 2) Generar los .webp desde los masters.
const masters = (await readdir(SRC)).filter(f => f.toLowerCase().endsWith('.png'))
if (!masters.length) {
  console.log('No hay PNG master en', SRC, '— pegá las ayudas y volvé a correr.')
  process.exit(0)
}
for (const f of masters) {
  const { name } = parse(f)
  const info = await sharp(join(SRC, f))
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: QUALITY })
    .toFile(join(PUB, `${name}.webp`))
  console.log(`  ✓ ${f.padEnd(18)} → ${name}.webp  (${(info.size / 1024).toFixed(1)} KB)`)
}
console.log(`\nListo: ${masters.length} ayudas en ${PUB}.`)
