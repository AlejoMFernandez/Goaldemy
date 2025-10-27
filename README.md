# Goaldemy

Goaldemy es una app web hecha con Vue 3 + Vite para entrenar tu conocimiento de fútbol jugando. Incluye micro‑juegos, rachas, logros, tablas de posiciones y perfiles públicos; la autenticación y datos viven en Supabase.

## Stack

- Vue 3 (Composition API)
- Vite 7
- Tailwind CSS v4 (vía `@tailwindcss/vite`)
- Supabase (auth, Postgres, Realtime)
- Chart.js + vue-chartjs

## Desarrollo

1. Clonar el repo e instalar dependencias
2. Configurar variables de entorno para Supabase
3. Ejecutar el servidor de desarrollo

### Requisitos

- Node.js 18+

### Variables de entorno

Copiá `.env.example` a `.env` y completá tus credenciales públicas de Supabase:

```
VITE_SUPABASE_URL="https://YOUR-PROJECT.ref.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR-PUBLIC-ANON-KEY"
```

> Nota: Son claves públicas (anon). No subas tu `.env` real.

### Scripts

- `npm run dev` — levanta Vite en modo desarrollo
- `npm run build` — compila a producción (carpeta `dist/`)
- `npm run preview` — sirve el build localmente

## Estructura relevante

- `src/main.js` — arranque de la app
- `src/router/router.js` — rutas y guardas de auth
- `src/services/` — capa de datos (Supabase, juegos, XP, perfiles, etc.)
- `src/pages/` — páginas de la app (Home, Juegos, Perfil, About, etc.)
- `src/components/` — componentes UI reutilizables

## Integración con Supabase

La configuración del cliente está en `src/services/supabase.js`. Por defecto toma `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde el entorno. También incluye valores de fallback para facilitar dev local, pero para producción configurá tus variables.

Los archivos de base de datos (tablas, policies, seeds) están en `supabase/`.

## Estilos

Se usa Tailwind CSS v4 con el plugin oficial para Vite. No requiere archivos de configuración extra — podés usar utilidades como `prose`, `grid`, `md:*`, etc. También hay algunos estilos propios en `src/style.css`.

## Deploy

El proyecto es compatible con Vercel/Netlify. Recordá configurar variables de entorno en tu proveedor. El output final vive en `dist/`.

## Licencia

MIT — ver el archivo LICENSE si aplica.

## Contribuir

¿Ideas o ganas de colaborar? Abrí un issue o escribí a fernandezmalejo@gmail.com.
