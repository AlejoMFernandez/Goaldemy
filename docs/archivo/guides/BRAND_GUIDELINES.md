# 🎨 GOALDEMY - Guía de Estilo Visual y Universo de Marca

## 📋 Tabla de Contenidos
- [Identidad de Marca](#identidad-de-marca)
- [Paleta de Colores](#paleta-de-colores)
- [Tipografía](#tipografía)
- [Componentes de Marca](#componentes-de-marca)
- [Patrones y Texturas](#patrones-y-texturas)
- [Uso del Logo](#uso-del-logo)
- [Principios de Diseño](#principios-de-diseño)

---

## 🎯 Identidad de Marca

**GOALDEMY** es una plataforma de aprendizaje gamificado de fútbol que combina:
- ⚽ **Fútbol**: Pasión y conocimiento deportivo
- 🎮 **Gamificación**: Progresión, desafíos y recompensas
- 🌐 **Comunidad**: Conexión entre fanáticos

### Valores de Marca
- **Progreso Tangible**: XP, niveles, rachas
- **Desafío Diario**: Consistencia y mejora continua
- **Claridad Visual**: Interfaces intuitivas y feedback inmediato
- **Energía Deportiva**: Colores vibrantes y animaciones dinámicas

---

## 🎨 Paleta de Colores

### Colores Primarios (Gradiente de Marca)

```css
/* Emerald - Representa crecimiento y victoria */
--goaldemy-emerald: #10B981; /* rgb(16, 185, 129) */

/* Cyan - Representa innovación y frescura */
--goaldemy-cyan: #22D3EE; /* rgb(34, 211, 238) */

/* Indigo - Representa profundidad y conocimiento */
--goaldemy-indigo: #6366F1; /* rgb(99, 102, 241) */
```

**Uso del gradiente de marca:**
```css
background: linear-gradient(to right, #10B981, #22D3EE, #6366F1);
```

### Colores Secundarios

```css
/* Brand Purple (OKLCH para contraste óptimo) */
--brand-400: oklch(0.70 0.21 270);
--brand-500: oklch(0.62 0.21 270);
--brand-600: oklch(0.55 0.21 270);

/* Slate (fondos y texto) */
--slate-950: #0b1220;
--slate-900: #0f172a;
--slate-800: #1e293b;
--slate-400: #94a3b8;
--slate-300: #cbd5e1;
--slate-200: #e2e8f0;
```

### Colores Semánticos

```css
/* Success (victorias, logros) */
--success: #10B981; /* Emerald-500 */

/* Error (derrotas, advertencias) */
--error: #EF4444; /* Red-500 */

/* Warning */
--warning: #F59E0B; /* Amber-500 */

/* Info */
--info: #3B82F6; /* Blue-500 */
```

### Backgrounds

```css
/* Fondo principal de la app */
background: linear-gradient(to bottom right, #0b1220, #0f172a, #1e293b);

/* Cards y modales */
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.08);
backdrop-filter: blur(12px);
```

---

## 📝 Tipografía

### Fuente Principal: Inter
```css
font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
```

**Características:**
- Moderna, legible y neutral
- Excelente para textos largos
- Soporta múltiples pesos (400, 600, 800)

### Fuente Display: Montserrat
```css
font-family: 'Montserrat', sans-serif;
```

**Uso exclusivo para:**
- Logo wordmark "GOALDEMY"
- Títulos hero muy grandes
- CTAs principales

### Jerarquía Tipográfica

```css
/* Hero / H1 */
font-size: 3rem; /* 48px */
font-weight: 800;
line-height: 1.1;
letter-spacing: -0.02em;

/* H2 */
font-size: 2rem; /* 32px */
font-weight: 700;
line-height: 1.2;

/* H3 */
font-size: 1.5rem; /* 24px */
font-weight: 600;
line-height: 1.3;

/* Body */
font-size: 1rem; /* 16px */
font-weight: 400;
line-height: 1.6;

/* Small / Caption */
font-size: 0.875rem; /* 14px */
font-weight: 400;
line-height: 1.5;
```

---

## 🧩 Componentes de Marca

### 1. GoaldemyLogo (Componente Principal)

**Ubicación:** `src/components/GoaldemyLogo.vue`

**Descripción:** Usa el logo oficial de Goaldemy (`/iconclaro.png`) - un escudo con balón de fútbol y estrella dorada, combinado con el wordmark "GOALDEMY" en Montserrat Bold.

**Variantes:**
```vue
<!-- Logo completo (icono + wordmark) -->
<GoaldemyLogo variant="full" size="md" :animated="true" />

<!-- Solo icono -->
<GoaldemyLogo variant="icon" size="lg" />

<!-- Solo texto -->
<GoaldemyLogo variant="wordmark" size="sm" />
```

**Tamaños disponibles:**
- `sm`: 24px altura (navegación compacta)
- `md`: 40px altura (navegación estándar)
- `lg`: 56px altura (headers de sección)
- `xl`: 80px altura (hero sections)

**Cuándo usar cada variante:**
- **Full**: Navbar, footer, landing hero
- **Icon**: Loading states, favicons, avatares
- **Wordmark**: Títulos de página, breadcrumbs

### 2. BrandedBackground

**Ubicación:** `src/components/BrandedBackground.vue`

**Capas del fondo:**
1. **Aurora gradients**: Efectos de luz suaves (emerald, cyan, indigo)
2. **Football pattern**: Grid de íconos de balón y trofeo (opacidad 3%)
3. **Diagonal lines**: Patrón de líneas a 45° (opacidad 1.5%)

**Uso:**
```vue
<template>
  <div class="relative">
    <BrandedBackground />
    <div class="relative z-10">
      <!-- Tu contenido aquí -->
    </div>
  </div>
</template>
```

### 3. Cards y Contenedores

```css
.card {
  border-radius: 1.1rem; /* --radius-card */
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
}

.card-hover {
  transition: transform 300ms ease;
}

.card-hover:hover {
  transform: translateY(-2px);
  border-color: rgba(16, 185, 129, 0.4); /* Emerald accent */
  box-shadow: 0 20px 40px rgba(16, 185, 129, 0.2);
}
```

### 4. Botones

**Primario (CTA principal):**
```css
.btn-primary {
  background: linear-gradient(to right, #10B981, #22D3EE);
  color: white;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  transition: all 200ms ease;
}

.btn-primary:hover {
  transform: scale(1.05);
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.5);
}
```

**Secundario:**
```css
.btn-secondary {
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: rgb(226, 232, 240);
  backdrop-filter: blur(8px);
}

.btn-secondary:hover {
  border-color: rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.1);
}
```

---

## 🔶 Patrones y Texturas

### Football Pattern (Firma Visual de GOALDEMY)

**Composición:**
- Balón de fútbol estilizado (hexágonos y pentágonos)
- Trofeo pequeño como elemento secundario
- Grid de 120x120px
- Opacidad ultra baja (3%) para no distraer

**Colores del pattern:**
Usa el gradiente de marca con opacidad baja:
```css
fill: url(#patternGradient);
/* Gradiente: emerald → cyan → indigo */
```

### Diagonal Lines

Líneas a 45° con:
- Color: emerald (#10B981)
- Opacidad: 1.5%
- Espaciado: 60px
- Grosor: 2px

---

## 🎯 Uso del Logo

### DO's ✅

✅ Usar el logo completo (icon + wordmark) en navegación principal
✅ Mantener proporciones originales
✅ Usar sobre fondos oscuros (slate-900, slate-950)
✅ Agregar animación hover en elementos interactivos
✅ Respetar el espacio mínimo alrededor del logo (20% de su altura)

### DON'Ts ❌

❌ NO cambiar los colores del gradiente del logo
❌ NO rotar el logo (excepto animaciones hover sutiles de ±3°)
❌ NO estirar o deformar el logo
❌ NO colocar sobre fondos con mucho ruido visual
❌ NO usar tipografías diferentes para el wordmark

### Espaciado Mínimo

```
Altura del logo: H
Espacio mínimo alrededor: 0.2H en todos los lados
```

---

## 🌟 Principios de Diseño

### 1. Claridad sobre Complejidad
- Interfaces limpias y espaciadas
- Jerarquía visual clara
- Feedback inmediato en interacciones

### 2. Energía Deportiva
- Animaciones dinámicas pero no agresivas
- Colores vibrantes con buen contraste
- Iconografía deportiva sutil

### 3. Progresión Visible
- Barras de progreso
- Badges y logros destacados
- XP y niveles siempre visibles

### 4. Comunidad y Conexión
- Perfiles públicos con personalización
- Elementos sociales integrados (chat, DMs)
- Leaderboards y competencia amigable

### 5. Responsive y Accesible
- Mobile-first approach
- Contraste WCAG AA mínimo
- Touch targets de 44x44px mínimo

---

## 📱 Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 640px) { /* sm */ }

/* Tablet */
@media (min-width: 768px) { /* md */ }

/* Laptop */
@media (min-width: 1024px) { /* lg */ }

/* Desktop */
@media (min-width: 1280px) { /* xl */ }
```

### Consideraciones Mobile

1. **Simplificar patrones de fondo** en mobile (pueden ralentizar)
2. **Logo más compacto** en navbar mobile
3. **Deshabilitar backdrop-filter** en dispositivos con bajo rendimiento
4. **Touch-friendly**: Botones y cards con padding generoso

---

## 🎨 Ejemplos de Uso

### Hero Section Completo

```vue
<div class="relative min-h-screen overflow-hidden">
  <BrandedBackground />
  
  <div class="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-24">
    <div class="flex justify-center mb-8">
      <GoaldemyLogo variant="full" size="xl" :animated="true" />
    </div>
    
    <h1 class="text-5xl font-black text-center mb-6">
      <span class="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400">
        Aprendizaje gamificado
      </span>
      <span class="block text-white">de Fútbol</span>
    </h1>
    
    <p class="text-xl text-slate-300 text-center max-w-2xl mx-auto">
      Convertí tu pasión en progreso: XP, logros y desafíos diarios.
    </p>
  </div>
</div>
```

### Card con Branding

```vue
<div class="card card-hover p-6">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
      <svg class="w-6 h-6 text-white"><!-- icon --></svg>
    </div>
    <h3 class="text-xl font-bold text-white">Título</h3>
  </div>
  <p class="text-slate-300">Contenido del card...</p>
</div>
```

---

## 📦 Assets y Recursos

### Ubicaciones de Archivos

```
public/
  ├── goaldemy.png          # Logo principal (favicon)
  ├── iconclaro.png         # Icono alternativo
  
src/components/
  ├── GoaldemyLogo.vue      # Componente de logo reutilizable
  ├── BrandedBackground.vue # Fondo con patrones de marca
  ├── AppNavBar.vue         # Navegación con logo
  └── AppFooter.vue         # Footer con branding completo
```

### Exportación de Logos

**Formatos requeridos:**
- SVG: Para escalabilidad perfecta
- PNG: 512x512px mínimo (transparente)
- Favicon: 32x32px, 64x64px

---

## ✨ Animaciones y Transiciones

### Durations Estándar

```css
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
```

### Easing Functions

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### Ejemplos

```css
/* Hover en cards */
transition: transform 300ms ease-out;

/* Fade in de elementos */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Pulse glow del logo */
@keyframes pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.5)); }
  50% { filter: drop-shadow(0 0 16px rgba(34, 211, 238, 0.7)); }
}
```

---

## 🎓 Checklist de Implementación

Al crear nuevas páginas o componentes, asegúrate de:

- [ ] Usar `GoaldemyLogo` en lugar de texto plano
- [ ] Incluir `BrandedBackground` o elementos de la aurora
- [ ] Aplicar gradientes de marca en elementos destacados
- [ ] Usar la paleta de colores oficial
- [ ] Mantener jerarquía tipográfica consistente
- [ ] Agregar estados hover con colores de marca
- [ ] Incluir animaciones sutiles (hover, focus)
- [ ] Probar en mobile y desktop
- [ ] Verificar contraste de accesibilidad

---

## 📞 Contacto

Para dudas sobre el sistema de diseño:
- **Desarrollador**: Alejo Fernández
- **Email**: fernandezmalejo@gmail.com
- **Proyecto**: GOALDEMY - Gamified Football Learning Platform

---

**Última actualización**: Diciembre 2025
**Versión**: 1.0.0
