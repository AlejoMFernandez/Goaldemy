/**
 * MODO CARRERA — simulador de decisiones estilo Copero
 *
 * El fenómeno viral del momento (Copero) no gana por ser un juego de habilidad:
 * gana por fricción cero, sesión de ~2 minutos, y un resultado final que da
 * orgullo o vergüenza compartible ("¿podés superar mi carrera?"). Este motor
 * reproduce ese mecanismo pero corriendo DENTRO del ecosistema de Goaldemy:
 * usa la base real de equipos (players.js), entrega XP/Fichas al terminar,
 * y el resultado se comparte con el mismo motor viral que el Reto del día.
 *
 * Es 100% client-side (como Copero): no hay "trampa" posible que importe,
 * porque la recompensa final se valida server-side por RANGO DE NOTA, no por
 * los números crudos que manda el cliente (ver career-claim.sql).
 */
import { getAllTeams } from './players'
import { shareBaseUrl } from './share'
import { todayKey } from './daily-reto'

export const CAREER_SEASONS = 12
export const START_AGE = 17

const POSITIONS = [
  { value: 'GK', label: 'Arquero' },
  { value: 'DF', label: 'Defensor' },
  { value: 'MF', label: 'Mediocampista' },
  { value: 'FW', label: 'Delantero' },
]
export function getPositions() { return POSITIONS }

// Naciones curadas (fútbol-relevantes) para no arrastrar el selector completo de países.
export const CAREER_NATIONS = [
  { code: 'ar', name: 'Argentina' }, { code: 'br', name: 'Brasil' }, { code: 'es', name: 'España' },
  { code: 'fr', name: 'Francia' }, { code: 'gb-eng', name: 'Inglaterra' }, { code: 'de', name: 'Alemania' },
  { code: 'it', name: 'Italia' }, { code: 'pt', name: 'Portugal' }, { code: 'uy', name: 'Uruguay' },
  { code: 'nl', name: 'Países Bajos' }, { code: 'be', name: 'Bélgica' }, { code: 'hr', name: 'Croacia' },
  { code: 'co', name: 'Colombia' }, { code: 'mx', name: 'México' }, { code: 'us', name: 'Estados Unidos' },
]

const BIG_CLUB_NAMES = [
  'Real Madrid', 'Barcelona', 'Manchester City', 'Manchester United', 'Liverpool', 'Chelsea', 'Arsenal',
  'Bayern Munich', 'Paris Saint-Germain', 'Juventus', 'Inter', 'Milan', 'River Plate', 'Boca Juniors', 'Flamengo',
]

const TROPHY_NAMES = ['la Liga local', 'la Copa nacional', 'la Copa Continental', 'la Supercopa']

// ── Aleatoriedad ──────────────────────────────────────────────────────────
function rand() { return Math.random() }
function pick(arr) { return arr[Math.floor(rand() * arr.length)] }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)) }

let _bigClubsCache = null
function bigClubs() {
  if (_bigClubsCache) return _bigClubsCache
  const all = getAllTeams()
  _bigClubsCache = BIG_CLUB_NAMES.map(n => all.find(t => t.name === n)).filter(Boolean)
  return _bigClubsCache
}
function randomSmallClub(excludeNames = []) {
  const all = getAllTeams()
  const bigNames = new Set(BIG_CLUB_NAMES)
  const pool = all.filter(t => !bigNames.has(t.name) && !excludeNames.includes(t.name))
  return pick(pool.length ? pool : all)
}
function randomBigClub(excludeNames = []) {
  const pool = bigClubs().filter(t => !excludeNames.includes(t.name))
  return pick(pool.length ? pool : bigClubs())
}

// ── Banco de decisiones por posición (se recicla si la carrera dura más que el pool) ──
const DECISIONS = {
  FW: [
    { prompt: 'Arranca la pretemporada. El cuerpo técnico te pregunta en qué querés enfocarte.',
      a: { label: 'Perfeccionar la definición', rating: 2, goals: 3, assists: 0, fame: 1 },
      b: { label: 'Mejorar el último pase', rating: 1, goals: 0, assists: 3, fame: 1 } },
    { prompt: 'Te ofrecen el dorsal 9, pero es el número del ídolo histórico del club.',
      a: { label: 'Pedirlo con humildad', rating: 0, goals: 1, assists: 0, fame: 3 },
      b: { label: 'Usar otro número por ahora', rating: 1, goals: 0, assists: 0, fame: 0 } },
    { prompt: 'Previa de un clásico. ¿Cómo te preparás?',
      a: { label: 'Estudiar al rival a fondo', rating: 3, goals: 1, assists: 1, fame: 0 },
      b: { label: 'Confiar en tu instinto', rating: 0, goals: 4, assists: 0, fame: 2 } },
    { prompt: 'Un compañero te pide que le cedas un penal decisivo.',
      a: { label: 'Cedérselo', rating: 1, goals: -1, assists: 1, fame: 2, morale: 3 },
      b: { label: 'Patearlo vos', rating: 1, goals: 3, assists: 0, fame: 1, morale: -1 } },
    { prompt: 'Venís de una racha sin convertir. La prensa empieza a pedir tu banco.',
      a: { label: 'Trabajar en silencio', rating: 2, goals: 2, assists: 0, fame: 0 },
      b: { label: 'Responder en conferencia', rating: -1, goals: 1, assists: 0, fame: 3 } },
    { prompt: 'Te llega una propuesta de patrocinio personal que puede tensar el vestuario.',
      a: { label: 'Aceptar', rating: 0, goals: 0, assists: 0, fame: 4, morale: -1 },
      b: { label: 'Rechazarla', rating: 1, goals: 1, assists: 1, fame: 0, morale: 2 } },
  ],
  MF: [
    { prompt: 'El técnico te da a elegir tu rol en la mitad de cancha esta temporada.',
      a: { label: 'Motor de juego (pases)', rating: 2, goals: 0, assists: 3, fame: 1 },
      b: { label: 'Llegador (goles)', rating: 1, goals: 3, assists: 0, fame: 1 } },
    { prompt: 'El capitán se lesiona. El plantel discute quién debe llevar la cinta.',
      a: { label: 'Levantar la mano', rating: 1, goals: 0, assists: 1, fame: 3, morale: 2 },
      b: { label: 'Dejarle el lugar a otro', rating: 0, goals: 0, assists: 1, fame: 0, morale: 1 } },
    { prompt: 'Partido a préstamo: podés forzar una jugada personal o abrir el juego.',
      a: { label: 'Abrir el juego', rating: 2, goals: 0, assists: 3, fame: 0 },
      b: { label: 'Forzar la jugada', rating: 0, goals: 2, assists: 0, fame: 1 } },
    { prompt: 'Te proponen jugar una posición más retrasada para sumar minutos.',
      a: { label: 'Aceptar el sacrificio', rating: 2, goals: 0, assists: 1, fame: 0, morale: 1 },
      b: { label: 'Pedir tu posición natural', rating: 0, goals: 1, assists: 2, fame: 1 } },
    { prompt: 'Semana de exámenes físicos: el cuerpo pide descanso, el club pide minutos.',
      a: { label: 'Cuidar el cuerpo', rating: 1, goals: 0, assists: 1, fame: 0, morale: 2 },
      b: { label: 'Jugar igual', rating: 1, goals: 1, assists: 1, fame: 1, morale: -1 } },
    { prompt: 'Un juvenil de las inferiores te pide consejos antes de su debut.',
      a: { label: 'Darle tu lugar en la charla técnica', rating: 0, goals: 0, assists: 2, fame: 2, morale: 2 },
      b: { label: 'Enfocarte en vos', rating: 1, goals: 1, assists: 1, fame: 0 } },
  ],
  DF: [
    { prompt: 'Antes del clásico, ¿cómo marcás al 9 rival, el goleador de la liga?',
      a: { label: 'Marca al hombre, todo el partido', rating: 3, goals: 0, assists: 0, fame: 1 },
      b: { label: 'Achicar espacios en zona', rating: 2, goals: 0, assists: 1, fame: 0 } },
    { prompt: 'Podés subir al ataque en un córner clave o quedarte cubriendo.',
      a: { label: 'Subir al córner', rating: 0, goals: 2, assists: 0, fame: 1, morale: 1 },
      b: { label: 'Quedarte cubriendo', rating: 2, goals: 0, assists: 0, fame: 0 } },
    { prompt: 'El árbitro te perdona una amarilla que sabías que merecías.',
      a: { label: 'Seguir al límite', rating: 1, goals: 0, assists: 0, fame: 1, morale: 1 },
      b: { label: 'Bajar la intensidad', rating: 1, goals: 0, assists: 0, fame: 0, morale: 0 } },
    { prompt: 'El DT quiere probarte de líbero, un rol distinto al que jugás siempre.',
      a: { label: 'Aceptar el desafío', rating: 3, goals: 0, assists: 1, fame: 1 },
      b: { label: 'Pedir tu puesto habitual', rating: 1, goals: 0, assists: 0, fame: 0, morale: 1 } },
    { prompt: 'Se lesiona el arquero titular en un partido clave; falta cambios.',
      a: { label: 'Bancar la defensa como líder', rating: 2, goals: 0, assists: 0, fame: 2, morale: 1 },
      b: { label: 'Jugar conservador', rating: 1, goals: 0, assists: 0, fame: 0 } },
    { prompt: 'Te ofrecen ser el pateador de los tiros libres desde tu posición.',
      a: { label: 'Aceptar', rating: 0, goals: 2, assists: 0, fame: 2 },
      b: { label: 'Dejárselo a un especialista', rating: 1, goals: 0, assists: 0, fame: 0, morale: 1 } },
  ],
  GK: [
    { prompt: 'Se acerca la definición por penales de un partido eliminatorio.',
      a: { label: 'Estudiar a los pateadores', rating: 3, goals: 0, assists: 0, fame: 2 },
      b: { label: 'Confiar en tus reflejos', rating: 1, goals: 0, assists: 0, fame: 1 } },
    { prompt: 'El DT te pide arriesgar más jugando con los pies desde el fondo.',
      a: { label: 'Animarte a jugar corto', rating: 1, goals: 0, assists: 1, fame: 1, morale: -1 },
      b: { label: 'Despejar largo, sin riesgo', rating: 2, goals: 0, assists: 0, fame: 0 } },
    { prompt: 'Una racha de vallas invictas te pone en boca de todos.',
      a: { label: 'Hablar del logro en los medios', rating: 0, goals: 0, assists: 0, fame: 4, morale: -1 },
      b: { label: 'Bajarle el precio en silencio', rating: 2, goals: 0, assists: 0, fame: 0, morale: 1 } },
    { prompt: 'Aparece un juvenil promesa que te disputa el puesto en los entrenamientos.',
      a: { label: 'Subir el nivel de entrenamiento', rating: 3, goals: 0, assists: 0, fame: 0 },
      b: { label: 'Aconsejarlo, sin miedo', rating: 1, goals: 0, assists: 0, fame: 1, morale: 2 } },
    { prompt: 'Errás una salida y el equipo se queda con uno menos… en el próximo partido.',
      a: { label: 'Redoblar la concentración', rating: 2, goals: 0, assists: 0, fame: 0 },
      b: { label: 'Cambiar tu forma de jugar el saque', rating: 1, goals: 0, assists: 0, fame: 0, morale: 1 } },
    { prompt: 'Te proponen ser el capitán del arco de la selección juvenil.',
      a: { label: 'Aceptar la responsabilidad', rating: 1, goals: 0, assists: 0, fame: 3, morale: 1 },
      b: { label: 'Priorizar tu club', rating: 2, goals: 0, assists: 0, fame: 0 } },
  ],
}

const BASE_STATS = {
  FW: { goals: 8, assists: 2 },
  MF: { goals: 3, assists: 6 },
  DF: { goals: 1, assists: 1 },
  GK: { goals: 0, assists: 0 },
}

function shuffledDecisions(position) {
  const pool = DECISIONS[position] || DECISIONS.MF
  const arr = pool.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Arranca una carrera nueva. */
export function startCareer({ name, position, nationality }) {
  const startClub = randomSmallClub()
  return {
    name: (name || '').trim() || 'Crack Anónimo',
    position,
    nationality,
    age: START_AGE,
    season: 0,
    rating: 60,
    peakRating: 60,
    fame: 5,
    morale: 60,
    club: startClub,
    clubHistory: [startClub.name],
    trophies: [],
    caps: 0,
    totals: { goals: 0, assists: 0, apps: 0 },
    peakValueM: 0.5,
    events: [], // log narrativo para el timeline final
    _deck: shuffledDecisions(position),
    _deckIdx: 0,
  }
}

/** Determina si esta temporada trae un evento especial (oferta de transferencia / selección) en vez de una decisión libre. */
function specialEventForSeason(state) {
  const s = state.season
  // Ofertas de transferencia en temporadas intermedias, si el nivel lo amerita.
  if ([2, 5, 8].includes(s) && state.rating >= 68 + s) {
    const target = randomBigClub(state.clubHistory)
    if (target && target.name !== state.club.name) return { type: 'transfer', target }
  }
  // Convocatoria a la selección.
  if ([1, 4, 7, 10].includes(s) && state.rating >= 64 && rand() < 0.7) {
    return { type: 'call_up' }
  }
  return null
}

/** Arma la "carta" de esta temporada: o un evento especial, o una decisión del mazo. */
export function getSeasonCard(state) {
  const special = specialEventForSeason(state)
  if (special) return special

  if (state._deckIdx >= state._deck.length) { state._deck = shuffledDecisions(state.position); state._deckIdx = 0 }
  const d = state._deck[state._deckIdx]
  return { type: 'decision', decision: d }
}

/** Aplica la opción elegida (o resuelve el evento especial) y avanza una temporada. */
export function resolveSeason(state, card, choiceKey) {
  const next = { ...state, events: state.events.slice(), clubHistory: state.clubHistory.slice(), trophies: state.trophies.slice() }
  let line = ''

  if (card.type === 'transfer') {
    if (choiceKey === 'accept') {
      next.club = card.target
      next.clubHistory.push(card.target.name)
      next.fame = clamp(next.fame + 8, 0, 100)
      next.rating = clamp(next.rating - 2, 40, 99) // adaptación
      line = `Fichaste por ${card.target.name}. 🔄`
    } else {
      next.morale = clamp(next.morale + 6, 0, 100)
      next.fame = clamp(next.fame + 2, 0, 100)
      line = `Le dijiste que no a ${card.target.name} y te quedaste en ${next.club.name}. 🤝`
    }
  } else if (card.type === 'call_up') {
    next.caps += 1
    next.fame = clamp(next.fame + 3, 0, 100)
    line = `Convocatoria a la Selección. Sumaste una cita más. 🇦🇷`.replace('🇦🇷', flagEmojiFor(next.nationality))
  } else {
    const opt = card.decision[choiceKey]
    next.rating = clamp(next.rating + (opt.rating || 0) + (rand() < 0.5 ? 1 : -1), 40, 99)
    next.fame = clamp(next.fame + (opt.fame || 0), 0, 100)
    next.morale = clamp(next.morale + (opt.morale || 0), 0, 100)
    const base = BASE_STATS[state.position]
    const seasonGoals = Math.max(0, Math.round(base.goals * (next.rating / 70) + (opt.goals || 0) + (rand() * 2 - 1)))
    const seasonAssists = Math.max(0, Math.round(base.assists * (next.rating / 70) + (opt.assists || 0) + (rand() * 2 - 1)))
    next.totals = {
      goals: next.totals.goals + seasonGoals,
      assists: next.totals.assists + seasonAssists,
      apps: next.totals.apps + Math.round(28 + rand() * 10),
    }
    line = `${opt.label}. ${seasonGoals ? `⚽ ${seasonGoals} goles. ` : ''}${seasonAssists ? `🅰️ ${seasonAssists} asistencias.` : ''}`.trim()
  }

  // Trofeo: probabilidad según fama del club (grande = más chances) y rating propio.
  const isBigClub = bigClubs().some(c => c.name === next.club.name)
  const trophyChance = (isBigClub ? 0.32 : 0.1) + (next.rating - 60) / 300
  if (rand() < clamp(trophyChance, 0.03, 0.6)) {
    const trophy = pick(TROPHY_NAMES)
    next.trophies.push(trophy)
    line += ` 🏆 ¡Campeón de ${trophy}!`
  }

  next.peakRating = Math.max(next.peakRating, next.rating)
  const clubMult = isBigClub ? 3 : 1
  const valueM = Math.max(0.5, ((next.rating - 40) * clubMult * (1 + next.fame / 100)) / 3)
  next.peakValueM = Math.max(next.peakValueM, valueM)

  next.events.push({ season: state.season + 1, club: next.club.name, line: line.trim() })
  next.age = state.age + 1
  next.season = state.season + 1
  next._deckIdx = card.type === 'decision' ? state._deckIdx + 1 : state._deckIdx

  return next
}

export function isCareerOver(state) { return state.season >= CAREER_SEASONS }

function flagEmojiFor(code) {
  if (!code || code.length !== 2) return '🌍'
  const A = 0x1F1E6
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => A + c.charCodeAt(0) - 65))
}

const GRADES = [
  { min: 88, key: 'legend', label: 'LEYENDA DEL FÚTBOL', xp: 200, fichas: 80 },
  { min: 80, key: 'world_class', label: 'CRACK MUNDIAL', xp: 150, fichas: 60 },
  { min: 68, key: 'pro', label: 'PROFESIONAL CONSOLIDADO', xp: 100, fichas: 40 },
  { min: 55, key: 'decent', label: 'CORRECTO', xp: 60, fichas: 24 },
  { min: 0, key: 'amateur', label: 'AMATEUR ETERNO', xp: 30, fichas: 12 },
]

export function gradeFor(peakRating, trophyCount) {
  const boosted = peakRating + Math.min(trophyCount, 6) * 1.5
  return GRADES.find(g => boosted >= g.min) || GRADES[GRADES.length - 1]
}

/** Resumen final + grado + recompensa sugerida (la RPC vuelve a calcular el monto por grado). */
export function finalizeCareer(state) {
  const grade = gradeFor(state.peakRating, state.trophies.length)
  return {
    name: state.name,
    position: state.position,
    nationality: state.nationality,
    ageRetired: state.age,
    clubs: state.clubHistory,
    lastClub: state.club.name,
    totals: state.totals,
    trophies: state.trophies,
    caps: state.caps,
    peakRating: state.peakRating,
    peakValueM: Math.round(state.peakValueM * 10) / 10,
    grade,
    events: state.events,
  }
}

/** Texto compartible del resultado final (mismo motor viral que el Reto del día). */
export function buildCareerShareText(summary, refCode = '') {
  const link = refCode ? `${shareBaseUrl()}/register?ref=${encodeURIComponent(refCode)}` : `${shareBaseUrl()}/carrera`
  return [
    `GOALDEMY ⚽ · Modo Carrera`,
    `${summary.grade.label} — ${summary.name}`,
    `⚽ ${summary.totals.goals} goles   🅰️ ${summary.totals.assists} asistencias   🏟 ${summary.totals.apps} partidos`,
    `🏆 ${summary.trophies.length} títulos   📈 pico de ${summary.peakRating} de rating   💰 €${summary.peakValueM}M`,
    `Clubes: ${summary.clubs.join(' → ')}`,
    `¿Podés superar mi carrera? 👇`,
    link,
  ].join('\n')
}

// ── Reclamo REAL al crear cuenta / estar logueado (mismo patrón que daily-reto.js) ──
const PENDING_KEY = 'goaldemy_career_pending'

/** Guarda un reclamo pendiente (el invitado terminó su carrera). Se otorga al loguearse. */
export function setPendingCareerClaim(gradeKey) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ gradeKey, day: todayKey(), at: Date.now() })) } catch {}
}
export function getPendingCareerClaim() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') } catch { return null }
}
export function clearPendingCareerClaim() {
  try { localStorage.removeItem(PENDING_KEY) } catch {}
}

/**
 * Si hay un reclamo pendiente y el usuario ya está logueado + verificado, lo reclama
 * DE VERDAD vía la RPC claim_career_reward (1 vez por día, igual que el Reto).
 * Se llama al arrancar la app (App.vue) tras authReady.
 */
export async function claimPendingCareerReward() {
  const pending = getPendingCareerClaim()
  if (!pending) return null
  try {
    const { getAuthUser } = await import('./auth')
    const user = getAuthUser()
    if (!user?.id || !user?.email_confirmed_at) return null

    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('claim_career_reward', { p_grade_key: pending.gradeKey, p_day_key: pending.day })
    if (error) { console.warn('[career] claim error:', error.message); return null }

    clearPendingCareerClaim()
    if (!data?.ok) return null

    if (data.xp || data.fichas) {
      try {
        const { pushInfoToast } = await import('../stores/notifications')
        pushInfoToast(`🎁 ¡Reclamaste +${data.xp} XP y ${data.fichas} Fichas de tu Carrera!`)
      } catch {}
      try {
        const { detectAndToastLevelUp } = await import('./xp')
        await detectAndToastLevelUp()
      } catch {}
    }
    return { xp: data.xp, fichas: data.fichas }
  } catch (e) {
    console.warn('[career] claim exception:', e?.message || e)
    return null
  }
}
