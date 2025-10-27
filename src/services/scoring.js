// Generic scoring helpers to standardize across games
export function initScoring(pointsPerCorrect = 10) {
  return { score: 0, attempts: 0, corrects: 0, pointsPerCorrect }
}

export function onCorrect(scoring) {
  scoring.corrects += 1
  const ppc = Number(scoring.pointsPerCorrect || 10)
  scoring.score = scoring.corrects * ppc
  scoring.attempts += 1
}

export function onIncorrect(scoring) {
  scoring.attempts += 1
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
  'who-is': { pointsPerCorrect: 50, summaryDelayMs: 3000 },
  'guess-player': { pointsPerCorrect: 10, summaryDelayMs: 1200 },
  'nationality': { pointsPerCorrect: 10, summaryDelayMs: 0 },
  'player-position': { pointsPerCorrect: 10, summaryDelayMs: 0 },
  'shirt-number': { pointsPerCorrect: 10, summaryDelayMs: 0 },
  'value-order': { pointsPerCorrect: 10, summaryDelayMs: 1200 },
  'age-order': { pointsPerCorrect: 10, summaryDelayMs: 1200 },
  'height-order': { pointsPerCorrect: 10, summaryDelayMs: 1200 },
}
