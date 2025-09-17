// === Import library bawaan & eksternal ===
const fs = require('fs')                         // untuk baca/tulis file (log & .env)
const { Client } = require('pg')                 // library PostgreSQL
const Redis = require('ioredis')                 // library Redis
const chalk = require('chalk')                   // library untuk warna teks di console
const { spawn } = require('child_process')       // jalankan perintah shell/CLI

// ATUR KONFIGURASI ====================================================================================================================================================
                                                                                                                                                                             
// === KONFIGURASI FILE ENV & CUSTOM VARIABEL ===
const ENV_FILE = '../.env'                       // lokasi file .env (ubah sesuai path project kamu)
const CUSTOM_ENV = {                             // variabel ENV tambahan / override
  N8N_RUNNERS_BROKER_PORT: '4001',              // contoh: worker pakai port 4001
}
const ENV_EXCLUDE = [                           // list variabel ENV yang tidak dipakai
  // 'N8N_DEFAULT_LOCALE'
]

// === PILIH LOGIKA WORKER ===
const LOGIKA = 1                                 // ganti sesuai kebutuhan (0=main, 1=worker1, 2=worker2, dst)

// === Mapping logika ke command worker ===
const LOGIKA_MAP = {
  9: { name: 'n8n-worker-1', cmd: 'npx n8n worker --concurrency=10', useFilteredEnv: true },
  0: { name: 'n8n-main', cmd: 'npx n8n', useFilteredEnv: true },
  1: { name: 'n8n-worker-1', cmd: 'QUEUE_HEALTH_CHECK_PORT=4001 npx n8n worker --concurrency=10', useFilteredEnv: true },
  2: { name: 'n8n-worker-2', cmd: 'QUEUE_HEALTH_CHECK_PORT=4002 npx n8n worker --concurrency=10', useFilteredEnv: true }
}

// === KONFIGURASI LOG ROTATION ===
const MAX_LOG_LINES = 300                        // maksimal jumlah baris log sebelum dipotong
const LOG_KEEP_LAST = 10                         // jumlah baris terakhir yang disimpan saat rotasi log

// === FILE LOG OUTPUT ===
const logFile = './s.log'
let logStream = fs.createWriteStream(logFile, { flags: 'a' }) // buat stream untuk tulis log

// END AND START====================================================================================================================================================

// === Fungsi ROTATE LOG (buang log lama) ===
function rotateLog() {
  try {
    if (!fs.existsSync(logFile)) return          // skip kalau file log belum ada
    const lines = fs.readFileSync(logFile, 'utf8').split('\n')
    if (lines.length <= MAX_LOG_LINES) return    // skip kalau belum melebihi batas

    const keepLines = lines.slice(-LOG_KEEP_LAST) // simpan hanya beberapa baris terakhir
    fs.writeFileSync(logFile, keepLines.join('\n') + '\n')
    logStream.end()
    logStream = fs.createWriteStream(logFile, { flags: 'a' })
    console.log(chalk.yellow(`🗑 Log file rotated, kept ${keepLines.length} last lines`))
  } catch (err) {
    console.error('Error rotating log:', err)
  }
}

// === Fungsi LOG OUT (console + file) ===
function logOut(msg = '', colorFn = v => v) {
  rotateLog()                                   // cek rotasi log setiap kali logOut dipanggil
  const text = colorFn(msg)                     // kasih warna di console
  process.stdout.write(text + '\n')             // tampilkan ke console
  logStream.write(msg + '\n')                   // simpan ke file log
}

// === Fungsi LOAD ENV MANUAL (.env) ===
function loadEnv(path = '.env', excludeKeys = []) {
  const envContent = fs.readFileSync(path, 'utf8')
  const envMap = {}                             // map untuk env yang dipakai
  const excludedMap = {}                        // map untuk env yang di-exclude
  let totalElapsed = 0

  envContent.split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) return   // skip baris kosong / komentar
    const [key, ...valueParts] = line.split('=')
    if (!key) return
    const value = valueParts.join('=').trim().replace(/^"|"$/g, '')

    if (excludeKeys.includes(key.trim())) {     // kalau variabel masuk daftar exclude
      excludedMap[key.trim()] = value           // simpan ke excludedMap, tapi tidak dipakai
      return
    }

    // ukur waktu export env (ms)
    const start = process.hrtime.bigint()
    process.env[key.trim()] = value
    const elapsedNs = process.hrtime.bigint() - start
    const elapsedMs = Number(elapsedNs) / 1e6

    envMap[key.trim()] = { value, elapsed: elapsedMs.toFixed(3) }
    totalElapsed += elapsedMs
  })

  return { envMap, excludedMap, totalElapsed: totalElapsed.toFixed(3) }
}

// === Fungsi PRINT ENV KE LOG ===
function printEnv(envMap, excludedMap, totalElapsed) {
  logOut('\n🌍 ENV Loaded', chalk.blueBright.bold)

  // tampilkan env aktif
  Object.entries(envMap).forEach(([key, { value, elapsed }]) => {
    let color = chalk.cyan
    if (key.startsWith('DB_')) color = chalk.green
    else if (key.startsWith('QUEUE_')) color = chalk.magenta
    else if (key.startsWith('N8N_')) color = chalk.yellow
    else if (key === 'WEBHOOK_URL') color = chalk.white

    logOut(`${chalk.greenBright('✔')} ${chalk.bold(key)}=${color(value)} ${chalk.gray(`(${elapsed} ms)`)}`)
  })

  // tampilkan env yang di-exclude
  Object.entries(excludedMap).forEach(([key, value]) => {
    logOut(`${chalk.yellow('⚠️ ')} ${chalk.bold(key)}=${chalk.gray(value)} [EXCLUDED]`)
  })

  logOut(`Total waktu export ENV: ${totalElapsed} ms`, chalk.blueBright.bold)
  logOut('==================\n', chalk.blueBright.bold)
}

// === Fungsi CEK POSTGRES ===
async function checkPostgres() {
  const start = Date.now()
  const client = new Client({
    host: process.env.DB_POSTGRESDB_HOST,
    port: process.env.DB_POSTGRESDB_PORT,
    user: process.env.DB_POSTGRESDB_USER,
    password: process.env.DB_POSTGRESDB_PASSWORD,
    database: process.env.DB_POSTGRESDB_DATABASE,
  })
  try {
    await client.connect()
    await client.query('SELECT 1')              // query test → cek koneksi
    const elapsed = Date.now() - start
    logOut(`${chalk.green('✅ Postgres OK')} ${chalk.gray(`(${elapsed} ms)`)}`)
    await client.end()
    return true
  } catch (err) {
    const elapsed = Date.now() - start
    logOut(`${chalk.red('❌ Postgres Error')} ${chalk.gray(`(${elapsed} ms)`)}: ${chalk.redBright(err.message)}`)
    return false
  }
}

// === Fungsi CEK REDIS ===
async function checkRedis() {
  const start = Date.now()
  const redisUrl = `redis://${process.env.QUEUE_BULL_REDIS_HOST}:${process.env.QUEUE_BULL_REDIS_PORT}/${process.env.QUEUE_BULL_REDIS_DB}`
  const redis = new Redis(redisUrl)
  return new Promise((resolve) => {
    redis.on("connect", () => {
      const elapsed = Date.now() - start
      logOut(`${chalk.green('✅ Redis OK')} ${chalk.gray(`(${elapsed} ms)`)}`)
      redis.quit()
      resolve(true)
    })
    redis.on("error", (err) => {
      const elapsed = Date.now() - start
      logOut(`${chalk.red('❌ Redis Error')} ${chalk.gray(`(${elapsed} ms)`)}: ${chalk.redBright(err.message)}`)
      resolve(false)
    })
  })
}

// === Fungsi JALANKAN COMMAND SHELL ===
function runShell(name, command, useFilteredEnv = true) {
  const env = useFilteredEnv ? { ...process.env } : process.env // copy env supaya bersih
  const child = spawn(command, { shell: true, env })            // jalankan command di shell
  child.stdout.on('data', data => logOut(data.toString()))      // capture stdout
  child.stderr.on('data', data => logOut(data.toString()))      // capture stderr
  child.on('close', code => logOut(`🚪 ${name} exited with code ${code}`)) // log saat proses selesai
}

// === MAIN PROGRAM (ASYNC) ===
(async () => {
  // 1. Load ENV dari file
  const { envMap, excludedMap, totalElapsed } = loadEnv(ENV_FILE, ENV_EXCLUDE)
  printEnv(envMap, excludedMap, totalElapsed)

  // 2. Apply ENV custom/override
  Object.entries(CUSTOM_ENV).forEach(([key, value]) => {
    process.env[key] = value
    logOut(`⚡ Custom ENV applied: ${key}=${value}`, chalk.magenta)
  })

  // 3. Cek Redis & Postgres
  const redisOk = await checkRedis()
  const pgOk = await checkPostgres()

  // kalau salah satu error → stop
  if (!redisOk || !pgOk) {
    logOut('❌ Aborting n8n start: DB or Redis not ready', chalk.red.bold)
    logStream.end()
    process.exit(1)
  }

  // 4. Jalankan command sesuai LOGIKA
  const { name, cmd, useFilteredEnv } = LOGIKA_MAP[LOGIKA] || LOGIKA_MAP[1]
  logOut(`🚀 Starting ${name}...`, chalk.magenta.bold)
  runShell(name, cmd, useFilteredEnv)
})()
