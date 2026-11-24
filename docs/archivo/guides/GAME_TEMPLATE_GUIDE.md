# 🎮 Guía para Estandarizar Juegos

## Patrón implementado en NationalityGame.vue

Esta guía documenta el patrón completo para replicar en TODOS los juegos.

---

## 📦 Imports necesarios

```javascript
import { celebrateCorrect, checkEarlyWin, celebrateGameWin, announceGameLoss, celebrateGameLevelUp, GAME_TYPES } from '../../services/game-celebrations'
import { getGameMetadata } from '../../services/games'
import GamePreviewModal from '../../components/GamePreviewModal.vue'
import GameResultBanner from '../../components/GameResultBanner.vue'
```

---

## 🎯 Data properties necesarias

```javascript
data() {
  return {
    // ... existing properties
    previewModalOpen: false,
    showResultBanner: false,
    gameWon: false,
    earlyWin: false,  // Solo para juegos TIMED
  }
},
computed: {
  gameMetadata() {
    return getGameMetadata('GAME-SLUG-HERE')  // Cambiar por slug del juego
  }
}
```

---

## 🎨 Template structure

### 1. Al inicio del `<template>`:

```vue
<template>
  <!-- Game Result Banner (aparece al ganar/perder) -->
  <GameResultBanner 
    :show="showResultBanner" 
    :won="gameWon" 
    :stats="{ correct: corrects, total: attempts }"
  />
  
  <!-- Game Preview Modal (antes de empezar) -->
  <GamePreviewModal
    :open="overlayOpen && mode === 'challenge' && !reviewMode"
    gameName="NOMBRE DEL JUEGO"
    gameDescription="Descripción corta"
    :mechanic="gameMetadata.mechanic"
    :videoUrl="gameMetadata.videoUrl"
    :tips="gameMetadata.tips"
    @close="overlayOpen = false"
    @start="startChallenge"
  />
  
  <section class="grid place-items-center">
    <!-- resto del template -->
```

### 2. Reemplazar el popup final por este:

```vue
<!-- End-of-game summary con resultado destacado -->
<div v-if="showSummary" class="absolute inset-0 z-30 grid place-items-center bg-slate-900/80 backdrop-blur rounded-xl p-4">
  <div class="w-full max-w-lg rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-2xl">
    
    <!-- RESULTADO DESTACADO -->
    <div :class="[
      'p-6 text-center border-b',
      (corrects >= WIN_THRESHOLD) 
        ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-500/30' 
        : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'
    ]">
      <div class="text-6xl mb-3">{{ (corrects >= WIN_THRESHOLD) ? '🎉' : '💪' }}</div>
      <h2 :class="[
        'text-4xl font-extrabold mb-2',
        (corrects >= WIN_THRESHOLD) ? 'text-emerald-400' : 'text-red-400'
      ]">
        {{ (corrects >= WIN_THRESHOLD) ? '¡GANASTE!' : '¡PERDISTE!' }}
      </h2>
      <p class="text-white text-lg font-medium">
        {{ (corrects >= WIN_THRESHOLD) 
          ? 'Excelente trabajo, seguí así' 
          : 'No te rindas, volvé a intentarlo mañana' 
        }}
      </p>
      <!-- Stats principales -->
      <div class="mt-4 flex justify-center gap-3">
        <div class="rounded-xl bg-black/20 backdrop-blur px-4 py-2 border border-white/10">
          <div class="text-xs uppercase tracking-wider text-slate-300">Aciertos</div>
          <div class="text-2xl font-bold text-white">{{ corrects }}<span class="text-slate-400 text-lg">/{{ WIN_THRESHOLD }}</span></div>
        </div>
        <div class="rounded-xl bg-black/20 backdrop-blur px-4 py-2 border border-white/10">
          <div class="text-xs uppercase tracking-wider text-slate-300">Puntaje</div>
          <div class="text-2xl font-bold text-white">{{ score }}</div>
        </div>
      </div>
    </div>

    <!-- Sección de detalles -->
    <div class="p-6">
      <!-- Rachas -->
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Racha hoy</div>
          <div class="text-emerald-300 font-bold text-xl">×{{ maxStreak || 0 }}</div>
        </div>
        <div class="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Histórica</div>
          <div class="text-indigo-300 font-bold text-xl">×{{ lifetimeMaxStreak || 0 }}</div>
        </div>
      </div>

      <!-- Progreso XP -->
      <div class="rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-4 mb-5">
        <div class="flex items-center justify-between text-sm text-slate-300 mb-2">
          <span class="font-semibold">Progreso de XP</span>
          <span class="tabular-nums">
            <span class="text-slate-400">{{ xpBeforeTotal }}</span> → 
            <span class="text-white font-bold">{{ xpAfterTotal }}</span> 
            <span class="text-emerald-400 font-bold">(+{{ Math.max(0, (xpAfterTotal - xpBeforeTotal) || 0) }})</span>
          </span>
        </div>
        <div class="h-3 rounded-full bg-black/30 overflow-hidden mb-2">
          <div 
            class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-700 shadow-lg" 
            :style="{ width: (progressShown||0) + '%' }"
          ></div>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">
            Nivel <span class="text-white font-semibold">{{ levelBefore ?? '—' }}</span> → 
            <span :class="(levelAfter||0)>(levelBefore||0)?'text-yellow-300 font-bold':'text-slate-300'">
              {{ levelAfter ?? '—' }}
            </span>
          </span>
          <span v-if="(xpToNextAfter ?? null) !== null" class="text-slate-400">
            Faltan <span class="text-white font-semibold">{{ xpToNextAfter }} XP</span>
          </span>
        </div>
      </div>

      <!-- Botones -->
      <div class="flex gap-3">
        <button 
          @click="showSummary=false" 
          class="flex-1 rounded-xl border border-white/20 hover:bg-white/5 text-white py-3 font-semibold transition"
        >
          Cerrar
        </button>
        <router-link 
          to="/play/points" 
          class="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white py-3 font-bold transition text-center shadow-lg shadow-emerald-500/25"
        >
          Volver a juegos
        </router-link>
      </div>
    </div>

  </div>
</div>
```

**Nota:** Reemplazar `WIN_THRESHOLD` por:
- `10` para juegos TIMED (nationality, player-position, shirt-number)
- `5` para juegos ORDERING (value-order, age-order, height-order)
- Condición custom para juegos LIVES

---

## 🎵 Integrar sonidos y celebraciones

### Para juegos TIMED (30 segundos, 10 aciertos):

#### En el método pick/submit:
```javascript
pick(option) { 
  if (this.timeOver || this.earlyWin) return
  const ok = pick(this, option, this.$refs.confettiHost)
  
  // Check early win: 10 corrects reached
  if (this.mode === 'challenge' && !this.earlyWin && checkEarlyWin(this.corrects)) {
    this.earlyWin = true
    this.timeOver = true
    clearInterval(this.timer)
    
    // Celebrate immediately (no banner, just confetti/sound)
    celebrateGameWin(200)
    this.gameWon = true
    
    // Complete challenge
    setTimeout(() => this.finishChallenge('win'), 800)
  } else {
    setTimeout(() => this.nextRound(), 1000)
  }
}
```

#### En el timer (cuando termina el tiempo):
```javascript
if (this.timeLeft <= 0) {
  this.timeOver = true
  clearInterval(this.timer)
  
  // Determine result and celebrate
  const result = (this.corrects || 0) >= 10 ? 'win' : 'loss'
  this.gameWon = result === 'win'
  
  if (result === 'win') {
    celebrateGameWin()
  } else {
    announceGameLoss()
  }
  
  this.showResultBanner = true
  
  // Finish challenge after brief delay
  setTimeout(() => this.finishChallenge(result), 1500)
}
```

#### En el service del juego (ej: nationality.js):
```javascript
import { celebrateCorrect } from './game-celebrations'

export async function pick(state, option, confettiHost) {
  if (state.answered) return false
  state.answered = true
  state.selected = option.value
  const correct = option.value === state.current.cname
  
  if (correct) {
    // Play correct sound immediately
    celebrateCorrect()
    // ... rest of logic
  }
  // ...
}
```

### Para juegos ORDERING (ordenar 5 jugadores):

```javascript
async submit() {
  // Check if all 5 are correct
  const allCorrect = this.checkAllCorrect()
  const result = allCorrect ? 'win' : 'loss'
  this.gameWon = allCorrect
  
  if (allCorrect) {
    celebrateGameWin()
  } else {
    announceGameLoss()
  }
  
  this.showResultBanner = true
  setTimeout(() => this.finishChallenge(result), 1500)
}
```

### Función finishChallenge (universal):

```javascript
async finishChallenge(result) {
  // Complete session
  await completeChallengeSession(this.sessionId, this.score, this.xpEarned, { 
    maxStreak: this.maxStreak, 
    result, 
    corrects: this.corrects 
  }).catch(()=>{})
  
  // Fetch level after
  try {
    const { data } = await getUserLevel(null)
    const info = Array.isArray(data) ? data[0] : data
    this.levelAfter = info?.level ?? null
    this.xpAfterTotal = info?.xp_total ?? 0
    const next = info?.next_level_xp || 0
    const toNext = info?.xp_to_next ?? 0
    const completed = next ? (next - toNext) : next
    this.afterPercent = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
    this.xpToNextAfter = toNext ?? null
    
    // Check level up
    if (this.levelAfter && this.levelBefore && this.levelAfter > this.levelBefore) {
      celebrateGameLevelUp(this.levelAfter)
    }
  } catch {}
  
  // Save XP snapshot
  try {
    await completeChallengeSession(this.sessionId, this.score, this.xpEarned, {
      xpView: {
        levelBefore: this.levelBefore, xpBeforeTotal: this.xpBeforeTotal,
        levelAfter: this.levelAfter, xpAfterTotal: this.xpAfterTotal,
        beforePercent: this.beforePercent, afterPercent: this.afterPercent,
        xpToNextAfter: this.xpToNextAfter, xpEarned: this.xpEarned
      }
    })
  } catch {}
  
  // Show summary
  this.progressShown = this.beforePercent
  this.showSummary = true
  requestAnimationFrame(() => setTimeout(() => { this.progressShown = this.afterPercent }, 40))
  
  // Fetch lifetime streak
  fetchLifetimeMaxStreak('GAME-SLUG').then(v => this.lifetimeMaxStreak = Math.max(v || 0, this.maxStreak || 0)).catch(()=>{})
  
  // Unlock daily achievements
  import('../../services/game-modes').then(mod => mod.checkAndUnlockDailyWins('GAME-SLUG')).catch(()=>{})
}
```

---

## 📝 Metadata en games.js

Asegurate de que el juego tenga metadata en `GAME_METADATA`:

```javascript
'game-slug': {
  type: GAME_TYPES.TIMED, // o ORDERING, LIVES, ROUNDS
  mechanic: 'Hacé 10 aciertos en 30 segundos para ganar',
  videoUrl: '', // Agregar URL cuando grabes video
  tips: [
    'Tip 1',
    'Tip 2',
    'Tip 3'
  ]
}
```

---

## ✅ Checklist por juego

- [ ] Imports agregados
- [ ] Data properties (previewModalOpen, showResultBanner, gameWon, earlyWin)
- [ ] Computed gameMetadata
- [ ] GameResultBanner en template
- [ ] GamePreviewModal en template  
- [ ] Popup final rediseñado con resultado destacado
- [ ] celebrateCorrect() en cada acierto
- [ ] celebrateGameWin() / announceGameLoss() al terminar
- [ ] celebrateGameLevelUp() en level up
- [ ] checkEarlyWin() para juegos TIMED
- [ ] finishChallenge() method
- [ ] Metadata en games.js

---

## 🎮 Juegos pendientes

### TIMED (30s, 10 aciertos):
- [ ] PlayerPosition.vue
- [ ] ShirtNumber.vue

### ORDERING (5 correctos):
- [ ] ValueOrder.vue
- [ ] AgeOrder.vue
- [ ] HeightOrder.vue

### LIVES (vidas):
- [x] WhoIs.vue (ya tiene sonidos/confetti, falta modal y popup final)
- [x] GuessPlayer.vue (ya tiene sonidos/confetti, falta modal y popup final)

---

## 🎥 Videos preview

Una vez que tengas los videos grabados (10-15 seg jugando):
1. Subí a `/public/videos/`
2. Actualizá `videoUrl` en `GAME_METADATA` de games.js
3. Ejemplo: `videoUrl: '/videos/nationality-preview.mp4'`
