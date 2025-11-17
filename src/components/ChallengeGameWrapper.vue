<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUserLevel } from '../services/xp'
import { isChallengeAvailable, startChallengeSession, completeChallengeSession, fetchLifetimeMaxStreak } from '../services/game-modes'
import { getGameMetadata } from '../services/games'
import { GAME_TYPES, celebrateGameWin, announceGameLoss, celebrateGameLevelUp } from '../services/game-celebrations'
import GamePreviewModal from './GamePreviewModal.vue'

/**
 * Composable que maneja toda la lógica común de juegos:
 * - Timer para juegos TIMED
 * - Challenge session management
 * - XP tracking y level up detection
 * - Win/loss celebration
 * - Preview modal
 * - Summary popup
 */
export function useChallengeGame(gameSlug, options = {}) {
  const route = useRoute()
  const router = useRouter()
  
  // Options con defaults
  const {
    winThreshold = 10, // Para TIMED/ORDERING
    timerSeconds = 30,  // Para TIMED
    onCorrectAnswer = null, // Callback cuando acierta
    onIncorrectAnswer = null, // Callback cuando falla
  } = options

  // State
  const mode = ref('normal')
  const reviewMode = ref(false)
  const overlayOpen = ref(false)
  const timeLeft = ref(0)
  const timeOver = ref(false)
  const earlyWin = ref(false)
  const sessionId = ref(null)
  const availability = ref({ available: true, reason: null })
  const showSummary = ref(false)
  const lifetimeMaxStreak = ref(0)
  
  // XP tracking
  const levelBefore = ref(null)
  const levelAfter = ref(null)
  const xpBeforeTotal = ref(0)
  const xpAfterTotal = ref(0)
  const beforePercent = ref(0)
  const afterPercent = ref(0)
  const progressShown = ref(0)
  const xpToNextAfter = ref(null)

  // Timer
  let timer = null

  // Computed
  const gameMetadata = computed(() => getGameMetadata(gameSlug))
  const isTimedGame = computed(() => gameMetadata.value.type === GAME_TYPES.TIMED)
  const isOrderingGame = computed(() => gameMetadata.value.type === GAME_TYPES.ORDERING)
  
  // Methods
  async function checkAvailability() {
    availability.value = await isChallengeAvailable(gameSlug)
    if (availability.value.available && mode.value === 'challenge' && !reviewMode.value) {
      overlayOpen.value = true
    }
  }

  async function startChallenge() {
    if (!availability.value.available) return
    
    try {
      // Capture XP/level before
      try {
        const { data } = await getUserLevel(null)
        const info = Array.isArray(data) ? data[0] : data
        levelBefore.value = info?.level ?? null
        xpBeforeTotal.value = info?.xp_total ?? 0
        const next = info?.next_level_xp || 0
        const toNext = info?.xp_to_next ?? 0
        const completed = next ? (next - toNext) : next
        beforePercent.value = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
      } catch {}

      sessionId.value = await startChallengeSession(gameSlug, timerSeconds)
      overlayOpen.value = false
      
      // Start timer for TIMED games
      if (isTimedGame.value) {
        timeLeft.value = timerSeconds
        timeOver.value = false
        clearInterval(timer)
        timer = setInterval(() => {
          if (timeLeft.value > 0) timeLeft.value -= 1
          if (timeLeft.value <= 0) {
            onTimerEnd()
          }
        }, 1000)
      }
    } catch (e) {
      console.error(`[${gameSlug} challenge start]`, e)
    }
  }

  function onTimerEnd() {
    timeOver.value = true
    clearInterval(timer)
    // This will be called by the game component when timer ends
  }

  async function finishChallenge(result, gameStats = {}) {
    const { score = 0, xpEarned = 0, corrects = 0, maxStreak = 0 } = gameStats

    // Celebrate based on result
    if (result === 'win') {
      celebrateGameWin()
    } else {
      announceGameLoss()
    }

    // Complete session
    await completeChallengeSession(sessionId.value, score, xpEarned, { 
      maxStreak, 
      result, 
      corrects 
    }).catch(() => {})

    // Fetch level after
    try {
      const { data } = await getUserLevel(null)
      const info = Array.isArray(data) ? data[0] : data
      levelAfter.value = info?.level ?? null
      xpAfterTotal.value = info?.xp_total ?? 0
      const next = info?.next_level_xp || 0
      const toNext = info?.xp_to_next ?? 0
      const completed = next ? (next - toNext) : next
      afterPercent.value = next ? Math.max(0, Math.min(100, Math.round((completed / next) * 100))) : 100
      xpToNextAfter.value = toNext ?? null

      // Check level up
      if (levelAfter.value && levelBefore.value && levelAfter.value > levelBefore.value) {
        celebrateGameLevelUp(levelAfter.value)
      }
    } catch {}

    // Save XP snapshot
    try {
      await completeChallengeSession(sessionId.value, score, xpEarned, {
        xpView: {
          levelBefore: levelBefore.value,
          xpBeforeTotal: xpBeforeTotal.value,
          levelAfter: levelAfter.value,
          xpAfterTotal: xpAfterTotal.value,
          beforePercent: beforePercent.value,
          afterPercent: afterPercent.value,
          xpToNextAfter: xpToNextAfter.value,
          xpEarned
        }
      })
    } catch {}

    // Show summary with animation
    progressShown.value = beforePercent.value
    showSummary.value = true
    requestAnimationFrame(() => 
      setTimeout(() => { progressShown.value = afterPercent.value }, 40)
    )

    // Fetch lifetime streak
    fetchLifetimeMaxStreak(gameSlug)
      .then(v => lifetimeMaxStreak.value = Math.max(v || 0, maxStreak || 0))
      .catch(() => {})

    // Unlock daily achievements
    import('../services/game-modes')
      .then(mod => mod.checkAndUnlockDailyWins(gameSlug))
      .catch(() => {})
  }

  function checkWinCondition(corrects) {
    return corrects >= winThreshold
  }

  function handleEarlyWin(gameStats) {
    if (earlyWin.value) return
    
    earlyWin.value = true
    timeOver.value = true
    clearInterval(timer)
    
    celebrateGameWin(200)
    
    setTimeout(() => finishChallenge('win', gameStats), 800)
  }

  // Lifecycle
  onMounted(() => {
    const modeParam = (route.query.mode || '').toString().toLowerCase()
    if (modeParam === 'free') mode.value = 'free'
    else if (modeParam === 'challenge') mode.value = 'challenge'
    else if (modeParam === 'review') { 
      mode.value = 'challenge'
      reviewMode.value = true 
    } else {
      mode.value = 'normal'
    }
  })

  onUnmounted(() => {
    clearInterval(timer)
  })

  return {
    // State
    mode,
    reviewMode,
    overlayOpen,
    timeLeft,
    timeOver,
    earlyWin,
    sessionId,
    availability,
    showSummary,
    lifetimeMaxStreak,
    levelBefore,
    levelAfter,
    xpBeforeTotal,
    xpAfterTotal,
    beforePercent,
    afterPercent,
    progressShown,
    xpToNextAfter,
    
    // Computed
    gameMetadata,
    isTimedGame,
    isOrderingGame,
    winThreshold,
    
    // Methods
    checkAvailability,
    startChallenge,
    finishChallenge,
    checkWinCondition,
    handleEarlyWin,
    onTimerEnd,
  }
}

export default {
  name: 'ChallengeGameWrapper',
  components: { GamePreviewModal },
  props: {
    gameSlug: { type: String, required: true },
    gameName: { type: String, required: true },
    gameDescription: { type: String, default: '' }
  },
  setup(props) {
    return useChallengeGame(props.gameSlug)
  }
}
</script>

<template>
  <div>
    <!-- Preview Modal -->
    <GamePreviewModal
      :open="overlayOpen && mode === 'challenge' && !reviewMode"
      :gameName="gameName"
      :gameDescription="gameDescription"
      :mechanic="gameMetadata.mechanic"
      :videoUrl="gameMetadata.videoUrl"
      :tips="gameMetadata.tips"
      @close="overlayOpen = false"
      @start="startChallenge"
    />

    <!-- Game content slot -->
    <slot
      :mode="mode"
      :reviewMode="reviewMode"
      :timeLeft="timeLeft"
      :timeOver="timeOver"
      :earlyWin="earlyWin"
      :checkAvailability="checkAvailability"
    />

    <!-- Summary Popup (slot for customization) -->
    <slot
      name="summary"
      :show="showSummary"
      :corrects="0"
      :score="0"
      :maxStreak="0"
      :lifetimeMaxStreak="lifetimeMaxStreak"
      :levelBefore="levelBefore"
      :levelAfter="levelAfter"
      :xpBeforeTotal="xpBeforeTotal"
      :xpAfterTotal="xpAfterTotal"
      :beforePercent="beforePercent"
      :afterPercent="afterPercent"
      :progressShown="progressShown"
      :xpToNextAfter="xpToNextAfter"
      :winThreshold="winThreshold"
      :onClose="() => showSummary = false"
    />
  </div>
</template>
