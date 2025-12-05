# 🏆 Lógica de Logros - Goaldemy

Este documento detalla **todos los logros** y **cuándo/cómo se desbloquean**.

---

## 📍 Fuente de verdad
- **Base de datos**: `supabase/seed_achievements.sql` (34 logros)
- **Catálogo JS**: `achievements-catalog.js` ❌ **DEPRECADO** - usar `getAchievementsCatalog()` desde DB

---

## 🎯 Logros implementados (con lógica activa)

### **Durante partida individual** (`game-xp.js`)

| Código | Nombre | Condición | Archivo |
|--------|--------|-----------|---------|
| `first_correct` | Primer toque | Primera respuesta correcta (attemptIndex === 0) | `game-xp.js:29` |
| `streak_3` | Calentando motores | 3 aciertos seguidos en UNA partida | `game-xp.js:32` |
| `streak_5` | En racha | 5 aciertos seguidos en UNA partida | `game-xp.js:35` |
| `streak_10` | Imparable | 10 aciertos seguidos en UNA partida | `game-xp.js:38` |
| `ten_correct` | ? | 10 respuestas correctas totales en UNA partida | `game-xp.js:41` |

**⚠️ Problema detectado**: `streak_X` se desbloquea por racha en UNA SOLA partida, no por días consecutivos.

---

### **Al terminar desafío diario** (`game-modes.js`)

| Código | Nombre | Condición | Archivo |
|--------|--------|-----------|---------|
| `daily_wins_3` | Triplete | Ganar 3 juegos en el día | `game-modes.js:42` |
| `daily_wins_5` | Quinteto de oro | Ganar 5 juegos en el día | `game-modes.js:43` |
| `daily_wins_10` | Diez del tirón | Ganar 10 juegos en el día | `game-modes.js:44` |
| `daily_wins_all` | Barrida limpia | Ganar TODOS los juegos disponibles (8) | `game-modes.js:46` |

---

### **Rachas por días consecutivos** (`game-modes.js`)

| Código | Nombre | Condición | Archivo |
|--------|--------|-----------|---------|
| `daily_streak_3` | Disciplinado | Ganar el mismo juego 3 días seguidos | `game-modes.js:51` |
| `daily_streak_5` | Fanático | Ganar el mismo juego 5 días seguidos | `game-modes.js:52` |
| `daily_streak_10` | ? | Ganar el mismo juego 10 días seguidos | `game-modes.js:53` |

**Nota**: Estos se chequean DESPUÉS de terminar un desafío, usando `fetchDailyWinStreak(slug)`

---

### **Superlogros épicos** (`special-badges.js`)

| Código | Nombre | Condición | Cuándo se chequea | Archivo |
|--------|--------|-----------|-------------------|---------|
| `streak_dual_100` | Doble Centurión | Racha de 100+ en 2 juegos distintos | Al cargar perfil propio | `special-badges.js:18` |
| `xp_multi_5k_3` | Tricampeón de XP | 5000+ XP en 3 juegos distintos | Al cargar perfil propio | `special-badges.js:21` |
| `daily_super_5x3` | Tri-rey semanal | 5 días seguidos en 3 juegos | Después de cada desafío | `game-modes.js:60` |

---

## ❌ Logros en DB pero SIN lógica implementada

Estos logros están **seeded en la base de datos** pero **no tienen código que los desbloquee**:

### 🎯 **Básicos**
- `first_win` - Debut ganador: "Ganá tu primer juego del día"
- `streak_15` - Máquina: "15 aciertos seguidos... ¿cómo lo hacés?"

### 📅 **Rachas de login**
- `daily_streak_7` - Semana perfecta: "7 días sin faltar"
- `daily_streak_14` - Dos semanas al palo: "14 días consecutivos jugando"
- `daily_streak_30` - Mes legendario: "30 días seguidos... ¡sos el GOAT!"

**Nota**: Se agregó `daily_streak` y `best_daily_streak` a `user_profiles` pero falta la lógica de incremento/reset.

### ⚽ **Por juego específico**
- `guess_master` - Adivino profesional: "Ganá 20 partidas de 'Adivina el jugador'"
- `nationality_expert` - Experto en banderas: "Acertá 50 nacionalidades correctas"
- `position_guru` - Técnico táctico: "Identificá correctamente 50 posiciones"

### 🎲 **Curiosos**
- `lucky_first` - Suertudo: "Acierta en el primer intento 10 veces"
- `comeback_king` - Rey del comeback: "Ganá después de 3 errores consecutivos"
- `night_owl` - Ave nocturna: "Jugá entre las 00:00 y las 05:00"
- `early_bird` - Madrugador: "Jugá antes de las 07:00"
- `weekend_warrior` - Guerrero del finde: "Ganá 10 juegos en sábado o domingo"

### 🏆 **Épicos**
- `perfectionist` - Perfeccionista: "Completá un juego sin errores"
- `hat_trick` - Hat-trick: "Ganá 3 juegos distintos el mismo día"
- `grand_slam` - Grand Slam: "Ganá todos los juegos disponibles en una semana"
- `centurion` - Centurión: "Acumula 100 victorias totales"

### 🌟 **Sociales**
- `social_butterfly` - Mariposa social: "Conectá con 10 usuarios"
- `chat_master` - Charlatán: "Envía 100 mensajes en el chat"

---

## 🔧 Problemas/mejoras identificadas

### 1. **Confusión con rachas**
- `streak_3`, `streak_5`, `streak_10` se desbloquean por racha EN UNA PARTIDA
- Los nombres sugieren días consecutivos, pero eso es `daily_streak_X`
- **Sugerencia**: Renombrar a `ingame_streak_X` o cambiar la lógica

### 2. **Falta lógica de login streak**
- Columnas `daily_streak` y `best_daily_streak` agregadas pero no se usan
- **Sugerencia**: Implementar trigger o lógica al iniciar sesión

### 3. **Logros específicos sin implementar**
- Muchos logros interesantes no tienen código
- **Sugerencia**: Priorizar cuáles implementar primero

---

## 🚀 Próximos pasos sugeridos

1. **Refactorizar nombres de streaks** para evitar confusión
2. **Implementar login streak automático** (al jugar primer juego del día)
3. **Agregar logros por victorias acumuladas** (guess_master, centurion, etc.)
4. **Implementar logros curiosos** (night_owl, early_bird, etc.)
5. **Agregar achievement tracking** para ver progreso (ej: "15/20 partidas para guess_master")

---

## 📝 Cómo agregar un nuevo logro

1. **Agregar a `seed_achievements.sql`** con código único
2. **Ejecutar la query** en Supabase
3. **Llamar a `unlockAchievementWithToast(code, meta)`** en el momento apropiado
4. **Documentar aquí** la condición de desbloqueo

---

**Última actualización**: 2025-11-17
