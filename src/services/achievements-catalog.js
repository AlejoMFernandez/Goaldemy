// Central catalog for achievements codes and metadata (client-side reference)
// Server is the source of truth; seed SQL should mirror these codes.

export const ACHIEVEMENTS = {
  first_correct: {
    code: 'first_correct',
    name: 'Primer acierto',
    description: 'Consigue tu primer respuesta correcta',
    points: 10,
  },
  streak_3: {
    code: 'streak_3',
    name: 'Racha de 3',
    description: 'Acumula una racha de 3 aciertos seguidos',
    points: 20,
  },
  // Agrega aquí nuevos logros…
}

export const ALL_ACHIEVEMENT_CODES = Object.keys(ACHIEVEMENTS)
