# FULVO · Progresión 1–100 (relanzamiento)

Rama `feat/progresion-100`. Decisiones de Alejo implementadas tal cual: 100 niveles, 11 categorías (rangos) de 10 niveles con kit + colección, jugador diario a NV 100 en ~6 meses, kit v2 estilo club sin animación y la escena **Forja** en el ascenso de rango.

Archivos clave:

| Qué | Dónde |
|---|---|
| Curva (fórmula + tabla) | `src/services/level-curve.js` |
| Rangos + kit | `src/services/tiers.js` |
| Hitos de rango (XP bonus) | `src/services/level-rewards.js` |
| Escudo / medallón / banner por código | `src/services/rank-crest.js` |
| Componentes | `src/components/ranks/RankCrest.vue`, `RankMedallion.vue`, `RankBanner.vue` |
| Colecciones | `src/data/collections.js` |
| El camino (11 rangos) | `src/components/profile/LevelProgressionModal.vue` |
| Forja (acto rango) | `src/components/rewards/LevelUpOverlay.vue` |
| Preview visual | `docs/relanzamiento/rangos-preview.html` (abrir en el navegador) |
| Badges estáticos | `public/badges/rangos/<key>.svg` (los usan los `<img :src="tier.image">` que ya existían) |
| Scripts | `scripts/progresion-curva.mjs`, `scripts/progresion-colecciones.mjs`, `scripts/build-rangos-preview.mjs` |

---

## 1. Cuánta XP se gana por día

Supuestos: dificultad **Normal**, ~60 % de precisión, **1 intento por juego por día** (`getDailyChallengeLimit() = 1` para todos los planes), sin multiplicador premium.

### Juegos (14 diarios)

| Juego (tipo) | Cómo da XP (Normal) | XP estimada |
|---|---|---|
| Nacionalidad, Posición, Número de camiseta, Estadísticas (contrarreloj, 45 s) | 20 por acierto; ~8 aciertos (60 % de ~13 intentos); bonus ¡BASTA! si llega a 10 | 4 × 160 = **640** |
| Adivina el jugador (contrarreloj + bonus por velocidad 1×–2×) | 20 × ~1,4 por acierto × ~8 | **~225** |
| Orden por valor / edad / altura | 200 × fracción de posiciones bien (60 %) | 3 × 120 = **360** |
| ¿Quién es? (vidas) | 200 si acierta (60 %) | **120** |
| Wordle | 175 si gana (60 %) | **105** |
| Mayor o menor (cadena, se corta al errar) | 20 por acierto, racha esperada ~2 (+150 si llega a 12, casi nunca) | **~40** |
| Conexiones | 50 por grupo (~2) + 150 al completar (~30 %) | **~150** |
| Grilla 3×3 | 30 por celda (~5,4) + 150 completa (rara) | **~175** |
| Once ideal | 175 al completar (60 %) | **~105** |
| **Total juegos** | | **≈ 1.920** |

### Fuera de los juegos (SQL)

| Fuente | Regla | XP/día |
|---|---|---|
| Recompensa diaria (`claim_daily_reward`, mejoras7) | 100 XP lunes–viernes (finde = ayuda) | 100 × 5/7 ≈ **71** |
| Retos diarios (`daily_challenges`, rewards-phase1) | plan free = 2 retos al azar de 8. Con 1 intento por juego, `win_nat_2`/`win_guess_2`/`win_pos_2` son imposibles y `win_5_pu` da ayuda → valor esperado (60+150+120+80)/8 por slot | 2 × 51 ≈ **102** |
| Pase mensual free (rewards-phase2) | puntos: 3 por victoria, 1 por derrota (~28/día) → los 30 tiers en ~19 días; XP free = Σ(50+10n) = 6.150/mes | **~205** |
| Retos progresivos (rewards-phase3) | ~8.100 XP en 180 días (prog_win, prog_play, 3 por juego) | **~45** |
| Logros (puntos = XP, una vez) | ~50 logros; ~3.500 XP alcanzables en 6 meses | **~20** |
| **Total fuera de juegos** | | **≈ 440** |

**Jugador diario ≈ 2.340 XP/día** (se usa 2.340 en el modelo).
**Casual (la mitad de los juegos, ~7/día) ≈ 1.200 XP/día**: ~960 de juegos + 71 diaria + ~60 retos + ~120 pase (llega al tier ~22) + ~35 progresivos/logros.

Además, el cliente otorga un **bonus por subir de nivel** (`getLevelUpXpBonus`: 25 → 400) y por **hito de rango** (150 → 3.000). Sumado de NV 2 a 100 son **39.125 XP** (~9 % del total). La simulación los incluye día a día.

---

## 2. La curva 1–100

Costo de pasar del nivel *n* al *n+1*:

```
n ≤ 3 → 50·(n+1)                                   (100, 150, 200: el arranque de siempre)
n ≥ 4 → redondeo50( 250 + 6650 · (1 − e^(−(n−4)/32)) )
```

Arranca en 250 XP por nivel, sube rápido en los primeros rangos y se aplana cerca de ~6.550 XP por nivel. NV 100 = **457.400 XP**. Parámetros ajustados con búsqueda contra los objetivos (10 ≈ día 2–3, 30 ≈ 25, 50 ≈ 60, 80 ≈ 130, 100 ≈ 180).

| NV | XP acumulada | Costo del nivel | Día (diario) | Día (casual) |
|---:|---:|---:|---:|---:|
| 2 | 100 | 150 | 1 | 1 |
| 3 | 250 | 200 | 1 | 1 |
| 4 | 450 | 250 | 1 | 1 |
| 5 | 700 | 450 | 1 | 1 |
| 10 | 4.900 | 1.400 | 2 | 4 |
| 15 | 13.500 | 2.200 | 6 | 11 |
| 20 | 25.850 | 2.850 | 11 | 21 |
| 25 | 41.400 | 3.450 | 17 | 33 |
| 30 | 59.650 | 3.950 | 25 | 48 |
| 35 | 80.300 | 4.400 | 33 | 63 |
| 40 | 102.950 | 4.750 | 42 | 81 |
| 45 | 127.300 | 5.050 | 51 | 99 |
| 50 | 153.050 | 5.300 | 61 | 119 |
| 55 | 180.050 | 5.550 | 72 | 140 |
| 60 | 208.200 | 5.750 | 83 | 161 |
| 65 | 237.300 | 5.900 | 94 | 183 |
| 70 | 267.150 | 6.050 | 106 | 206 |
| 75 | 297.700 | 6.200 | 118 | 229 |
| 80 | 328.800 | 6.300 | 130 | 254 |
| 85 | 360.400 | 6.350 | 142 | 277 |
| 90 | 392.400 | 6.450 | 155 | 302 |
| 95 | 424.750 | 6.500 | 167 | 326 |
| 100 | 457.400 | — | **181** | **352** |

Regenerar/verificar: `node scripts/progresion-curva.mjs` (falla si la tabla de `level-curve.js` no coincide con la fórmula; con `--sql` reescribe el SQL 10).

### Ojo: usuarios actuales

Los niveles 5–30 ahora piden **más** XP (ej.: NV 30 pasa de 36.450 a 59.650). Como el nivel se calcula en vivo desde la tabla, **alguien con XP fija puede bajar de nivel** (36.450 XP: antes NV 30, ahora NV 24). El SQL 10 trae:
- una consulta de solo lectura para contar cuántos bajan (correr antes), y
- un bloque **OPCIONAL** comentado de compensación (`reason = 'curve_migration'`) que les da la XP justa para quedar en el nivel que tenían.

Decisión pendiente de Alejo: compensar o no.

### Funciones de nivel en SQL

`get_user_level`, `user_level_of`, `get_leaderboard` y `patch-fix-profiles` calculan el nivel solo con `level_thresholds` (`ORDER BY level DESC LIMIT 1`). No hay tope fijo en 30 en el código: hoy se clava en 30 únicamente porque la tabla termina ahí. **No hace falta reemplazar funciones**; alcanza con el upsert.

### Cambio de una línea en `xp.js` (otro agente lo edita, no lo toqué)

Reemplazar el literal `FALLBACK_THRESHOLDS` (1–50, curva vieja) por la curva nueva:

```js
import { LEVEL_THRESHOLDS as FALLBACK_THRESHOLDS } from './level-curve'
```

(y borrar el `const FALLBACK_THRESHOLDS = [...]`). Así el cliente sin red usa la misma curva que la DB. También conviene actualizar el comentario "nivel (1-30)".

---

## 3. Rangos

Historia: ganar un Balón de Oro te hace **Ícono**; sostenerlo años, **Leyenda**.

| # | Rango | Niveles | Colección | Colores | Camiseta | Metal | Emblema | Escudo | Hito XP |
|---|---|---|---|---|---|---|---|---|---:|
| 1 | Aficionado | 1–9 | El Potrero | `#c2410c` / `#7c2d12` | lisa | bronce | pelota de trapo | redondeado | — |
| 2 | Juvenil | 10–19 | Las Inferiores | `#f97316` / blanco | bastones | bronce | cono | redondeado | 150 |
| 3 | Amateur | 20–29 | El Ascenso | `#7a5230` / `#facc15` | banda | bronce | farol | redondeado | 300 |
| 4 | Reserva | 30–39 | La Pizarra | `#065f46` / `#1f4a3a` | cuartos | plata | pizarra X-O | en punta | 500 |
| 5 | Profesional | 40–49 | Día de partido | negro / `#0e7490` | franja | plata | pantalla TV | en punta | 750 |
| 6 | Crack | 50–59 | El Clásico | `#dc2626` / `#1d4ed8` | mitad y mitad | plata | banderas | en punta | 1.000 |
| 7 | Figura | 60–69 | Noches de Copa | `#1e3a8a` / `#0b1437` | rayas finas | oro | copa | almenado | 1.250 |
| 8 | Ídolo | 70–79 | La Hinchada | `#38bdf8` / blanco | bastones anchos | oro | bufanda | almenado | 1.500 |
| 9 | Ícono | 80–89 | Bestias | `#581c87` / `#1e0b2e` | V | oro | zarpazo | almenado | 1.750 |
| 10 | Leyenda | 90–99 | Gloria | `#d97706` / `#78350f` | lisa | diamante | pelota con laurel | con corona | 2.000 |
| 11 | GOAT | 100 | Álbum completo | pasteles | holográfico | holográfico | cabeza de cabra | con cuernos | 3.000 |

Kit por rango al llegar: **Ícono de rango X** (escudo), **Medallón X** (marco de avatar) y **Banner X**. El copy de 80–89 dice "Ícono de rango Ícono" (`rankKitPrizes()` en `tiers.js`).

### Kit v2 por código

`rank-crest.js` arma cada pieza desde un template + parámetros (forma, campo con el dibujo de la camiseta, aro de metal, medallón central con emblema monolínea, cinta con el nombre). Devuelve las **partes por separado** (`crestParts`) para animarlas, o el SVG completo (`crestSvg`, `medallionSvg`, `bannerSvg`). Tamaños S (40, sin cinta) / M (96) / L (180). No toca el DOM: lo importan también los scripts de Node.

Compat: `tiers.js` mantiene `key/label/minLevel/maxLevel/color/emoji/image`, `TIER_UNLOCKS`, `getTierForLevel`, `getNextTier`, `tierAccentText`, `tierColorClasses`. `image` ahora apunta a `/badges/rangos/<key>.svg`, así el perfil, la tarjeta de hover, la landing y el header muestran el kit nuevo sin tocar esos componentes. Crack pasó a 50–59 (antes era solo 50).

### Forja (acto rango de LevelUpOverlay)

¡GOL! → el escudo viejo tiembla → **el nuevo se arma por piezas**: cae el aro (golpe corto), se estampa el campo con el dibujo (golpe corto), baja el medallón con el emblema que se dibuja (**golpe fuerte: suena `forge`**, flash, chispas del color del rango, sacudida) y la cinta se despliega (golpe corto, `stamp`). Después aparecen el nombre, las cartas del kit y el próximo rango. Con `prefers-reduced-motion` el escudo aparece entero y suena una sola vez `forge`. Solo toqué el acto rango; el acto nivel queda igual.

### El camino

11 escudos reales en una ruta en serpentina de 3 filas, avance proporcional al largo real de cada tramo, vitrina con el kit dibujado (ícono, medallón y banner reales en vez de cartas genéricas), la colección del rango y "te faltan X niveles · Y XP" con la curva nueva.

---

## 4. Colecciones

Una por categoría, en `src/data/collections.js`. Cada pieza tiene `kind` (ícono / banner / título / borde) y `route`:

- **kit**: lo que da el rango al llegar (3 piezas).
- **camino**: por nivel dentro del rango (borde +1, ícono +3, banner +6, título +8 desde el nivel de entrada).
- **logro**: por un logro relacionado (`achievement` = código **propuesto**, falta crear el logro).
- **premio**: al completar la colección (borde/banner + título).
- **legado** (solo SQL): cosméticos que ya existían con ese nombre (Fuego, Laurel, GOAT). Conservan su desbloqueo actual.

Criterio de tipos (Alejo pasó solo nombres): "entre comillas" = título; escenas (Tiza, Alambrado, Noche de lluvia…) = banner; objetos = ícono; "borde X" = borde. Casos a revisar:
- **El Ascenso**, **Día de partido** y **Noches de Copa** no tienen título en la lista → sin título en el camino.
- **Laurel** quedó como ícono porque ya existe `icon_laurel`.
- **GOAT**: su premio (borde Holográfico + "Hijo del fútbol") pide el álbum completo (todas las piezas no-premio de todas las colecciones).
- Candidatos de mapeo que **no** apliqué por no coincidir el nombre: `banner_pitch` "Cancha" → Cancha cortada, `banner_night` "Nocturno" → Noche de lluvia, `icon_boot` "Botín" → Botín embarrado, `icon_trophy` "Trofeo" → Copa.

Duplicados → Fichas (en `grant_cosmetic`): raro 250 · épico 600 · legendario 1.250 · común 0.

---

## 5. Implementado vs. pendiente

**Implementado**
- Curva 1–100 (JS + SQL + script de verificación y simulación).
- 11 rangos con kit, hitos de XP hasta NV 100, próximo premio hasta NV 100.
- Kit v2 por código (escudo/medallón/banner, 5 formas, 10 dibujos de camiseta, 5 metales, 11 emblemas) + 3 componentes Vue.
- El camino con 11 rangos; Forja en el ascenso; badges estáticos para los `<img>` existentes.
- Colecciones (data + SQL): columna `collection`/`collection_route`, kit para los 11 rangos, 78 piezas, mapeo legado, duplicados → Fichas, `claim_collection_prize`.
- Preview HTML autocontenido con los 11 rangos en S/M/L.

**Pendiente**
- **Arte de íconos y banners de colección**: las piezas quedan `active = false` hasta tener arte (los títulos ya están activos). Los style_key nuevos (`rank_figura`, `medal_figura`, `tier_figura`… y los `col_*`) no tienen render en `CosmeticIcon` / `FRAME_STYLES` / banners: `PrizeCard` cae al render genérico. Lo ideal: que `CosmeticIcon`/marcos/banners usen `RankCrest`/`RankMedallion`/`RankBanner` cuando `styleKey` empieza con `rank_`/`medal_`/`tier_`.
- **Logros por pieza**: crear los logros `col_*` propuestos en `collections.js` (≈45) y prender `active` de cada pieza cuando exista su logro y su arte.
- **UI de colecciones** (álbum en el perfil + botón "Reclamar premio" que llame a `claim_collection_prize`).
- `xp.js`: cambio de una línea (arriba).
- `prize-card.js`: `tierPrizes()` debería delegar en `rankKitPrizes()` (copy nuevo) y `upcomingPrizes(…, maxLevel = 60)` debería ir a 100.
- Decidir la compensación de nivel para usuarios actuales (bloque opcional del SQL 10).
- Los badges viejos (`public/badges/*.svg`) quedan sin uso; se pueden borrar después del merge.

---

## 6. Orden de los SQL

1. `supabase/pendientes/2026-11-24-10-curva-1-100.sql`: correr primero la consulta de solo lectura (cuántos bajan de nivel); después el upsert; opcionalmente el bloque de compensación.
2. `supabase/pendientes/2026-11-24-11-colecciones.sql`: necesita `rewards-phase4c.sql` (unlock_achievement/owns_cosmetic) y, para las Fichas, `mejoras11-currency-shop.sql`.

Ambos son idempotentes y traen QUÉ / POR QUÉ / ROLLBACK en el encabezado. Se regeneran con los scripts (no editar a mano).

**Seguridad:** `grant_cosmetic` no tenía `REVOKE`, así que por los permisos por defecto de Supabase cualquier usuario logueado podía llamarla por RPC y darse cosméticos. Como ahora paga Fichas, sería farmeable: el SQL 11 hace `REVOKE` para `public`/`anon`/`authenticated`. Las funciones que la usan (pase, etc.) son `SECURITY DEFINER` y siguen funcionando. El cliente no la llama (verificado con grep).
