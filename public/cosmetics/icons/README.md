# Íconos raster (arte IA) — drop-in

Acá van los PNG/WEBP de arte para los íconos de usuario **top-tier**.

## Cómo agregar arte a un ícono

1. Generá la imagen **cuadrada (1:1)** con su fondo temático horneado (no hace falta transparencia).
   Recomendado: WEBP, ~256×256 o 512×512, < 60 KB.
2. Guardala acá con el nombre = **clave semántica** del ícono + `.webp`:
   - `goat.webp` → ícono GOAT (legendario)
   - `crown.webp` → ícono Corona (legendario)
   - `trophy.webp` → ícono Trofeo (épico)
   - (otros: `ball`, `boot`, `gloves`, `medal`, `star`, `shield`)
3. Listo. `CosmeticIcon.vue` la usa automáticamente (full-bleed) y, si el archivo no existe,
   cae al emblema SVG de fallback. No hay que tocar código.

## Para habilitar una clave nueva

Las claves que intentan cargar raster están en `RASTER_ICONS` dentro de
`src/components/rewards/CosmeticIcon.vue`. Hoy: `goat`, `crown`, `trophy`.
Para sumar otra (p.ej. `star`), agregá `'star'` a ese set y pegá `star.webp` acá.

## Brief de estilo (para el generador IA)

Estilo ícono de invocador de **League of Legends** / ítem de **Rocket League**:
sujeto centrado, render rico, luz de borde (rim light), pulido nivel videojuego AAA,
legible en chico, fondo temático según el ícono. Marca Goaldemy: esmeralda→cian con
acentos oro/rojo. Sin texto.
