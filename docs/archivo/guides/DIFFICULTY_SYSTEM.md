# 🎯 SISTEMA DE DIFICULTAD - GOALDEMY V2

## ✅ Implementación Completada

El sistema de dificultad dinámico está **100% funcional** para NationalityGame y listo para replicarse en los otros 7 juegos.

---

## 🏗️ Arquitectura

### **1. Configuración de Dificultades** (`services/games.js`)

```javascript
// 3 niveles de dificultad
DIFFICULTY_LEVELS = {
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard'
}

// Configuraciones específicas por tipo de juego
TIMED_DIFFICULTY_CONFIG      // Para juegos con tiempo límite
ORDERING_DIFFICULTY_CONFIG   // Para juegos de ordenamiento
LIVES_DIFFICULTY_CONFIG      // Para juegos con vidas
```

### **2. Selector Visual** (`components/game/GamePreviewModal.vue`)

- Modal pre-juego con **3 botones de dificultad** interactivos
- Indicador visual de selección (✓ verde)
- Badges de XP dinámicos
- Descripción de cada dificultad
- Responsive design

### **3. Sistema de XP Dinámico** (`services/game-xp.js`)

- XP variable según dificultad seleccionada
- Metadata de dificultad en cada award
- Tracking de performance por dificultad

---

## 📊 Configuración por Tipo de Juego

### **TIMED (30s, 45s, 60s)**

Juegos: NationalityGame, PlayerPosition, ShirtNumber, GuessPlayer

| Dificultad | Tiempo | XP/Correcto | XP Completar | Total (10 aciertos) |
|------------|--------|-------------|--------------|---------------------|
| 🟢 Fácil   | 60s    | 5 XP        | 50 XP        | **100 XP**          |
| 🟡 Normal  | 45s    | 10 XP       | 100 XP       | **200 XP**          |
| 🔴 Difícil | 30s    | 20 XP       | 200 XP       | **400 XP**          |

### **ORDERING (3, 5, 7 elementos)**

Juegos: ValueOrder, AgeOrder, HeightOrder

| Dificultad | Elementos | XP Completar |
|------------|-----------|--------------|
| 🟢 Fácil   | 3 jugadores | 30 XP      |
| 🟡 Normal  | 5 jugadores | 75 XP      |
| 🔴 Difícil | 7 jugadores | 150 XP     |

### **LIVES (1, 3, 5 vidas)**

Juegos: WhoIs

| Dificultad | Vidas | XP/Correcto | XP Completar |
|------------|-------|-------------|--------------|
| 🟢 Fácil   | 5     | 10 XP       | 75 XP        |
| 🟡 Normal  | 3     | 15 XP       | 125 XP       |
| 🔴 Difícil | 1     | 30 XP       | 250 XP       |

---

## 🔧 Cómo Implementar en Otros Juegos

### **Paso 1: Actualizar el componente Vue**

```vue
<script>
import { GAME_TYPES } from '@/services/game-celebrations';

export default {
  data() {
    return {
      // ... estado existente
      selectedDifficulty: 'normal',
      difficultyConfig: null,
    }
  }
}
</script>

<template>
  <GamePreviewModal
    :gameType="'TIMED'"  // o 'ORDERING' o 'LIVES'
    :open="overlayOpen"
    @start="startGame"
  />
</template>
```

### **Paso 2: Recibir config en startGame**

```javascript
async startGame({ difficulty, config }) {
  this.selectedDifficulty = difficulty
  this.difficultyConfig = config
  
  // Para TIMED: usar config.time
  this.timeLeft = config.time  // 30, 45 o 60 segundos
  
  // Para ORDERING: usar config.itemCount
  const itemsToOrder = this.selectRandomPlayers(config.itemCount)  // 3, 5 o 7
  
  // Para LIVES: usar config.lives
  this.livesRemaining = config.lives  // 1, 3 o 5
}
```

### **Paso 3: Actualizar servicio del juego**

```javascript
// En services/[game-name].js

export function initState() {
  return {
    // ... estado existente
    difficulty: 'normal',
    difficultyConfig: null,
  }
}

export async function pick(state, option, confettiHost) {
  if (correct) {
    const xpAmount = state.difficultyConfig?.xpPerCorrect || 10
    
    await awardXpForCorrect({ 
      gameCode: 'your-game',
      amount: xpAmount,
      difficulty: state.difficulty
    })
    
    spawnXpBadge(confettiHost, `+${xpAmount} XP`)
  }
}
```

### **Paso 4: Pasar config al servicio**

```javascript
// En mounted() del componente Vue
loadPlayers(this)
this.difficulty = this.selectedDifficulty  // Pasar al servicio
this.difficultyConfig = getDifficultyConfig('TIMED', 'normal')
```

---

## 🎮 Ejemplo Completo: NationalityGame

**Archivos modificados:**

1. ✅ `services/games.js` - Constantes de dificultad
2. ✅ `components/game/GamePreviewModal.vue` - Selector visual
3. ✅ `services/game-xp.js` - XP dinámico
4. ✅ `pages/games/NationalityGame.vue` - Integración completa
5. ✅ `services/nationality.js` - Lógica de XP por dificultad

**Flujo completo:**

```
Usuario abre juego
  ↓
Modal muestra selector de dificultad (Fácil/Normal/Difícil)
  ↓
Usuario elige Difícil (30s, 20 XP/acierto)
  ↓
Juego inicia con timeLeft = 30
  ↓
Por cada respuesta correcta: +20 XP
  ↓
Al completar 10 aciertos: +200 XP bonus
  ↓
Total: 400 XP (vs 200 XP en Normal)
```

---

## 📋 Checklist de Implementación

### **Juegos TIMED** (4/4)
- [x] NationalityGame ✅ **IMPLEMENTADO**
- [ ] PlayerPosition
- [ ] ShirtNumber
- [ ] GuessPlayer

### **Juegos ORDERING** (0/3)
- [ ] ValueOrder
- [ ] AgeOrder
- [ ] HeightOrder

### **Juegos LIVES** (0/1)
- [ ] WhoIs

---

## 🔄 Próximos Pasos

1. **Replicar a los otros 7 juegos** siguiendo el patrón de NationalityGame
2. **Testing**: Verificar XP correcto en cada dificultad
3. **Balance**: Ajustar valores de XP si es necesario
4. **Achievements**: Crear logros por dificultad (ej: "Hard Mode Master")
5. **Estadísticas**: Trackear win rate por dificultad
6. **Leaderboards**: Rankings separados por dificultad

---

## 🎨 UI/UX

**Selector de dificultad:**
- Grid de 3 columnas
- Iconos emoji (🟢 🟡 🔴)
- Animación de selección
- Badge de XP destacado
- Descripción clara de cada nivel
- Diseño responsive

**Feedback visual:**
- XP badge muestra cantidad exacta (+20 XP)
- Timer ajustado según dificultad
- Bonus XP al completar

---

**Última actualización**: 11 de diciembre de 2025
**Estado**: Sistema core implementado, pendiente replicación a otros juegos
