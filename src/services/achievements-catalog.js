// Central catalog for achievements codes and metadata (client-side reference)
// Server is the source of truth; seed SQL should mirror these codes.

export const ACHIEVEMENTS = {
  // Básicos
  first_correct: { code: 'first_correct', name: 'Primer acierto', description: 'Consigue tu primer respuesta correcta', points: 10, difficulty: 'fácil' },
  streak_3: { code: 'streak_3', name: 'Racha de 3', description: 'Acumula una racha de 3 aciertos seguidos', points: 20, difficulty: 'fácil' },
  streak_5: { code: 'streak_5', name: 'Racha de 5', description: 'Acumula una racha de 5 aciertos seguidos', points: 30, difficulty: 'media' },
  streak_10: { code: 'streak_10', name: 'Racha de 10', description: 'Acumula una racha de 10 aciertos seguidos', points: 50, difficulty: 'difícil' },
  ten_correct: { code: 'ten_correct', name: 'Diez aciertos', description: 'Consigue 10 respuestas correctas', points: 25, difficulty: 'fácil' },
  xp_100: { code: 'xp_100', name: '100 XP', description: 'Alcanza 100 puntos de experiencia', points: 15, difficulty: 'fácil' },
  xp_1000: { code: 'xp_1000', name: '1000 XP', description: 'Alcanza 1000 puntos de experiencia', points: 80, difficulty: 'difícil' },

  // Diarios: cantidad de juegos ganados en el día
  daily_wins_3: { code: 'daily_wins_3', name: 'Triplete diario', description: 'Ganá 3 juegos del día', points: 20, difficulty: 'fácil' },
  daily_wins_5: { code: 'daily_wins_5', name: 'Quinteto diario', description: 'Ganá 5 juegos del día', points: 35, difficulty: 'media' },
  daily_wins_10: { code: 'daily_wins_10', name: 'Diez del tirón', description: 'Ganá 10 juegos del día', points: 60, difficulty: 'difícil' },
  daily_wins_all: { code: 'daily_wins_all', name: 'Pleno diario', description: 'Ganá todos los juegos del día', points: 80, difficulty: 'épico' },

  // Rachas por día en un juego (global, se guarda meta.game)
  daily_streak_3: { code: 'daily_streak_3', name: 'Racha diaria ×3', description: 'Ganá el mismo juego 3 días seguidos', points: 20, difficulty: 'fácil' },
  daily_streak_5: { code: 'daily_streak_5', name: 'Racha diaria ×5', description: 'Ganá el mismo juego 5 días seguidos', points: 35, difficulty: 'media' },
  daily_streak_10: { code: 'daily_streak_10', name: 'Racha diaria ×10', description: 'Ganá el mismo juego 10 días seguidos', points: 80, difficulty: 'difícil' },

  // Superlogros
  streak_dual_100: { code: 'streak_dual_100', name: 'Doble Centurión', description: 'Racha de 100 en 2 juegos', points: 500, difficulty: 'épico' },
  xp_multi_5k_3: { code: 'xp_multi_5k_3', name: 'Tricampeón de XP', description: '5000 XP en 3 juegos', points: 500, difficulty: 'épico' },
  daily_super_5x3: { code: 'daily_super_5x3', name: 'Tri-rey semanal', description: '5 días seguidos en 3 juegos distintos', points: 120, difficulty: 'épico' },
}

export const ALL_ACHIEVEMENT_CODES = Object.keys(ACHIEVEMENTS)
