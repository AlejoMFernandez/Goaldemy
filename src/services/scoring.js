// Generic scoring helpers to standardize across games
export function initScoring() {
  return { score: 0, attempts: 0, corrects: 0 }
}

export function onCorrect(scoring) {
  scoring.corrects += 1
  scoring.score = scoring.corrects * 10
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
