import initSqlJs, {
  type Database,
  type QueryExecResult,
  type SqlJsStatic
} from 'sql.js/dist/sql-wasm-browser.js'

const SCHEMA = `CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  time_ms REAL NOT NULL
)`

const DEFAULT_QUERY = `SELECT method, status, url
FROM requests
ORDER BY id`

interface HarEntry {
  startedDateTime?: string
  time?: number
  request?: {method?: string; url?: string}
  response?: {status?: number; content?: {mimeType?: string}}
}

const queryBox = document.querySelector<HTMLTextAreaElement>('#query')
const runButton = document.querySelector<HTMLButtonElement>('#run')
const statusText = document.querySelector<HTMLElement>('#status')
const statusMeta = document.querySelector<HTMLElement>('#statusMeta')
const queryError = document.querySelector<HTMLElement>('#queryError')
const resultHead = document.querySelector<HTMLElement>('#results thead')
const resultBody = document.querySelector<HTMLElement>('#results tbody')
const rowCount = document.querySelector<HTMLElement>('#rowCount')

if (
  !queryBox ||
  !runButton ||
  !statusText ||
  !statusMeta ||
  !queryError ||
  !resultHead ||
  !resultBody ||
  !rowCount
) {
  throw new Error('Missing required UI elements')
}

let database: Database | null = null
const seen = new Set<string>()
const queued: HarEntry[] = []
let accepting = false

queryBox.value = DEFAULT_QUERY

const setStatus = (title: string, meta: string) => {
  statusText.textContent = title
  statusMeta.textContent = meta
}

const requestTotal = (db: Database) => {
  const rows = db.exec('SELECT COUNT(*) FROM requests')
  const value = rows[0]?.values[0]?.[0]

  return typeof value === 'number' ? value : Number(value ?? 0)
}

const sqliteVersion = (db: Database) => {
  const rows = db.exec('SELECT sqlite_version()')
  const value = rows[0]?.values[0]?.[0]

  return typeof value === 'string' ? value : ''
}

const summary = (db: Database) => {
  const count = requestTotal(db)
  const label = count === 1 ? '1 request' : `${count} requests`

  return `SQLite ${sqliteVersion(db)} · ${label}`
}

const entryKey = (entry: HarEntry) =>
  [
    entry.startedDateTime ?? '',
    entry.request?.method ?? '',
    entry.request?.url ?? '',
    String(entry.response?.status ?? ''),
    String(entry.time ?? '')
  ].join('\n')

const insertEntry = (db: Database, entry: HarEntry) => {
  const url = entry.request?.url ?? ''

  if (!url) return

  db.run(
    `INSERT INTO requests (started_at, method, url, status, mime_type, time_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.startedDateTime ?? '',
      entry.request?.method ?? '',
      url,
      entry.response?.status ?? 0,
      entry.response?.content?.mimeType ?? '',
      entry.time ?? 0
    ]
  )
}

const ingest = (entry: HarEntry) => {
  const key = entryKey(entry)

  if (seen.has(key)) return

  seen.add(key)
  insertEntry(database as Database, entry)
}

const cellText = (value: string | number | Uint8Array | null) => {
  if (value == null) return ''

  if (value instanceof Uint8Array) return ''

  return String(value)
}

const clearRows = (label: string) => {
  resultHead.replaceChildren()
  resultBody.replaceChildren()
  rowCount.textContent = label
}

const renderResult = (table: QueryExecResult) => {
  resultHead.replaceChildren()
  resultBody.replaceChildren()

  const headRow = document.createElement('tr')

  for (const column of table.columns) {
    const cell = document.createElement('th')

    cell.textContent = column
    cell.scope = 'col'
    headRow.append(cell)
  }

  resultHead.append(headRow)

  for (const row of table.values) {
    const bodyRow = document.createElement('tr')

    bodyRow.className = 'result-row'

    for (const value of row) {
      const cell = document.createElement('td')

      cell.textContent = cellText(value)
      bodyRow.append(cell)
    }

    resultBody.append(bodyRow)
  }

  const count = table.values.length

  rowCount.textContent = count === 1 ? '1 row' : `${count} rows`
  queryError.textContent = ''
}

const runQuery = () => {
  queryError.textContent = ''

  if (!database) {
    queryError.textContent = 'SQLite is not ready.'

    return
  }

  const sql = queryBox.value.trim()

  if (!sql) {
    queryError.textContent = 'Enter a SQL query.'
    clearRows('')

    return
  }

  try {
    const resultSets = database.exec(sql)
    const table = [...resultSets]
      .reverse()
      .find((entry) => entry.columns.length > 0)

    if (!table) {
      clearRows('0 rows')

      return
    }

    renderResult(table)
    setStatus('Ready', summary(database))
  } catch (error) {
    queryError.textContent =
      error instanceof Error ? error.message : 'The query failed.'
  }
}

const readHar = () =>
  new Promise<HarEntry[]>((resolve, reject) => {
    let settled = false

    const succeed = (entries: HarEntry[]) => {
      if (settled) return

      settled = true
      resolve(entries)
    }

    const fail = (error: unknown) => {
      if (settled) return

      settled = true
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    try {
      chrome.devtools.network.getHAR((log) => {
        const message = chrome.runtime.lastError?.message

        if (message) {
          fail(new Error(message))

          return
        }

        succeed((log.entries ?? []) as HarEntry[])
      })
    } catch (error) {
      fail(error)
    }
  })

const boot = async () => {
  runButton.disabled = true

  try {
    setStatus('Loading SQLite…', 'Preparing the bundled database')

    const SQL: SqlJsStatic = await initSqlJs({
      locateFile: () => chrome.runtime.getURL('sql-wasm-browser.wasm')
    })

    database = new SQL.Database()
    database.run(SCHEMA)

    const network = chrome.devtools?.network

    if (!network) {
      setStatus(
        'Open the Requests tab',
        'Open this page from the Requests tab of the browser devtools to record the inspected page.'
      )

      runButton.disabled = false

      return
    }

    network.onRequestFinished.addListener((entry) => {
      const harEntry = entry as unknown as HarEntry

      if (!accepting) {
        queued.push(harEntry)

        return
      }

      ingest(harEntry)
      setStatus('Ready', summary(database as Database))
    })

    for (const entry of await readHar()) ingest(entry)

    accepting = true

    for (const entry of queued) ingest(entry)

    queued.length = 0
    runQuery()
    setStatus('Ready', summary(database))
    runButton.disabled = false
  } catch (error) {
    console.error(error)
    setStatus('Failed to load', 'Check the console for details.')
  }
}

runButton.addEventListener('click', () => {
  runQuery()
})

queryBox.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return

  event.preventDefault()
  runQuery()
})

void boot()
