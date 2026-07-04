// Generic scoring helpers to standardize across games
export function initScoring(pointsPerCorrect = 10) {
  // wrongStreak/maxWrongStreak habilitan logros que dependen de errores
  // (perfectionist = 0 errores, comeback_king = 3 errores seguidos y ganar).
  return { score: 0, attempts: 0, corrects: 0, pointsPerCorrect, wrongStreak: 0, maxWrongStreak: 0 }
}

export function onCorrect(scoring) {
  scoring.corrects += 1
  const ppc = Number(scoring.pointsPerCorrect || 10)
  scoring.score = scoring.corrects * ppc
  scoring.attempts += 1
  scoring.wrongStreak = 0
}

export function onIncorrect(scoring) {
  scoring.attempts += 1
  scoring.wrongStreak = (scoring.wrongStreak || 0) + 1
  scoring.maxWrongStreak = Math.max(scoring.maxWrongStreak || 0, scoring.wrongStreak)
}

export function resetRound(state) {
  state.answered = false
  state.selected = null
  state.feedback = null
  state.roundKey += 1
}

// Central scoring map per game to compare and tune values together
// Usage: import { GAME_SCORING } and read GAME_SCORING['who-is'].pointsPerCorrect, etc.
export const GAME_SCORING = {
  'who-is': { pointsPerCorrect: 100, summaryDelayMs: 3000 },
  'guess-player': { pointsPerCorrect: 10, summaryDelayMs: 1200 },
  'nationality': { pointsPerCorrect: 10, summaryDelayMs: 0 },
  'player-position': { pointsPerCorrect: 10, summaryDelayMs: 0 },
  'shirt-number': { pointsPerCorrect: 10, summaryDelayMs: 0 },
  'value-order': { pointsPerCorrect: 20, summaryDelayMs: 1200 },
  'age-order': { pointsPerCorrect: 20, summaryDelayMs: 1200 },
  'height-order': { pointsPerCorrect: 20, summaryDelayMs: 1200 },
  'football-wordle': { pointsPerCorrect: 150, summaryDelayMs: 2000 },
  'higher-or-lower': { pointsPerCorrect: 20, summaryDelayMs: 1200 },
  'connections': { pointsPerCorrect: 50, summaryDelayMs: 1500 },
  'football-grid': { pointsPerCorrect: 30, summaryDelayMs: 1500 },
  'stat-challenge': { pointsPerCorrect: 15, summaryDelayMs: 0 },
}
