/**
 * Captura pantallas de ¿Quién es? y Duelo de Stats en inicio/acierto/error,
 * en desktop y en 400px, logueado con el usuario de prueba.
 * Uso: node scripts/screenshot-games.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const OUT = path.join(root, '.shots')
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = { desktop: { width: 1366, height: 860 }, mobile: { width: 400, height: 800 } }

function loadEnvLocal() {
  const out = {}
  for (const file of ['.env', '.env.local']) {
    const p = path.join(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      out[m[1]] = val
    }
  }
  return out
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (chunk) => {
      buf += chunk.toString().replace(/\x1b\[[0-9;]*m/g, '')
      const m = buf.match(/Local:\s+http:\/\/localhost:(\d+)/)
      if (m) { child.stdout.off('data', onData); resolve(Number(m[1])) }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (c) => process.stderr.write(c))
    setTimeout(() => reject(new Error(`Timeout esperando vite.\n${buf}`)), 35000)
  })
}

async function login(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', email)
  await page.fill('#password', password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])
}

async function shotWhoIs(browser, baseUrl, storageState, viewport) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport], storageState })
  const page = await ctx.newPage()
  await page.goto(`${baseUrl}/games/who-is`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.wi-card', { timeout: 15000 })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: path.join(OUT, `who-is-${viewport}-1-inicio.png`) })

  const correctName = (await page.locator('.wi-name').first().textContent())?.trim()
  console.log(`  [who-is/${viewport}] objetivo: ${correctName}`)

  const input = page.locator('input[placeholder="Escribí el nombre del jugador..."]')
  const wrongGuess = correctName?.includes('Messi') ? 'Cristiano Ronaldo' : 'Lionel Messi'
  await input.fill(wrongGuess)
  await page.waitForTimeout(200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `who-is-${viewport}-2-error.png`) })

  if (correctName) {
    await input.fill(correctName)
    await page.waitForTimeout(250)
    const exact = page.locator('li', { hasText: correctName }).first()
    if (await exact.count()) await exact.click()
    else await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(OUT, `who-is-${viewport}-3-acierto.png`) })
  }
  await ctx.close()
}

async function shotStatChallenge(browser, baseUrl, storageState, viewport) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport], storageState })
  const page = await ctx.newPage()
  await page.goto(`${baseUrl}/games/stat-challenge`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ds-cromo', { timeout: 15000 })
  await page.waitForTimeout(2500) // deja pasar el splash + terminar el conteo de stats
  await page.screenshot({ path: path.join(OUT, `stat-challenge-${viewport}-1-inicio.png`) })

  let gotOk = false, gotBad = false
  for (let attempt = 0; attempt < 10 && (!gotOk || !gotBad); attempt++) {
    const ops = page.locator('.ds-op')
    const n = await ops.count()
    if (!n) break
    await ops.first().click()
    // El mixin auto-avanza de ronda 600ms (acierto) / 1100ms (error) después del
    // click — hay que sacar la foto DESPUÉS del flip (450ms) pero ANTES de esos
    // límites, nunca esperar de más o ya cambió de ronda.
    await page.waitForTimeout(480)
    const isOk = await ops.first().evaluate((el) => el.classList.contains('is-ok'))
    if (isOk && !gotOk) {
      gotOk = true
      await page.screenshot({ path: path.join(OUT, `stat-challenge-${viewport}-3-acierto.png`) })
    } else if (!isOk && !gotBad) {
      gotBad = true
      await page.screenshot({ path: path.join(OUT, `stat-challenge-${viewport}-2-error.png`) })
    }
    await page.waitForTimeout(1300) // esperar a que avance de ronda
  }
  console.log(`  [stat-challenge/${viewport}] acierto:${gotOk} error:${gotBad}`)
  await ctx.close()
}

// Sube por los ancestros DOM hasta encontrar el componente Vue dueño de
// `selEl`, y desde ahí sube por los padres hasta uno cuyo ctx tenga `key`.
// Sólo para este script (nunca se expone nada al jugador real).
async function readVueCtxField(page, selector, key) {
  return page.evaluate(({ selector, key }) => {
    const el = document.querySelector(selector)
    if (!el) return null
    let node = el, inst = null
    for (let i = 0; i < 12 && node; i++) {
      if (node.__vueParentComponent) { inst = node.__vueParentComponent; break }
      node = node.parentElement
    }
    let comp = inst
    for (let i = 0; i < 15 && comp; i++) {
      if (comp.ctx && key in comp.ctx) return JSON.parse(JSON.stringify(comp.ctx[key]))
      comp = comp.parent
    }
    return null
  }, { selector, key })
}

async function shotHigherOrLower(browser, baseUrl, storageState, viewport) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport], storageState })
  const page = await ctx.newPage()
  await page.goto(`${baseUrl}/games/higher-or-lower`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.hl-vs', { timeout: 15000 })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: path.join(OUT, `higher-or-lower-${viewport}-1-inicio.png`) })

  let gotOk = false, gotBad = false
  for (let reload = 0; reload < 6 && (!gotOk || !gotBad); reload++) {
    if (reload > 0) {
      await page.goto(`${baseUrl}/games/higher-or-lower`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.hl-vs', { timeout: 15000 })
      await page.waitForTimeout(600)
    }
    for (let round = 0; round < 8; round++) {
      const btn = page.locator('.hl-btn-up')
      if (!(await btn.count())) break
      await btn.click()
      await page.waitForTimeout(720) // pasado el conteo (650ms) + resolve
      const cls = await page.locator('.hl-side-r').first().getAttribute('class')
      if (cls?.includes(' ok') || cls?.endsWith('ok')) {
        if (!gotOk) { gotOk = true; await page.screenshot({ path: path.join(OUT, `higher-or-lower-${viewport}-3-acierto.png`) }) }
        await page.waitForTimeout(750) // esperar el cambio de ronda antes del próximo click
      } else if (cls?.includes('bad')) {
        if (!gotBad) { gotBad = true; await page.screenshot({ path: path.join(OUT, `higher-or-lower-${viewport}-2-error.png`) }) }
        break // el juego terminó (una vida)
      } else break
    }
  }
  console.log(`  [higher-or-lower/${viewport}] acierto:${gotOk} error:${gotBad}`)
  await ctx.close()
}

async function shotConnections(browser, baseUrl, storageState, viewport) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport], storageState })
  const page = await ctx.newPage()
  await page.goto(`${baseUrl}/games/connections`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.cx-tile', { timeout: 15000 })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: path.join(OUT, `connections-${viewport}-1-inicio.png`) })

  const groups = await readVueCtxField(page, '.cx-tile', 'groups')
  if (!groups?.length) { console.log(`  [connections/${viewport}] no pude leer groups`); await ctx.close(); return }

  // Error: 3 de un grupo + 1 de otro (dispara además el toast "¡Casi!").
  const wrongIds = [...groups[0].players.slice(0, 3), groups[1].players[0]].map((p) => p.id)

  // Click por jugador: mapear id -> alt de su <img> (=nombre) dentro de un .cx-tile.
  async function clickByIds(ids) {
    for (const id of ids) {
      const name = (groups.flatMap((g) => g.players).find((p) => p.id === id) || {}).name
      if (!name) continue
      await page.locator('.cx-tile').filter({ has: page.locator(`img[alt="${name}"]`) }).first().click()
    }
  }
  await clickByIds(wrongIds)
  await page.locator('button', { hasText: 'Verificar' }).click()
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(OUT, `connections-${viewport}-2-error.png`) })
  await page.waitForTimeout(500)

  // Acierto: un grupo completo real.
  const okIds = groups[2].players.map((p) => p.id)
  await clickByIds(okIds)
  await page.locator('button', { hasText: 'Verificar' }).click()
  await page.waitForTimeout(550) // durante el vuelo de las figuritas (60ms*3 + 520ms)
  await page.screenshot({ path: path.join(OUT, `connections-${viewport}-3-acierto.png`) })
  console.log(`  [connections/${viewport}] listo`)
  await ctx.close()
}

async function main() {
  const env = loadEnvLocal()
  if (!env.TEST_USER_EMAIL || !env.TEST_USER_PASSWORD) {
    console.error('❌ Faltan TEST_USER_EMAIL / TEST_USER_PASSWORD en .env.local')
    process.exit(1)
  }
  console.log('🚀 Levantando vite...')
  const devServer = spawn('npm', ['run', 'dev'], { cwd: root, shell: true })
  const port = await waitForServer(devServer).catch((e) => { console.error(e.message); process.exit(1) })
  const baseUrl = `http://localhost:${port}`
  console.log(`✅ Vite en ${baseUrl}`)

  const browser = await chromium.launch({ headless: true })
  try {
    const loginCtx = await browser.newContext()
    const loginPage = await loginCtx.newPage()
    await login(loginPage, baseUrl, env.TEST_USER_EMAIL, env.TEST_USER_PASSWORD)
    const storageState = await loginCtx.storageState()
    await loginCtx.close()
    console.log('✅ Login OK\n')

    for (const viewport of ['desktop', 'mobile']) {
      console.log(`--- ${viewport} ---`)
      await shotWhoIs(browser, baseUrl, storageState, viewport)
      await shotStatChallenge(browser, baseUrl, storageState, viewport)
      await shotHigherOrLower(browser, baseUrl, storageState, viewport)
      await shotConnections(browser, baseUrl, storageState, viewport)
    }
    console.log(`\n✅ Capturas en ${OUT}`)
  } finally {
    await browser.close()
    devServer.kill()
  }
}

main()
