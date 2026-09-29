/**
 * TEST de los logros nuevos (achievements-new-1) — sin red, sin Supabase, sin navegador.
 *
 *   node scripts/test-achievement-rules.mjs
 *
 * 1) Consistencia: supabase/achievements-new-1.sql ↔ achievement-icons.js ↔ AchievementTile.vue
 *    (mismos códigos, XP = rareza, un glyph `ach_*` propio por logro, sin repetir cosméticos).
 * 2) Reglas: cada logro con caso positivo, borde, negativo y la guarda de "primera partida".
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateNewAchievements, normalizeSessionRow, longestDayRun, artDay,
  NEW_ACHIEVEMENT_CODES, XP_BY_RARITY, CLOCK_GAMES, MIN_PRIOR_GAMES,
} from '../src/services/achievement-rules.js'
import { ACHIEVEMENT_ICONS } from '../src/services/achievement-icons.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(path.join(root, p), 'utf8')

let passed = 0
const failures = []
function test(name, fn) {
  try { fn(); passed++ } catch (e) { failures.push({ name, e }) }
}

// ─────────────────────────────────────────────────────────────
// 1) CONSISTENCIA
// ─────────────────────────────────────────────────────────────
const sql = read('supabase/achievements-new-1.sql')
const sqlRows = [...sql.matchAll(/^\s*\('([a-z_]+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(\d+),\s*(true|false)\)/gm)]
  .map(m => ({ code: m[1], name: m[2], description: m[3], points: Number(m[4]), active: m[5] === 'true' }))

test('SQL: 23 logros, sin repetir, todos activos', () => {
  assert.equal(sqlRows.length, 23)
  assert.equal(new Set(sqlRows.map(r => r.code)).size, 23)
  assert.ok(sqlRows.every(r => r.active && r.name && r.description))
})
test('SQL ↔ reglas: mismos códigos', () => {
  assert.deepEqual([...sqlRows.map(r => r.code)].sort(), [...NEW_ACHIEVEMENT_CODES].sort())
})
test('SQL ↔ íconos: XP = rareza (15/35/80/180)', () => {
  assert.deepEqual(XP_BY_RARITY, { common: 15, rare: 35, epic: 80, legendary: 180 })
  for (const r of sqlRows) {
    const icon = ACHIEVEMENT_ICONS[r.code]
    assert.ok(icon, `${r.code}: falta en achievement-icons.js`)
    assert.equal(r.points, XP_BY_RARITY[icon.rarity], `${r.code}: ${r.points} XP pero es ${icon.rarity}`)
  }
})
test('Rarezas pedidas', () => {
  const want = {
    common: ['salvado_escudo'],
    rare: ['tiempo_descuento', 'ni_la_mitad', 'scout', 'trotamundos', 'coleccionista'],
    epic: ['relampago', 'ascenso', 'ojo_halcon', 'cadena_oro', 'once_gala', 'todoterreno', 'semana_primera', 'relojero', 'especialista', 'invicto', 'sin_red', 'fuego_azul', 'cazador_cracks'],
    legendary: ['doble_jornada', 'invicto_temporada', 'jornada_primera', 'enciclopedia'],
  }
  for (const [rarity, codes] of Object.entries(want)) {
    for (const c of codes) assert.equal(ACHIEVEMENT_ICONS[c].rarity, rarity, c)
  }
  assert.equal(Object.values(want).flat().length, 23)
})
test('Íconos: glyph ach_* propio, único, dibujado en AchievementTile, sin repetir cosméticos', () => {
  const tile = read('src/components/rewards/AchievementTile.vue')
  const cosmeticKeys = new Set([...read('src/components/rewards/CosmeticIcon.vue').match(/const KNOWN = new Set\(\[([^\]]+)\]/)[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]))
  const newGlyphs = NEW_ACHIEVEMENT_CODES.map(c => ACHIEVEMENT_ICONS[c].icon)
  assert.equal(new Set(newGlyphs).size, 23, 'glyphs repetidos entre los nuevos')
  const oldGlyphs = new Set(Object.entries(ACHIEVEMENT_ICONS).filter(([c]) => !NEW_ACHIEVEMENT_CODES.includes(c)).map(([, v]) => v.icon))
  for (const g of newGlyphs) {
    assert.ok(g.startsWith('ach_'), `${g} no tiene prefijo ach_`)
    assert.ok(!cosmeticKeys.has(g), `${g} es un cosmético`)
    assert.ok(!oldGlyphs.has(g), `${g} repite el de otro logro`)
    assert.ok(tile.includes(`iconKey === '${g}'`), `${g} no está dibujado en AchievementTile.vue`)
  }
})
test('CLOCK_GAMES = juegos GAME_TYPES.TIMED de games.js', () => {
  const games = read('src/services/games.js')
  const timed = [...games.matchAll(/'([a-z-]+)': \{\s*type: GAME_TYPES\.TIMED/g)].map(m => m[1])
  assert.deepEqual([...timed].sort(), [...CLOCK_GAMES].sort())
})
test('Cada juego contrarreloj guarda timedStats() y todos guardan dificultad', () => {
  for (const g of ['GuessPlayer', 'NationalityGame', 'PlayerPosition', 'ShirtNumber', 'StatChallenge']) {
    assert.ok(read(`src/pages/games/${g}.vue`).includes('...this.timedStats()'), g)
  }
  const games = ['AgeOrder', 'Connections', 'FootballGrid', 'FootballWordle', 'GuessPlayer', 'HeightOrder', 'HigherOrLower', 'NationalityGame', 'OnceIdeal', 'PlayerPosition', 'ShirtNumber', 'StatChallenge', 'ValueOrder', 'WhoIs']
  for (const g of games) assert.ok(/startChallengeSession\([^)]*\{ difficulty: this\.selectedDifficulty \}\)/.test(read(`src/pages/games/${g}.vue`)), `${g}: no guarda difficulty`)
})

// ─────────────────────────────────────────────────────────────
// 2) REGLAS
// ─────────────────────────────────────────────────────────────
const ALL_GAMES = ['guess-player', 'nationality', 'player-position', 'who-is', 'value-order', 'age-order', 'height-order', 'shirt-number', 'once-ideal', 'football-wordle', 'higher-or-lower', 'connections', 'football-grid', 'stat-challenge']
const slugById = new Proxy({}, { get: (_, k) => String(k) }) // game_id === slug en los tests
const T0 = Date.parse('2026-03-02T15:00:00Z') // lunes 12:00 ART
const DAY = 86400000
let seq = 0

/** Fila cruda como la devuelve fetchFinishedChallengeSessions(). */
function row({ slug = 'guess-player', day = 0, hourArt = 12, result = 'win', ...m } = {}) {
  seq += 1
  const started = T0 + day * DAY + (hourArt - 12) * 3600000 + seq * 1000
  return {
    id: `s${seq}`, game_id: slug,
    started_at: new Date(started).toISOString(), ended_at: new Date(started + 45000).toISOString(),
    result, ...m,
  }
}
/** Sesión de contrarreloj ganada con ¡Basta!, con datos completos. */
const clockWin = (o = {}) => row({ slug: 'guess-player', difficulty: 'normal', corrects: 10, max_streak: 10, base_seconds: 45, seconds_used: 30, seconds_left: 15, basta: true, powerups: 0, shield_saves: 0, ...o })
/** Una partida cualquiera de relleno para que la cuenta no sea "nueva". */
const filler = () => row({ slug: 'who-is', day: -30, result: 'loss' })

function run(rows, { current = 'last', active = ALL_GAMES, packsOpened = null } = {}) {
  const sessions = rows.map(r => normalizeSessionRow(r, slugById))
  const cur = current === 'last' ? [...sessions].sort((a, b) => b.endedAt - a.endedAt)[0]?.id : current
  return evaluateNewAchievements({ sessions, activeSlugs: active, currentId: cur, packsOpened }).map(h => h.code)
}
const has = (rows, code, opts) => run(rows, opts).includes(code)
const seen = new Set()
function positive(rows, code, opts) {
  const got = run(rows, opts)
  assert.ok(got.includes(code), `${code} debería desbloquearse (salió: ${got.join(', ') || 'nada'})`)
  seen.add(code)
}
function negative(rows, code, opts) {
  assert.ok(!has(rows, code, opts), `${code} NO debería desbloquearse`)
}

// ── Guarda de primera partida ──
test('Primera partida de una cuenta nueva: no se desbloquea NADA (aunque el dato sea perfecto)', () => {
  assert.equal(MIN_PRIOR_GAMES, 1)
  const best = [
    clockWin({ seconds_left: 2, seconds_used: 10, base_seconds: 30, difficulty: 'hard', shield_saves: 1 }),
    row({ slug: 'football-wordle', guess_count: 1, difficulty: 'hard' }),
    row({ slug: 'higher-or-lower', difficulty: 'hard', max_streak: 16 }),
    row({ slug: 'stat-challenge', max_streak: 10, corrects: 5000, seconds_left: 5, basta: true, base_seconds: 45, seconds_used: 5 }),
    row({ slug: 'once-ideal', seconds_left: 170 }),
  ]
  for (const r of best) assert.deepEqual(run([r]), [], r.game_id)
})
test('Segunda partida: ya puede desbloquear los de una partida', () => {
  positive([filler(), clockWin({ seconds_left: 3 })], 'tiempo_descuento')
})
test('La guarda mira la posición de la partida evaluada (la primera de la cuenta nunca cuenta)', () => {
  const first = clockWin({ seconds_left: 1 })
  const second = row({ slug: 'who-is', day: 5, result: 'loss' }) // posterior: `first` es la primera de la cuenta
  assert.ok(!run([first, second], { current: first.id }).includes('tiempo_descuento'))
})

// ── Tiempo y ayudas ──
test('tiempo_descuento', () => {
  positive([filler(), clockWin({ seconds_left: 3 })], 'tiempo_descuento')
  positive([filler(), clockWin({ seconds_left: 1 })], 'tiempo_descuento')
  negative([filler(), clockWin({ seconds_left: 4 })], 'tiempo_descuento')
  negative([filler(), clockWin({ seconds_left: 2, result: 'loss' })], 'tiempo_descuento')
  negative([filler(), row({ slug: 'once-ideal', seconds_left: 2, basta: true })], 'tiempo_descuento') // no es contrarreloj
})
test('ni_la_mitad (menos de la mitad del reloj elegido)', () => {
  positive([filler(), clockWin({ base_seconds: 45, seconds_used: 22, seconds_left: 23 })], 'ni_la_mitad')
  negative([filler(), clockWin({ base_seconds: 45, seconds_used: 23, seconds_left: 22 })], 'ni_la_mitad') // 23 ≥ 22,5
  negative([filler(), clockWin({ base_seconds: 30, seconds_used: 15, seconds_left: 15 })], 'ni_la_mitad') // justo la mitad no es "menos"
  positive([filler(), clockWin({ base_seconds: 30, seconds_used: 14, seconds_left: 16 })], 'ni_la_mitad')
})
test('ni_la_mitad: el +15 s NO facilita (mide contra el reloj elegido, no el ampliado)', () => {
  // reloj 45 + 15 de ayuda: usó 30 s. Contra 60 sería "la mitad"; contra 45 no llega.
  negative([filler(), clockWin({ base_seconds: 45, seconds_used: 30, seconds_left: 30, powerups: 1 })], 'ni_la_mitad')
})
test('relampago (Difícil y 40 % o más de sobra)', () => {
  positive([filler(), clockWin({ difficulty: 'hard', base_seconds: 30, seconds_used: 18, seconds_left: 12 })], 'relampago')
  negative([filler(), clockWin({ difficulty: 'hard', base_seconds: 30, seconds_used: 19, seconds_left: 11 })], 'relampago')
  negative([filler(), clockWin({ difficulty: 'normal', base_seconds: 30, seconds_used: 10, seconds_left: 20 })], 'relampago')
  negative([filler(), clockWin({ difficulty: null, base_seconds: 30, seconds_used: 10, seconds_left: 20 })], 'relampago') // sesión vieja sin dato
})
test('salvado_escudo (el escudo salva y ganás)', () => {
  positive([filler(), clockWin({ shield_saves: 1 })], 'salvado_escudo')
  positive([filler(), clockWin({ shield_saves: 3 })], 'salvado_escudo')
  negative([filler(), clockWin({ shield_saves: 0 })], 'salvado_escudo')
  negative([filler(), clockWin({ shield_saves: 1, result: 'loss' })], 'salvado_escudo')
})
test('ascenso (ganar en Difícil todos los contrarreloj, en cualquier momento)', () => {
  const hardWins = CLOCK_GAMES.map((slug, i) => row({ slug, day: -i * 3, difficulty: 'hard' }))
  positive([filler(), ...hardWins, row({ slug: 'who-is', result: 'loss' })], 'ascenso')
  negative([filler(), ...hardWins.slice(1)], 'ascenso')
  negative([filler(), ...hardWins.map(r => ({ ...r, difficulty: 'normal' }))], 'ascenso')
})

// ── Por juego ──
test('ojo_halcon (Adiviná el Crack en ≤ 3 intentos)', () => {
  positive([filler(), row({ slug: 'football-wordle', guess_count: 3 })], 'ojo_halcon')
  positive([filler(), row({ slug: 'football-wordle', guess_count: 1 })], 'ojo_halcon')
  negative([filler(), row({ slug: 'football-wordle', guess_count: 4 })], 'ojo_halcon')
  negative([filler(), row({ slug: 'football-wordle', guess_count: 2, result: 'loss' })], 'ojo_halcon')
})
test('cadena_oro (Mayor o Menor: cadena completa)', () => {
  positive([filler(), row({ slug: 'higher-or-lower', max_streak: 12 })], 'cadena_oro')
  negative([filler(), row({ slug: 'higher-or-lower', result: 'loss', max_streak: 11 })], 'cadena_oro')
})
test('scout (Duelo de Stats, 10 seguidos sin error)', () => {
  positive([filler(), row({ slug: 'stat-challenge', max_streak: 10, shield_saves: 0 })], 'scout')
  negative([filler(), row({ slug: 'stat-challenge', max_streak: 9 })], 'scout')
  negative([filler(), row({ slug: 'stat-challenge', max_streak: 10, shield_saves: 1 })], 'scout') // el escudo tapó un error
  negative([filler(), row({ slug: 'guess-player', max_streak: 10 })], 'scout')
})
test('once_gala (Once Ideal con más de 1 minuto de sobra)', () => {
  positive([filler(), row({ slug: 'once-ideal', seconds_left: 61 })], 'once_gala')
  negative([filler(), row({ slug: 'once-ideal', seconds_left: 60 })], 'once_gala')
  negative([filler(), row({ slug: 'once-ideal', seconds_left: 120, result: 'loss' })], 'once_gala')
  negative([filler(), row({ slug: 'once-ideal' })], 'once_gala') // sin dato de segundos
})

// ── Colección ──
test('trotamundos (7 juegos distintos ganados)', () => {
  const wins = (n) => ALL_GAMES.slice(0, n).map((slug, i) => row({ slug, day: -i }))
  positive([filler(), ...wins(7)], 'trotamundos')
  negative([filler(), ...wins(6)], 'trotamundos')
  negative([filler(), ...wins(6), ...wins(6)], 'trotamundos') // repetir los mismos no suma
  negative([filler(), ...wins(6), row({ slug: 'connections', result: 'loss' })], 'trotamundos')
})
test('todoterreno (ganar todos los juegos activos)', () => {
  const all = ALL_GAMES.map((slug, i) => row({ slug, day: -i * 2 }))
  positive([filler(), ...all], 'todoterreno')
  negative([filler(), ...all.slice(1)], 'todoterreno')
  positive([filler(), ...all.slice(1)], 'todoterreno', { active: ALL_GAMES.slice(1) }) // dinámico con los activos
})
test('coleccionista (7 sobres del día) — sin depender de partidas', () => {
  positive([], 'coleccionista', { packsOpened: 7, current: null })
  negative([], 'coleccionista', { packsOpened: 6, current: null })
  negative([filler(), filler()], 'coleccionista') // packsOpened no informado
})

// ── Varios días ──
test('semana_primera (Difícil, 7 días seguidos)', () => {
  const week = (n, gap = null) => Array.from({ length: n }, (_, i) => i).filter(i => i !== gap).map(i => row({ slug: ALL_GAMES[i % 5], day: -i, difficulty: 'hard' }))
  positive([filler(), ...week(7)], 'semana_primera')
  negative([filler(), ...week(6)], 'semana_primera')
  negative([filler(), ...week(8, 3)], 'semana_primera') // un día salteado corta
  negative([filler(), ...week(7).map(r => ({ ...r, difficulty: 'normal' }))], 'semana_primera')
})
test('relojero (¡Basta! 3 días seguidos)', () => {
  positive([filler(), clockWin({ day: 0 }), clockWin({ day: -1 }), clockWin({ day: -2, slug: 'nationality' })], 'relojero')
  negative([filler(), clockWin({ day: 0 }), clockWin({ day: -1 })], 'relojero')
  negative([filler(), clockWin({ day: 0 }), clockWin({ day: -1 }), clockWin({ day: -3 })], 'relojero')
  negative([filler(), clockWin({ day: 0 }), clockWin({ day: -1 }), clockWin({ day: -2, basta: false, corrects: 4, result: 'loss' })], 'relojero')
})
test('especialista (mismo juego 14 días seguidos)', () => {
  const streak = (n, slug = 'age-order') => Array.from({ length: n }, (_, i) => row({ slug, day: -i }))
  positive([filler(), ...streak(14)], 'especialista')
  negative([filler(), ...streak(13)], 'especialista')
  negative([filler(), ...streak(14).map((r, i) => (i % 2 ? { ...r, game_id: 'value-order' } : r))], 'especialista') // alternar juegos no vale
})
test('doble_jornada (todos los juegos del día, 2 días seguidos)', () => {
  const dayOf = (d) => ALL_GAMES.map(slug => row({ slug, day: d }))
  positive([filler(), ...dayOf(0), ...dayOf(-1)], 'doble_jornada')
  negative([filler(), ...dayOf(0), ...dayOf(-2)], 'doble_jornada')
  negative([filler(), ...dayOf(0), ...dayOf(-1).slice(1)], 'doble_jornada') // falta un juego el día anterior
})

// ── Sostener el nivel ──
test('invicto / invicto_temporada (victorias seguidas sin derrota, entre todos los juegos)', () => {
  const wins = (n) => Array.from({ length: n }, (_, i) => row({ slug: ALL_GAMES[i % 14], day: -(n - i) }))
  positive([filler(), ...wins(10)], 'invicto')
  negative([filler(), ...wins(9)], 'invicto')
  negative([filler(), ...wins(10)], 'invicto_temporada')
  const withLoss = wins(10)
  withLoss.splice(4, 1, row({ slug: 'who-is', day: -5, result: 'loss' })) // una derrota a mitad
  negative([filler(), ...withLoss], 'invicto')
  positive([filler(), ...wins(30)], 'invicto_temporada')
  negative([filler(), ...wins(29)], 'invicto_temporada')
})
test('invicto: la derrota corta pero se puede volver a empezar', () => {
  const rows = [filler(), ...Array.from({ length: 6 }, (_, i) => row({ day: -30 + i })), row({ result: 'loss', day: -20 }), ...Array.from({ length: 10 }, (_, i) => row({ day: -10 + i }))]
  positive(rows, 'invicto')
})
test('sin_red (5 contrarreloj seguidos en Difícil sin ayudas)', () => {
  const hw = (i, o = {}) => clockWin({ difficulty: 'hard', day: -10 + i, ...o })
  positive([filler(), ...[0, 1, 2, 3, 4].map(i => hw(i))], 'sin_red')
  negative([filler(), ...[0, 1, 2, 3].map(i => hw(i))], 'sin_red')
  negative([filler(), hw(0), hw(1), hw(2, { powerups: 1 }), hw(3), hw(4)], 'sin_red') // una ayuda corta
  negative([filler(), hw(0), hw(1), hw(2, { difficulty: 'normal' }), hw(3), hw(4)], 'sin_red')
  negative([filler(), hw(0), hw(1), hw(2, { powerups: null }), hw(3), hw(4)], 'sin_red') // sin dato ≠ sin ayudas
  // una partida de OTRO tipo (Once Ideal) en el medio no corta la racha de contrarreloj
  positive([filler(), hw(0), hw(1), row({ slug: 'once-ideal', day: -8 }), hw(2), hw(3), hw(4)], 'sin_red')
  // una derrota de contrarreloj sí corta
  negative([filler(), hw(0), hw(1), hw(2, { result: 'loss' }), hw(3), hw(4)], 'sin_red')
})
test('jornada_primera (todos los juegos del día en Difícil)', () => {
  const hardDay = (d, skip = -1) => ALL_GAMES.filter((_, i) => i !== skip).map(slug => row({ slug, day: d, difficulty: 'hard' }))
  positive([filler(), ...hardDay(0)], 'jornada_primera')
  negative([filler(), ...hardDay(0, 5)], 'jornada_primera')
  negative([filler(), ...ALL_GAMES.map(slug => row({ slug, difficulty: 'normal' }))], 'jornada_primera')
  // mezclar días no vale: 7 juegos hoy + 7 ayer
  negative([filler(), ...ALL_GAMES.slice(0, 7).map(slug => row({ slug, difficulty: 'hard' })), ...ALL_GAMES.slice(7).map(slug => row({ slug, day: -1, difficulty: 'hard' }))], 'jornada_primera')
})

// ── Hazañas repetidas ──
test('fuego_azul (llama azul en 3 juegos distintos el mismo día)', () => {
  const blue = (slug, d = 0, o = {}) => row({ slug, day: d, max_streak: 10, ...o })
  positive([filler(), blue('guess-player'), blue('nationality'), blue('stat-challenge')], 'fuego_azul')
  positive([filler(), blue('guess-player'), blue('nationality'), blue('higher-or-lower', 0, { result: 'loss', max_streak: 11 })], 'fuego_azul') // no exige ganar
  negative([filler(), blue('guess-player'), blue('nationality')], 'fuego_azul')
  negative([filler(), blue('guess-player'), blue('guess-player', 0, { result: 'win' }), blue('nationality')], 'fuego_azul') // mismo juego repetido no suma
  negative([filler(), blue('guess-player', 0), blue('nationality', -1), blue('stat-challenge', -2)], 'fuego_azul') // días distintos
  negative([filler(), blue('guess-player'), blue('nationality'), blue('stat-challenge', 0, { max_streak: 9 })], 'fuego_azul')
})
test('cazador_cracks (≤ 3 intentos en 5 días distintos)', () => {
  const hawk = (d, g = 2) => row({ slug: 'football-wordle', day: d, guess_count: g })
  positive([filler(), hawk(0), hawk(-1), hawk(-2), hawk(-5), hawk(-9)], 'cazador_cracks') // no hace falta que sean seguidos
  negative([filler(), hawk(0), hawk(-1), hawk(-2), hawk(-5)], 'cazador_cracks')
  negative([filler(), hawk(0), hawk(0), hawk(-1), hawk(-2), hawk(-5)], 'cazador_cracks') // 2 el mismo día = 1 día
  negative([filler(), hawk(0), hawk(-1), hawk(-2), hawk(-5), hawk(-9, 4)], 'cazador_cracks')
})
test('enciclopedia (1000 respuestas correctas en total)', () => {
  const bulk = (n) => Array.from({ length: n / 10 }, (_, i) => row({ slug: 'nationality', day: -i, corrects: 10 }))
  positive([filler(), ...bulk(1000)], 'enciclopedia')
  negative([filler(), ...bulk(990)], 'enciclopedia')
  positive([filler(), ...bulk(990), row({ result: 'loss', corrects: 10 })], 'enciclopedia') // las derrotas también suman aciertos
})

// ── Utilidades ──
test('Días en horario argentino (UTC-3): 02:30 UTC pertenece al día anterior', () => {
  assert.equal(artDay(Date.parse('2026-03-05T02:30:00Z')), '2026-03-04')
  assert.equal(artDay(Date.parse('2026-03-05T03:00:00Z')), '2026-03-05')
  const late = row({ day: 0, hourArt: 23 })
  const next = row({ day: 1, hourArt: 1 })
  assert.equal(longestDayRun([normalizeSessionRow(late, slugById).day, normalizeSessionRow(next, slugById).day]), 2)
})
test('longestDayRun: fin de mes y saltos', () => {
  assert.equal(longestDayRun(['2026-02-27', '2026-02-28', '2026-03-01']), 3)
  assert.equal(longestDayRun(['2026-03-01', '2026-03-03']), 1)
  assert.equal(longestDayRun([]), 0)
})
test('Sesiones viejas (sin datos nuevos) no rompen nada ni desbloquean lo que no pueden probar', () => {
  const old = Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, game_id: 'guess-player', started_at: new Date(T0 - i * DAY).toISOString(), ended_at: new Date(T0 - i * DAY + 1000).toISOString(), result: 'win' }))
  const got = run([filler(), ...old])
  for (const c of ['relampago', 'tiempo_descuento', 'ni_la_mitad', 'salvado_escudo', 'sin_red', 'semana_primera', 'jornada_primera', 'ascenso']) assert.ok(!got.includes(c), c)
})
test('Cobertura: los 23 logros tienen al menos un caso que los desbloquea', () => {
  const missing = NEW_ACHIEVEMENT_CODES.filter(c => !seen.has(c))
  assert.deepEqual(missing, [])
})

// ─────────────────────────────────────────────────────────────
for (const { name, e } of failures) console.error(`✗ ${name}\n    ${e.message.split('\n').join('\n    ')}`)
console.log(`\n${failures.length ? '✗' : '✓'} ${passed} ok, ${failures.length} con error`)
process.exit(failures.length ? 1 : 0)
