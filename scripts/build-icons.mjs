// Optimiza el arte de íconos a .webp para el front.
//
// Fuente de verdad: los PNG master viven en  icon-sources/  (fuera de /public, no se deployan).
// Salida: <nombre>.webp a 512px en  public/cosmetics/icons/  (lo que consume el front).
//
// Flujo: pegá el/los PNG nuevos en public/cosmetics/icons/ (o directo en icon-sources/),
// corré  `node scripts/build-icons.mjs`  y listo (webp generados, masters guardados).
import { readdir, mkdir, rename } from 'node:fs/promises'
import { join, parse } from 'node:path'
import sharp from 'sharp'

const PUB = 'public/cosmetics/icons'
const SRC = 'icon-sources'
const SIZE = 512
const QUALITY = 82

await mkdir(SRC, { recursive: true })

// 1) Mover a icon-sources cualquier PNG master que se haya dejado en /public (no debe deployarse).
for (const f of (await readdir(PUB)).filter(f => f.toLowerCase().endsWith('.png'))) {
  await rename(join(PUB, f), join(SRC, f))
}

// 2) Generar los .webp desde los masters.
const masters = (await readdir(SRC)).filter(f => f.toLowerCase().endsWith('.png'))
if (!masters.length) {
  console.log('No hay PNG master en', SRC, '— pegá los íconos y volvé a correr.')
  process.exit(0)
}
for (const f of masters) {
  const { name } = parse(f)
  const info = await sharp(join(SRC, f))
    .resize(SIZE, SIZE, { fit: 'cover' })
    .webp({ quality: QUALITY })
    .toFile(join(PUB, `${name}.webp`))
  console.log(`  ✓ ${f.padEnd(14)} → ${name}.webp  (${(info.size / 1024).toFixed(1)} KB)`)
}
console.log(`\nListo: ${masters.length} íconos. Acordate de tener la clave en RASTER_ICONS (CosmeticIcon.vue).`)
