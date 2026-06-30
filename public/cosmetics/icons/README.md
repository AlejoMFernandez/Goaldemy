# Íconos raster (arte IA)

Acá viven los `.webp` optimizados que usa el front para los íconos de usuario top.
`CosmeticIcon.vue` los renderiza full-bleed; si falta el archivo, cae al emblema SVG.

## Activos hoy
`ball` · `boot` · `crown` · `goat` · `trophy` (todos en `RASTER_ICONS` de `CosmeticIcon.vue`).

## Agregar / actualizar un ícono

1. Generá el PNG **cuadrado (1:1)** con su fondo temático (sin transparencia).
2. Pegá el PNG acá (`public/cosmetics/icons/`) — el nombre = **clave semántica**
   (`goat.png`, `crown.png`, `trophy.png`, `ball.png`, `boot.png`, `medal`, `star`, `shield`, `gloves`).
3. Corré desde la raíz: `node scripts/build-icons.mjs`
   - genera `<nombre>.webp` (512px) acá,
   - y mueve el PNG master a `icon-sources/` (fuera de /public, no se deploya, queda de backup).
4. Si la clave es nueva (no está en la lista de arriba), agregala al set `RASTER_ICONS`
   en `src/components/rewards/CosmeticIcon.vue`.

## Brief de estilo (para ChatGPT / Midjourney)

Estilo ícono de invocador de **League of Legends** / ítem de **Rocket League**:
sujeto centrado que llena el cuadro, render rico, luz de borde (rim light), pulido AAA,
legible en chico, fondo temático según el ícono, acentos de marca esmeralda→cian + oro.
Cuadrado 1:1. **Sin texto, sin marco** (el borde lo agrega la app).
