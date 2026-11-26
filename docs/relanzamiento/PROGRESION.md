# FULVO · Progresión 1–100 (relanzamiento)

Estado en `feat/v4-rangos`: la versión correcta de los rangos es la de Alejo, `feature/rangos-100` (escudos, kit, escena Forja y sonidos), integrada en la UI v4. De `progresion-100` quedan el modelo de XP por día (este documento), la API de `tiers.js` y las colecciones, corregidas según el artifact **"El camino 1–100"**.

Archivos clave:

| Qué | Dónde |
|---|---|
| Curva (tabla 1–100) | `src/services/level-curve.js` (fuente única; `xp.js` la usa de respaldo y completa lo que falte en la base) |
| Rangos | `src/services/tiers.js` (`TIERS`, `TIER_KEYS`, `getTierByKey`, `tierGlow`, `TIER_RARITY`, clamp > 100) |
| Escudos | `public/badges/<rango>.svg` (11, 120×140) |
| Kit de rango | `public/cosmetics/rank/{icon,border,banner}-<rango>.svg` |
| Datos de la Forja | `src/data/rank-tiers.json` |
| Forja (ascenso de rango) | `src/services/rank-forge.js` + acto rango de `src/components/rewards/LevelUpOverlay.vue` |
| Hitos de rango (XP bonus) | `src/services/level-rewards.js` |
| Colecciones | `src/data/collections.js` |
| Colores de rareza | `src/services/rarity.js` (fuente única) |
| El camino | `src/pages/Camino.vue` (/camino) y `src/components/profile/LevelProgressionModal.vue` (vitrina) |
| Copias de diseño | `docs/rango/` (escudos, kit y moodboards de los artifacts) |
| Scripts | `scripts/progresion-curva.mjs`, `scripts/progresion-colecciones.mjs` |

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
**Jornada completa ≈ 5.200 XP/día**: la mediana real de los días con ≥ 11 juegos (muestra chica: 18 días-usuario, 8 usuarios; ver el SQL 51–100). Es la referencia con la que Alejo calibró la curva.
**Casual (la mitad de los juegos, ~7/día) ≈ 1.200 XP/día**: ~960 de juegos + 71 diaria + ~60 retos + ~120 pase (llega al tier ~22) + ~35 progresivos/logros.

Además, el cliente otorga un **bonus por subir de nivel** (`getLevelUpXpBonus`: 25 → 400) y por **hito de rango** (150 → 3.000). Sumado de NV 2 a 100 son **39.125 XP** (~4 % del total). La simulación los incluye día a día.

---

## 2. La curva 1–100 (la de `rangos-100`)

- **1–50: no cambia** (es la tabla de siempre; nadie pierde niveles).
- **51–100:** costo = 6.700 × 1,0321^k (k = 0…49), redondeado a 50. Arranca apenas arriba de lo que cuesta el 50 y crece ~3 % por nivel.
- **NV 100 = 936.000 XP** = 180 días × 5.200 XP (jornada completa).

Días estimados (simulación día a día con los bonus de nivel y de hito):

| NV | XP acumulada | Costo del nivel | Día (jornada completa, 5.200) | Día (diario, 2.340) | Día (casual, 1.200) |
|---:|---:|---:|---:|---:|---:|
| 2 | 100 | 150 | 1 | 1 | 1 |
| 5 | 700 | 300 | 1 | 1 | 1 |
| 10 | 2.700 | 600 | 1 | 2 | 2 |
| 20 | 13.200 | 1.650 | 3 | 6 | 10 |
| 30 | 36.450 | 3.150 | 7 | 15 | 28 |
| 40 | 74.700 | 4.700 | 14 | 30 | 58 |
| 50 | 130.700 | 6.700 | 24 | 52 | 101 |
| 60 | 208.250 | 9.200 | 38 | 83 | 161 |
| 70 | 314.700 | 12.600 | 57 | 126 | 246 |
| 80 | 460.750 | 17.300 | 84 | 187 | 363 |
| 90 | 661.100 | 23.750 | 122 | 270 | 526 |
| 100 | 936.000 | — | **174** | **385** | **750** |

**Para decidir (Alejo):** con el modelo de este documento, un jugador diario de ~2.340 XP/día tarda ~13 meses en llegar al 100, no 6. Los 6 meses valen para la jornada completa (5.200/día), que sale de una muestra de 8 usuarios. Si se quiere que el diario llegue en ~6 meses, hay que bajar el tramo 51–100 o subir la XP por día; no lo cambié porque la curva es la de Alejo y no mueve a nadie.

Verificar / regenerar: `node scripts/progresion-curva.mjs` (falla si `level-curve.js` no coincide con la base 1–30 o con el SQL 51–100; con `--sql` reescribe el SQL 31–50).

### La base hoy llega solo al 30

- `get_user_level`, `user_level_of` y `get_leaderboard` calculan el nivel con `level_thresholds` (`ORDER BY level DESC LIMIT 1`): sin filas 31+ el nivel queda clavado en 30. No hace falta tocar funciones; alcanza con cargar la tabla.
- El SQL de `rangos-100` agrega 51–100 pero da por hecho que 31–50 existen. Por eso `2026-11-24-10-curva-31-50.sql` completa el hueco.
- **Cliente:** `xp.js` une lo que devuelve la base con la curva de `level-curve.js` (`mergeThresholds`). Con 1–30 en la base, la barra de progreso del 30 al 31 y los "te faltan X XP" del Camino se calculan bien igual. El nivel en sí lo sigue dando el servidor: hasta aplicar los SQL nadie pasa del 30.

---

## 3. Rangos

| # | Rango | Niveles | Colección | Emblema (la historia) | Metal | Glow | Hito XP |
|---|---|---|---|---|---|---|---:|
| 1 | Aficionado | 1–9 | El Potrero | pelota | bronce | `#d97706` | — |
| 2 | Juvenil | 10–19 | Las Inferiores | botín | plata | `#cbd5e1` | 150 |
| 3 | Amateur | 20–29 | El Ascenso | carnet | oro | `#facc15` | 300 |
| 4 | Reserva | 30–39 | La Pizarra | banco | esmeralda | `#34d399` | 500 |
| 5 | Profesional | 40–49 | Día de partido | contrato | cian | `#22d3ee` | 750 |
| 6 | Crack | 50–59 | El Clásico | la 10 | campeón (doble filo) | `#22d3ee` | 1.000 |
| 7 | Figura | 60–69 | Noches de Copa | copa | rubí | `#fb7185` | 1.250 |
| 8 | Ídolo | 70–79 | La Hinchada | bandera con el 10 | amatista | `#a78bfa` | 1.500 |
| 9 | Ícono | 80–89 | **Gloria** | balón de oro | platino helado | `#c4b5fd` | 1.750 |
| 10 | Leyenda | 90–99 | **Bestias** | camiseta enmarcada | oro sobre negro | `#f59e0b` | 2.000 |
| 11 | GOAT | 100 | Álbum completo | cabeza de cabra | holográfico | `#a5f3fc` | 3.000 |

Kit al llegar: escudo + **Ícono de rango X**, **Medallón X** (borde) y **Banner X**, con la rareza del tramo. Cambios del Camino aplicados al arte: el borde de Ícono es un **aro de gala** (el Laurel dorado queda en Gloria) y el banner de Amateur es la **tribuna de tablones** (Reflectores queda en El Ascenso).

**Forja** (`rank-forge.js`, moodboard ascenso-forja): se calienta → se desarma → cae el filo → cae el emblema → caen las estrellas (en Crack y GOAT se funden) → ¡PUM! con el nombre. Tocar adelanta; con reduced motion aparece el escudo final. Hápticos: `heavy` en cada golpe, `tap` en cada estrella y en cada carta de "Al llegar ganás", `success` en el ¡PUM!.

---

## 4. Colecciones (artifact "El camino 1–100")

- **Camino:** 4 piezas por rango en los niveles x2, x4, x6 y x8: ícono, título, banner y borde. Los demás niveles dan XP o ayudas; el nivel redondo es el ascenso con su kit.
- **Rareza por tramo:** Aficionado y Juvenil común; Amateur a Profesional raro; Crack a Ídolo épico; Ícono, Leyenda y GOAT legendario. Las piezas de logro suben un escalón; las de premio son legendarias.
- **Logro:** el resto de cada colección, con el texto del logro en `how` (los nuevos son propuestos: hay que crearlos).
- **Premio:** al completar (Potrero, Pizarra, Día de partido, Hinchada, Gloria, Bestias y Álbum; los demás "a definir").
- **Choques resueltos:** Gloria → Ícono y Bestias → Leyenda; Pelota de oro → Botín de oro; "La 10" → "Diez de diez"; títulos "Jugador del partido" y "Bandera del club"; la cabra (GOAT, `icon_goat`) pasa del 55 al **100** (quien la tiene la conserva: el SQL 11 se la deja como fila explícita antes de mover el nivel). Placa de nivel, Capitán (título) y Símbolo del club van a la tienda.
- **Duplicados → Fichas** (`grant_cosmetic`): raro 250 · épico 600 · legendario 1.250 · común 0.

---

## 5. Pendiente

- **Arte de las 26 piezas nuevas** (7 íconos, 7 títulos, 6 banners, 6 bordes): quedan `active = false` hasta tenerlo (los títulos ya están activos).
- **Logros `col_*`** propuestos en `collections.js`.
- `level-rewards.js` todavía tiene el mapa viejo de cosméticos por nivel (Promesa 2, Bronce 3…), que es el que hoy da la base. Pasar al Camino (x2/x4/x6/x8) necesita mover esos cosméticos en SQL: decisión de Alejo.
- Curva: ver "Para decidir" arriba.
- Abono: `src/components/pass/pass-rewards.js` tiene su propia paleta de rareza; tiene que importar `RARITY` de `src/services/rarity.js` (lo hace el agente del Abono).

---

## 6. Orden de los SQL (nada aplicado)

1. `2026-11-24-10-curva-31-50.sql` → completa 31–50.
2. `2026-10-03-rangos-curva-xp-51-100.sql` → agrega 51–100.
3. `2026-10-02-rangos-iconos-nombre.sql` y `2026-10-03-rangos-nuevos-cosmeticos.sql` → nombres y kit de Figura a GOAT.
4. `2026-11-24-11-colecciones.sql` → colecciones, kit con rareza por tramo, la cabra al 100, duplicados → Fichas y `claim_collection_prize`. Necesita `rewards-phase4c.sql` y, para las Fichas, `mejoras11-currency-shop.sql`.

Todos son idempotentes y traen QUÉ / POR QUÉ / ROLLBACK. Los de curva y colecciones se regeneran con los scripts (no editar a mano).

**Seguridad:** `grant_cosmetic` no tenía `REVOKE`; como ahora paga Fichas, el SQL 11 la cierra para `public`/`anon`/`authenticated`. Las funciones que la usan son `SECURITY DEFINER` y siguen andando.
