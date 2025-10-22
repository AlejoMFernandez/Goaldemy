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
