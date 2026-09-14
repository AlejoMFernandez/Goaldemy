import sharp from 'sharp';

const SRC = 'public/iconclaro.png';
const OUT = 'public/google-branding-logo.png';
const CANVAS = 512;
const CONTENT_MAX = Math.round(CANVAS * 0.78); // padding so it isn't clipped by a circular crop

const meta = await sharp(SRC).metadata();
const scale = Math.min(CONTENT_MAX / meta.width, CONTENT_MAX / meta.height);
const newWidth = Math.round(meta.width * scale);
const newHeight = Math.round(meta.height * scale);

const resized = await sharp(SRC)
    .resize(newWidth, newHeight, { fit: 'contain' })
    .toBuffer();

await sharp({
    create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: { r: 8, g: 15, b: 30, alpha: 1 }, // fondo oscuro sólido (mismo tono que el navbar) en vez de transparente: Google compone sobre blanco y el ícono es claro
    },
})
    .composite([{ input: resized, left: Math.round((CANVAS - newWidth) / 2), top: Math.round((CANVAS - newHeight) / 2) }])
    .png()
    .toFile(OUT);

console.log(`Written ${OUT} (${newWidth}x${newHeight} content centered in ${CANVAS}x${CANVAS})`);
