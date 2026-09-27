/**
 * SMOKE TEST — juegos logueados
 *
 * Levanta el dev server (vite), inicia sesión con el usuario de prueba
 * (TEST_USER_EMAIL/TEST_USER_PASSWORD en .env.local — nunca en el repo),
 * visita cada juego y reporta si tiró errores de consola.
 *
 * Uso:
 *   node scripts/smoke-test.mjs                                # todos los juegos, desktop
 *   node scripts/smoke-test.mjs --viewport=mobile               # 400x800 (breakpoint mobile)
 *   node scripts/smoke-test.mjs --games=who-is,stat-challenge   # sólo esos
 *   node scripts/smoke-test.mjs --screenshot-dir=.smoke-shots   # 1 captura por juego
 *   node scripts/smoke-test.mjs --headed                        # ver el navegador
 *
 * Requiere: npx playwright install chromium (una sola vez).
 */
import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const ALL_GAMES = [
  'guess-player', 'nationality', 'player-position', 'who-is', 'value-order',
  'age-order', 'height-order', 'shirt-number', 'once-ideal', 'football-wordle',
  'higher-or-lower', 'connections', 'football-grid', 'stat-challenge',
]

const VIEWPORTS = {
  desktop: { width: 1366, height: 860 },
  mobile: { width: 400, height: 800 },
}

function parseArgs() {
  const args = { viewport: 'desktop', games: ALL_GAMES, screenshotDir: null, headed: false }
  for (const a of process.argv.slice(2)) {
    if (a === '--headed') args.headed = true
    else if (a.startsWith('--viewport=')) args.viewport = a.split('=')[1]
    else if (a.startsWith('--games=')) args.games = a.split('=')[1].split(',').map((s) => s.trim())
    else if (a.startsWith('--screenshot-dir=')) args.screenshotDir = a.split('=')[1]
  }
  return args
}

function loadEnvLocal() {
  const out = {}
  for (const file of ['.env', '.env.local']) {
    const p = path.join(root, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      out[m[1]] = val
    }
  }
  return out
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (chunk) => {
      // eslint-disable-next-line no-control-regex
      buf += chunk.toString().replace(/\x1b\[[0-9;]*m/g, '') // vite colorea la salida con ANSI
      const m = buf.match(/Local:\s+http:\/\/localhost:(\d+)/)
      if (m) {
        child.stdout.off('data', onData)
        resolve(Number(m[1]))
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (c) => process.stderr.write(c))
    setTimeout(() => reject(new Error(`Timeout esperando que vite arranque (35s). stdout hasta ahora:\n${buf}`)), 35000)
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

async function visitGame(browser, baseUrl, slug, { viewport, screenshotDir, storageState }) {
  const context = await browser.newContext({ viewport: VIEWPORTS[viewport], storageState })
  const page = await context.newPage()
  const errors = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('requestfailed', (req) => {
    // Ignorar abort por navegación normal; loguear el resto
    const failure = req.failure()?.errorText || ''
    if (failure && failure !== 'net::ERR_ABORTED') errors.push(`requestfailed: ${req.url()} (${failure})`)
  })

  let ok = true
  let note = ''
  try {
    await page.goto(`${baseUrl}/games/${slug}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2500) // deja asentar animaciones/carga de datos
    if (screenshotDir) {
      mkdirSync(screenshotDir, { recursive: true })
      await page.screenshot({ path: path.join(screenshotDir, `${slug}-${viewport}.png`) })
    }
  } catch (e) {
    ok = false
    note = e.message
  }
  await context.close()
  return { slug, ok: ok && errors.length === 0, errors, note }
}

async function main() {
  const args = parseArgs()
  const env = loadEnvLocal()
  if (!env.TEST_USER_EMAIL || !env.TEST_USER_PASSWORD) {
    console.error('❌ Faltan TEST_USER_EMAIL / TEST_USER_PASSWORD en .env.local')
    process.exit(1)
  }

  console.log('🚀 Levantando vite...')
  const devServer = spawn('npm', ['run', 'dev'], { cwd: root, shell: true })
  let port
  try {
    port = await waitForServer(devServer)
  } catch (e) {
    devServer.kill()
    console.error('❌', e.message)
    process.exit(1)
  }
  const baseUrl = `http://localhost:${port}`
  console.log(`✅ Vite arriba en ${baseUrl}`)

  const browser = await chromium.launch({ headless: !args.headed })
  let storageState = null
  try {
    console.log(`🔐 Login como ${env.TEST_USER_EMAIL}...`)
    const loginContext = await browser.newContext()
    const loginPage = await loginContext.newPage()
    await login(loginPage, baseUrl, env.TEST_USER_EMAIL, env.TEST_USER_PASSWORD)
    storageState = await loginContext.storageState()
    await loginContext.close()
    console.log('✅ Login OK\n')

    const results = []
    for (const slug of args.games) {
      process.stdout.write(`  [${slug}] `)
      const r = await visitGame(browser, baseUrl, slug, { viewport: args.viewport, screenshotDir: args.screenshotDir, storageState })
      results.push(r)
      console.log(r.ok ? '✅' : `❌ ${r.note || r.errors[0] || 'errores en consola'}`)
      if (!r.ok) for (const e of r.errors) console.log('      -', e)
    }

    console.log('\n' + '='.repeat(60))
    const failed = results.filter((r) => !r.ok)
    console.log(`Juegos probados: ${results.length} — OK: ${results.length - failed.length} — con errores: ${failed.length}`)
    if (failed.length) {
      console.log('Con errores:', failed.map((r) => r.slug).join(', '))
      process.exitCode = 1
    }
  } catch (e) {
    console.error('❌ Fallo el smoke test:', e.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    devServer.kill()
  }
}

main()
