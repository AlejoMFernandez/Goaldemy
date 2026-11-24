# 🎮 ESTÁNDAR DE LAYOUT PARA JUEGOS - GOALDEMY

Este documento define el layout estandarizado que TODOS los juegos deben seguir.

## 📐 Estructura Base

```vue
<template>
  <!-- Game Preview Modal -->
  <GamePreviewModal
    :open="overlayOpen && mode === 'challenge' && !reviewMode"
    :gameName="[NOMBRE DEL JUEGO]"
    :gameDescription="[DESCRIPCIÓN]"
    :mechanic="gameMetadata.mechanic"
    :videoUrl="gameMetadata.videoUrl"
    :tips="gameMetadata.tips"
    @close="overlayOpen = false"
    @start="startChallenge"
  />
  
  <!-- Main Game Container -->
  <section class="grid place-items-center min-h-[600px]">
    <div class="space-y-4 w-full max-w-4xl">
      
      <!-- HEADER: Título + Controls -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 w-full">
        <!-- Título -->
        <AppH1 class="text-3xl md:text-4xl flex-none">[NOMBRE DEL JUEGO]</AppH1>
        
        <!-- Controls (Botón Volver + Score + Racha) -->
        <div class="flex items-center gap-2 self-stretch sm:self-auto flex-none">
          <!-- Botón Volver -->
          <router-link 
            :to="backPath()" 
            class="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 transition"
          >
            ← Volver
          </router-link>
          
          <!-- Score + Racha -->
          <div class="rounded-xl bg-slate-900/60 border border-white/15 px-3 py-2 flex items-center gap-2">
            <span class="text-slate-300 text-xs uppercase tracking-wider">Puntaje</span>
            <span class="text-white font-extrabold text-lg leading-none whitespace-nowrap">{{ score }}/{{ attempts * 10 }}</span>
            <div v-if="streak > 0" class="rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 text-xs px-2.5 py-1 font-semibold">
              ×{{ streak }}
            </div>
          </div>
        </div>
      </div>

      <!-- LOADING STATE -->
      <div v-if="loading" class="text-center text-slate-300 py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
        <p class="mt-3">Cargando...</p>
      </div>
      
      <!-- GAME CARD -->
      <div v-else class="relative card p-6">
        <!-- Confetti Container -->
        <div ref="confettiHost" class="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"></div>
        
        <!-- Timer (SOLO PARA JUEGOS TIMED - top-left) -->
        <div v-if="mode==='challenge'" class="absolute left-4 top-4 z-20 pointer-events-none">
          <div :class="[
            'rounded-full px-3 py-1.5 text-sm font-bold shadow border',
            timeLeft >= 21 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' :
            timeLeft >= 11 ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' :
                             'bg-red-500/15 text-red-300 border-red-500/40'
          ]">
            ⏱ {{ Math.max(0, timeLeft) }}s
          </div>
        </div>
        
        <!-- CONTENIDO DEL JUEGO CON TRANSITION -->
        <Transition name="round-fade" mode="out-in">
          <div :key="roundKey">
            <!-- AQUÍ VA EL CONTENIDO ESPECÍFICO DE CADA JUEGO -->
          </div>
        </Transition>
        
        <!-- Time Over Message -->
        <div v-if="timeOver && mode==='challenge'" class="mt-4 text-center text-amber-300 text-sm font-medium">
          ⏱ Tiempo agotado. ¡Buen intento!
        </div>
        
        <!-- Game Summary Popup -->
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
      </div>
      
    </div>
  </section>
</template>

<style scoped>
/* Transición estandarizada para cambios de ronda */
.round-fade-enter-active,
.round-fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.round-fade-enter-from,
.round-fade-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

/* Clases globales de botones de opciones */
.option-btn {
  @apply rounded-xl border px-4 py-3 text-slate-200 transition-all duration-150 font-medium;
  @apply hover:scale-[1.02] active:scale-[0.98];
}

.option-btn-default {
  @apply border-white/10 hover:border-white/25 hover:bg-white/5;
}

.option-btn-correct {
  @apply border-emerald-500 bg-emerald-500/10 text-emerald-300;
}

.option-btn-incorrect {
  @apply border-red-500 bg-red-500/10 text-red-300;
}

.option-btn-disabled {
  @apply border-white/10 opacity-70 cursor-not-allowed;
}
</style>
```

## 🎨 Especificaciones

### Spacing
- **Container**: `max-w-4xl` (consistente)
- **Gap vertical**: `space-y-4`
- **Card padding**: `p-6` (aumentado de p-4)
- **Header gap**: `gap-3`

### Typography
- **Título**: `text-3xl md:text-4xl` (estandarizado)
- **Score label**: `text-xs uppercase tracking-wider`
- **Score value**: `text-lg font-extrabold`
- **Racha**: `text-xs px-2.5 py-1`

### Colors
- **Timer verde**: `bg-emerald-500/15 text-emerald-300 border-emerald-500/40`
- **Timer amarillo**: `bg-amber-500/15 text-amber-300 border-amber-500/40`
- **Timer rojo**: `bg-red-500/15 text-red-300 border-red-500/40`
- **Racha**: `border-emerald-500/60 bg-emerald-500/10 text-emerald-300`

### Positioning
- **Timer**: `absolute left-4 top-4` (consistente para todos)
- **Confetti**: `absolute inset-0` con `overflow-hidden rounded-xl`

### Transitions
- **Duration**: 200ms (estandarizado)
- **Transform**: `translateY(8px) scale(0.98)`

## 📝 Notas
- GameSummaryPopup ya está estandarizado
- GamePreviewModal ya está estandarizado
- WhoIs y ValueOrder NO tienen timer (son LIVES y ORDERING)
