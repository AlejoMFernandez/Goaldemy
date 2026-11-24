# Guía de Implementación del Sistema de Dificultad

## 📋 Resumen
Esta guía te ayudará a implementar el sistema de dificultad en cualquier juego de Goaldemy.

---

## 🎯 Paso 1: Configurar el tipo de juego en `games.js`

### 1.1 Verificar que el juego tenga metadata
En `src/services/games.js`, busca el objeto `GAME_METADATA` y asegúrate de que tu juego tenga:

```javascript
const GAME_METADATA = {
  'tu-juego': {
    type: GAME_TYPES.TIMED,  // O ORDERING, o LIVES
    mechanic: 'Descripción del objetivo',
    videoUrl: '',
    tips: ['Consejo 1', 'Consejo 2']
  }
}
```

**Tipos de juego disponibles:**
- `GAME_TYPES.TIMED` - Juegos con tiempo límite (ej: Nationality, Player Position)
- `GAME_TYPES.ORDERING` - Juegos de ordenar elementos (ej: Value Order, Age Order)
- `GAME_TYPES.LIVES` - Juegos con sistema de vidas (ej: Who Is)

---

## 🎮 Paso 2: Actualizar el componente Vue del juego

### 2.1 Importar el sistema de dificultad

```javascript
import { GAME_TYPES } from '@/services/game-celebrations'
import { DIFFICULTY_LEVELS, getDifficultyConfig } from '@/services/games'
import GamePreviewModal from '@/components/game/GamePreviewModal.vue'
```

### 2.2 Agregar el componente al `components`

```javascript
components: { 
  AppH1, 
  GamePreviewModal  // ← Agregar
}
```

### 2.3 Actualizar el `data()`

```javascript
data() {
  return { 
    // ... estado existente del juego
    
    // Sistema de dificultad (AGREGAR)
    selectedDifficulty: 'normal',
    difficultyConfig: null,
    
    // Para el modal preview
    overlayOpen: false,
    
    // Para el resumen final
    showSummary: false,
    xpEarned: 0,
    
    // ... resto del estado
  }
}
```

### 2.4 Agregar computed para metadata

```javascript
computed: {
  gameMetadata() {
    return getGameMetadata('nombre-del-juego')
  }
}
```

### 2.5 Actualizar el método `startChallenge`

```javascript
async startChallenge({ difficulty, config }) {
  if (!this.availability.available) return
  
  // Guardar configuración de dificultad
  this.selectedDifficulty = difficulty
  this.difficultyConfig = config
  
  // Usar la configuración según el tipo de juego
  if (config.time) {
    // Para juegos TIMED
    const timeLimit = config.time
    this.timeLeft = timeLimit
  } else if (config.lives) {
    // Para juegos LIVES
    this.lives = config.lives
  } else if (config.itemCount) {
    // Para juegos ORDERING
    // Ajustar cantidad de elementos a ordenar
  }
  
  // Iniciar sesión y juego
  this.sessionId = await startChallengeSession('nombre-juego', timeLimit || 60)
  this.overlayOpen = false
  
  // ... resto de la lógica de inicio
}
```

### 2.6 Modificar el sistema de XP

Cuando otorgues XP por respuesta correcta:

```javascript
// ANTES
await awardXpForCorrect(10, this.allowXp, this.sessionId, 'nombre-juego')

// DESPUÉS
const xpAmount = this.difficultyConfig?.xpPerCorrect || 10
await awardXpForCorrect(xpAmount, this.allowXp, this.sessionId, 'nombre-juego')
this.xpEarned += xpAmount
```

### 2.7 Actualizar el resumen final

Reemplaza la sección donde muestras "Puntaje" por:

```html
<div class="rounded-xl bg-black/20 backdrop-blur px-3 py-1.5 border border-white/10">
  <div class="text-[10px] uppercase tracking-wider text-slate-300">XP Ganado</div>
  <div class="flex items-baseline gap-1">
    <span class="text-lg font-semibold text-white">{{ xpEarned || score }}</span>
    <span 
      :class="[
        'text-xl font-bold',
        difficultyConfig?.xpPerCorrect === 10 ? 'text-green-400' : 
        difficultyConfig?.xpPerCorrect === 30 ? 'text-red-400' : 'text-yellow-400'
      ]"
    >
      {{ difficultyConfig?.xpPerCorrect === 10 ? '×1' : 
         difficultyConfig?.xpPerCorrect === 30 ? '×3' : '×2' }}
    </span>
  </div>
</div>
```

---

## 🎨 Paso 3: Agregar el Modal de Preview

En la template, **antes** de la sección del juego:

```html
<!-- Game Preview Modal -->
<GamePreviewModal
  :open="overlayOpen && mode === 'challenge' && !reviewMode"
  :game-name="gameMetadata.mechanic ? 'Nombre del Juego' : 'Nombre del Juego'"
  :game-description="gameMetadata.mechanic"
  :game-type="gameMetadata.type"
  :mechanic="gameMetadata.mechanic"
  :tips="gameMetadata.tips"
  :video-url="gameMetadata.videoUrl"
  @close="overlayOpen = false"
  @start="startChallenge"
/>
```

---

## ✅ Checklist de Implementación

- [ ] Metadata configurado en `GAME_METADATA` con el tipo correcto
- [ ] `GamePreviewModal` importado y agregado a components
- [ ] Variables de dificultad agregadas al `data()`
- [ ] `gameMetadata` computed agregado
- [ ] Método `startChallenge` actualizado para recibir `{ difficulty, config }`
- [ ] Sistema de XP usa `difficultyConfig.xpPerCorrect`
- [ ] Variable `xpEarned` se incrementa con cada acierto
- [ ] Modal de preview agregado en el template
- [ ] Resumen final muestra "XP Ganado" con multiplicador
- [ ] Probado en las 3 dificultades (Fácil, Normal, Difícil)

---

## 🔧 Configuración de Dificultad por Tipo

### TIMED (con tiempo)
```javascript
EASY:   { time: 60, xpPerCorrect: 10, xpCompletion: 50 }
NORMAL: { time: 45, xpPerCorrect: 20, xpCompletion: 100 }
HARD:   { time: 30, xpPerCorrect: 30, xpCompletion: 200 }
```

### ORDERING (ordenar elementos)
```javascript
EASY:   { itemCount: 3, xpCompletion: 30 }
NORMAL: { itemCount: 5, xpCompletion: 75 }
HARD:   { itemCount: 7, xpCompletion: 150 }
```

### LIVES (con vidas)
```javascript
EASY:   { lives: 5, xpPerCorrect: 10, xpCompletion: 75 }
NORMAL: { lives: 3, xpPerCorrect: 15, xpCompletion: 125 }
HARD:   { lives: 1, xpPerCorrect: 30, xpCompletion: 250 }
```

---

## 💡 Ejemplo Completo

Ver `NationalityGame.vue` como referencia de implementación completa.

## 🐛 Troubleshooting

**El modal no se muestra:**
- Verifica que `overlayOpen = true` al montar en modo challenge
- Asegúrate de importar correctamente `GamePreviewModal`

**El multiplicador muestra ×2 en difícil:**
- Verifica que `difficultyConfig` se esté guardando correctamente en `startChallenge`
- Usa las dev tools para inspeccionar `this.difficultyConfig.xpPerCorrect`

**El XP no se calcula bien:**
- Asegúrate de inicializar `xpEarned = 0` al empezar
- Incrementa `xpEarned` en cada acierto con el valor de `difficultyConfig.xpPerCorrect`
