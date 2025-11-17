# 🎮 Sistema de Gamificación Estandarizado - Implementación Completa

## ✅ COMPLETADOS

### 1. NationalityGame.vue (TIMED - 30s/10 aciertos)
- ✅ GamePreviewModal implementado
- ✅ GameSummaryPopup con sección WIN/LOSS prominente
- ✅ Early win detection (ganas al llegar a 10 antes del timer)
- ✅ Confeti y sonidos integrados
- ✅ Timer con colores (verde > 21s, amarillo 11-20s, rojo < 11s)

### 2. PlayerPosition.vue (TIMED - 30s/10 aciertos)
- ✅ GamePreviewModal implementado
- ✅ GameSummaryPopup con sección WIN/LOSS prominente
- ✅ Early win detection
- ✅ Confeti y sonidos integrados
- ✅ Timer con colores

---

## 🔄 PENDIENTES DE IMPLEMENTACIÓN

### 3. ShirtNumber.vue (TIMED - 30s/10 aciertos)

**Imports a agregar:**
```javascript
import { celebrateCorrect, checkEarlyWin, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/GameSummaryPopup.vue'
```

**Computed property a agregar:**
```javascript
computed: {
  gameMetadata() { return getGameMetadata('shirt-number') }
}
```

**Data properties a agregar:**
```javascript
earlyWin: false,
```

**En el método `choose(opt)`:**
- Agregar: `if (this.timeOver || this.earlyWin) return false` al inicio
- Cuando correcto, después de onCorrect(): agregar `celebrateCorrect()`
- Después de actualizar corrects, agregar:
```javascript
if (this.mode === 'challenge' && checkEarlyWin(this.corrects)) {
  this.earlyWin = true
  this.timeOver = true
  clearInterval(this.timer)
  celebrateGameWin()
  await this.finishChallenge('win')
  return correct
}
```

**En startChallenge(), dentro del timer setInterval:**
Reemplazar la parte de `if (this.timeLeft <= 0)` con:
```javascript
if (this.timeLeft <= 0 && !this.earlyWin) {
  this.timeOver = true
  clearInterval(this.timer)
  const result = (this.corrects || 0) >= 10 ? 'win' : 'loss'
  if (result === 'win') celebrateGameWin()
  else announceGameLoss()
  this.finishChallenge(result)
}
```

**Método nuevo a agregar:**
```javascript
async finishChallenge(result) {
  try {
    await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { maxStreak: this.maxStreak, result, corrects: this.corrects })
    
    const { data } = await getUserLevel(null)
    const info = Array.isArray(data) ? data[0] : data
    this.levelAfter = info?.level ?? null
    this.xpAfterTotal = info?.xp_total ?? 0
    const next = info?.next_level_xp || 0
    const toNext = info?.xp_to_next ?? 0
    const completed = next ? (next - toNext) : next
    this.afterPercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
    this.xpToNextAfter = toNext ?? null
    
    if ((this.levelAfter || 0) > (this.levelBefore || 0)) {
      celebrateGameLevelUp(this.levelAfter, 500)
    }
    
    await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
      xpView: {
        levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
        levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
        beforePercent: this.beforePercent, afterPercent: this.afterPercent,
        xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
      }
    })
    
    this.lifetimeMaxStreak = Math.max(await fetchLifetimeMaxStreak('shirt-number') || 0, this.maxStreak || 0)
    this.progressShown = this.beforePercent
    this.showSummary = true
    requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
    
    import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('shirt-number')).catch(()=>{})
  } catch (e) {
    console.error('[ShirtNumber finish]', e)
  }
}
```

**Template:**
- Agregar ANTES del `<section>`:
```vue
<GamePreviewModal
  :open="overlayOpen && mode === 'challenge' && !reviewMode"
  gameName="Número de camiseta"
  gameDescription="Identificá el número de camiseta correcto del jugador"
  :mechanic="gameMetadata.mechanic"
  :videoUrl="gameMetadata.videoUrl"
  :tips="gameMetadata.tips"
  @close="overlayOpen = false"
  @start="startChallenge"
/>
```

- REEMPLAZAR el `<div v-if="showSummary"...` con:
```vue
<GameSummaryPopup
  :show="showSummary"
  :corrects="corrects"
  :score="score"
  :maxStreak="maxStreak"
  :lifetimeMaxStreak="lifetimeMaxStreak"
  :levelBefore="levelBefore"
  :levelAfter="levelAfter"
  :xpBeforeTotal="xpBeforeTotal"
  :xpAfterTotal="xpAfterTotal"
  :beforePercent="beforePercent"
  :afterPercent="afterPercent"
  :progressShown="progressShown"
  :xpToNextAfter="xpToNextAfter"
  :winThreshold="10"
  :backPath="backPath()"
  @close="showSummary = false"
/>
```

---

### 4, 5, 6. ValueOrder.vue, AgeOrder.vue, HeightOrder.vue (ORDERING - 5/5 correctos)

**Diferencias clave con TIMED:**
- NO hay timer (sin límite de tiempo)
- winThreshold: 5 (todos los 5 correctos)
- Mechanic en games.js: "Ordená los 5 jugadores correctamente para ganar"

**Imports a agregar:**
```javascript
import { celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/GameSummaryPopup.vue'
```

**Computed property:**
```javascript
computed: {
  gameMetadata() { return getGameMetadata('value-order') } // o 'age-order', 'height-order'
}
```

**En el método `check()`, después de calcular correctPositions:**
```javascript
if (this.mode === 'challenge') {
  const result = correctPositions === 5 ? 'win' : 'loss'
  if (result === 'win') celebrateGameWin()
  else announceGameLoss()
  // ... resto del código existente
}
```

**Template:**
- Agregar ANTES del `<section>`:
```vue
<GamePreviewModal
  :open="overlayOpen && mode === 'challenge' && !reviewMode"
  gameName="Valor de mercado" <!-- o "Ordenar por edad", "Ordenar por altura" -->
  gameDescription="Ordená 5 jugadores según su valor de mercado" <!-- adaptar por juego -->
  :mechanic="gameMetadata.mechanic"
  :videoUrl="gameMetadata.videoUrl"
  :tips="gameMetadata.tips"
  @close="overlayOpen = false"
  @start="startChallenge"
/>
```

- REEMPLAZAR el `<div v-if="showSummary && mode==='challenge'"...` con:
```vue
<GameSummaryPopup
  :show="showSummary && mode==='challenge'"
  :corrects="corrects"
  :score="score"
  :maxStreak="0"
  :lifetimeMaxStreak="0"
  :levelBefore="levelBefore"
  :levelAfter="levelAfter"
  :xpBeforeTotal="xpBeforeTotal"
  :xpAfterTotal="xpAfterTotal"
  :beforePercent="beforePercent"
  :afterPercent="afterPercent"
  :progressShown="progressShown"
  :xpToNextAfter="xpToNextAfter"
  :winThreshold="5"
  :backPath="backPath()"
  @close="showSummary = false"
/>
```

**Nota:** Los juegos de ordenamiento NO tienen streak, por eso maxStreak y lifetimeMaxStreak son 0.

---

### 7, 8. WhoIs.vue y GuessPlayer.vue (LIVES - sistema de vidas)

**Status actual:**
- ✅ Ya tienen `celebrateCorrect()` implementado
- ✅ Ya tienen confeti y sonidos básicos
- ⏳ Necesitan: GamePreviewModal y GameSummaryPopup

**Imports a agregar:**
```javascript
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/GamePreviewModal.vue'
import GameSummaryPopup from '../../components/GameSummaryPopup.vue'
```

**Computed property:**
```javascript
computed: {
  gameMetadata() { return getGameMetadata('who-is') } // o 'guess-player'
}
```

**Template:**
- Agregar GamePreviewModal al inicio
- Adaptar GameSummaryPopup (estos juegos usan vidas, no winThreshold fijo)
- Considerar mostrar "Vidas restantes" en el popup

**Mechanic específica:**
- `getGameMetadata('who-is')`: "Adiviná jugadores sin perder todas las vidas"
- Tips ya definidos en games.js

---

## 📊 RESUMEN DE IMPLEMENTACIÓN

| Juego | Tipo | Timer | Win Condition | Estado |
|-------|------|-------|---------------|--------|
| NationalityGame | TIMED | 30s | 10 aciertos | ✅ COMPLETO |
| PlayerPosition | TIMED | 30s | 10 aciertos | ✅ COMPLETO |
| ShirtNumber | TIMED | 30s | 10 aciertos | 📝 Documentado |
| ValueOrder | ORDERING | No | 5/5 correctos | 📝 Documentado |
| AgeOrder | ORDERING | No | 5/5 correctos | 📝 Documentado |
| HeightOrder | ORDERING | No | 5/5 correctos | 📝 Documentado |
| WhoIs | LIVES | No | Sin perder vidas | 📝 Documentado |
| GuessPlayer | LIVES | No | Sin perder vidas | 📝 Documentado |

---

## 🎯 PRÓXIMOS PASOS

1. Implementar ShirtNumber (mismo patrón que PlayerPosition)
2. Implementar los 3 ORDERING games (ValueOrder, AgeOrder, HeightOrder)
3. Adaptar los 2 LIVES games (WhoIs, GuessPlayer) con GamePreviewModal
4. Grabar videos para cada juego y actualizar `videoUrl` en games.js
5. Testear todos los flujos (victoria, derrota, early win, level up)
