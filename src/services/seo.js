// Actualiza title/meta/canonical del documento en cada navegación (SPA sin SSR).
// Sin esto, Google indexaba todas las rutas con el mismo <title>/description
// fijo de index.html (duplicate content). Se llama desde router.afterEach y,
// para rutas con datos dinámicos (equipo, competición), desde la propia página
// una vez que carga el nombre real (ver TeamPage.vue / CompetitionPage.vue).

const SITE_NAME = 'FULVO';
const DEFAULT_TITLE = 'FULVO | Entrená tu conocimiento de fútbol';
const DEFAULT_DESCRIPTION = 'Entrená tu conocimiento de fútbol jugando: micro‑juegos, rachas, logros y tablas de posiciones.';
const DEFAULT_IMAGE = 'https://fulvo.com.ar/og-image.png';
const ORIGIN = 'https://fulvo.com.ar';

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) return;
  el.setAttribute(attr, value);
}

/**
 * @param {{ title?: string, description?: string, path?: string, image?: string, noindex?: boolean }} opts
 */
export function setSeo({ title, description, path, image, noindex = false } = {}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = ORIGIN + (path || '/');
  const img = image || DEFAULT_IMAGE;

  document.title = fullTitle;

  setMeta('meta[name="description"]', 'content', desc);
  setMeta('meta[name="robots"]', 'content', noindex ? 'noindex,follow' : 'index,follow');
  setMeta('link[rel="canonical"]', 'href', url);

  setMeta('meta[property="og:title"]', 'content', fullTitle);
  setMeta('meta[property="og:description"]', 'content', desc);
  setMeta('meta[property="og:url"]', 'content', url);
  setMeta('meta[property="og:image"]', 'content', img);

  setMeta('meta[name="twitter:title"]', 'content', fullTitle);
  setMeta('meta[name="twitter:description"]', 'content', desc);
  setMeta('meta[name="twitter:url"]', 'content', url);
  setMeta('meta[name="twitter:image"]', 'content', img);
}
