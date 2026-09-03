/**
 * ÍCONOS DE LOGROS — mapeo code → glyph SVG (CosmeticIcon.vue) + tier visual.
 *
 * Arte EXCLUSIVO de logros (prefijo `ach_`): ninguno de estos glyphs se comparte
 * con la tienda de cosméticos (esa usa 'ball', 'trophy', 'crown', etc. como
 * style_key real y equipable). Un logro nunca debe verse igual a algo que el
 * usuario pueda comprar/equipar — por eso cada código tiene un ícono propio,
 * pensado a partir de su nombre/descripción real (no genérico ni reciclado).
 *
 * `rarity` acá es puramente visual (color del aro del medallón en CosmeticIcon),
 * no está atado a la rareza de cosméticos — es el equivalente al viejo sistema
 * bronce/plata/oro/diamante por puntos.
 */
export const ACHIEVEMENT_ICONS = {
  first_correct:      { icon: 'ach_target',          rarity: 'common' },
  first_win:          { icon: 'ach_flag',             rarity: 'common' },

  streak_3:           { icon: 'ach_gauge',            rarity: 'common' },
  streak_5:           { icon: 'ach_gauge',            rarity: 'rare' },
  streak_10:          { icon: 'ach_gauge',            rarity: 'epic' },
  streak_15:          { icon: 'ach_engine',           rarity: 'legendary' },

  daily_wins_5:       { icon: 'ach_five_stars',       rarity: 'rare' },
  daily_wins_10:      { icon: 'ach_ring_complete',    rarity: 'legendary' },
  daily_wins_all:     { icon: 'ach_clean_sweep',      rarity: 'legendary' },

  daily_streak_3:     { icon: 'calendar',             rarity: 'common' },
  daily_streak_5:     { icon: 'calendar',             rarity: 'rare' },
  daily_streak_7:     { icon: 'calendar',             rarity: 'rare' },
  daily_streak_14:    { icon: 'calendar',             rarity: 'epic' },
  daily_streak_30:    { icon: 'calendar',             rarity: 'legendary' },

  guess_master:       { icon: 'crystal_ball',         rarity: 'epic' },
  nationality_expert: { icon: 'ach_flags_fan',        rarity: 'epic' },
  position_guru:      { icon: 'tactics_board',        rarity: 'epic' },

  lucky_first:        { icon: 'ach_horseshoe',        rarity: 'rare' },
  comeback_king:      { icon: 'ach_comeback_arrow',   rarity: 'epic' },
  night_owl:          { icon: 'ach_crescent_moon',    rarity: 'rare' },

  perfectionist:      { icon: 'ach_perfect_seal',     rarity: 'epic' },
  hat_trick:          { icon: 'ach_triple_ball',      rarity: 'epic' },
  grand_slam:         { icon: 'ach_grand_rosette',    rarity: 'legendary' },
  centurion:          { icon: 'ach_centurion_helmet', rarity: 'legendary' },

  social_butterfly:   { icon: 'ach_network',          rarity: 'rare' },
  chat_master:        { icon: 'ach_chat_stack',       rarity: 'common' },

  streak_dual_100:    { icon: 'ach_dual_medal',       rarity: 'legendary' },
  xp_multi_5k_3:      { icon: 'ach_triple_gem',       rarity: 'legendary' },
  daily_super_5x3:    { icon: 'ach_royal_banner',     rarity: 'legendary' },
}

export function achievementIcon(code) {
  return ACHIEVEMENT_ICONS[code] || { icon: '', rarity: 'common' }
}
