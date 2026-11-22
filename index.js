/**
 * Host half of the prompt library.
 *
 * One JSON file under the DSH home directory is the only source of truth. The
 * agent reaches it through four tools; the browser panel reads and writes the
 * same file through one authenticated `/api` fetch route, so a prompt saved in
 * either place shows up in both.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

export const name = 'dsh-prompt-library'
export const inject = ['tools']

/**
 * Build the plugin's Config with the host's schemastery. Its one field, `agentTools`, is volatile
 * (as in dsh-media-viewer) so the DSH settings forms publish and edit it: only volatile fields
 * appear in a plugin page's config form. A volatile change does not restart the plugin, so the
 * value is read once at load — turning it off takes effect the next time DSH starts or the plugin
 * is reloaded.
 * @param z - the schemastery export.
 * @returns the Config schema.
 */
export function createConfig(z) {
  const agentTools = z.boolean().default(true).description('Register prompt_save/list/get/delete/import_url to the Agent. Turn off to save per-request tool-definition context; the composer panel keeps working. A change takes effect after DSH restarts or the plugin reloads.')
  if (typeof agentTools.volatile === 'function') return z.object({ agentTools: agentTools.volatile() })
  Object.assign(agentTools.meta, { volatile: true })
  return z.object({ agentTools })
}

async function loadConfig() {
  try {
    const { default: z } = await import('@deepseek-ai/schemastery')
    const s = createConfig(z)
    // Cordis validates through Standard Schema; an older schemastery without it would fail the plugin's load.
    return s['~standard'] === undefined ? undefined : s
  } catch {
    // Only a DSH host resolves the package (plain-Node tests do not): without it there is no setting.
    return undefined
  }
}

/**
 * The plugin's one setting, `agentTools` (default `true`, volatile): read once at load, while true
 * the five prompt tools are registered to the Agent; turning it off drops those tools and leaves the
 * composer panel and the `/api` route untouched. Because it is volatile, the change takes effect the
 * next time DSH starts or the plugin reloads, not in the running session. `undefined` where
 * `@deepseek-ai/schemastery` cannot be loaded.
 */
export const Config = await loadConfig()

/**
 * Read `agentTools` out of a Cordis config. A volatile field arrives as a reference with `.get()`;
 * a plain boolean (older hosts, or a direct `apply` call) is used as-is. Only an explicit `false`
 * disables the tools, so an absent value keeps the default.
 * @param config - the config handed to `apply`, possibly undefined.
 * @returns whether the Agent tools should be registered.
 */
function agentToolsEnabled(config) {
  const value = config == null ? undefined : config.agentTools
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') return value.get() !== false
  return value !== false
}

/** Served through the `/api` carrier, so only the authenticated owner reaches it. */
const ROUTE = '/api/prompt-library/prompts'
const MAX_TITLE = 160
const MAX_CONTENT = 256 * 1024
const MAX_TAGS = 12
const MAX_TAG = 40
const MAX_SOURCE = 2048
/** Page text handed to the model; longer pages are cut and reported as truncated. */
const MAX_PAGE_CHARS = 40000
const MAX_IMPORTED = 8
const IMPORT_TIMEOUT_MS = 90000

/**
 * Entries written on the first read, so the library is useful before anyone
 * saves anything. Both come from the Archify quick-start page.
 */
const SEED_PROMPTS = [
  {
    title: 'Archify · 系统架构图',
    content: '用 Archify 把下面这段自然语言系统描述画成高层架构图：[在这里描述用户、核心组件、主要路径、外部依赖和边界]。不需要代码库。只追问会实质影响图的缺失信息，其余不确定内容要标明而不是编造；保留 8–12 个核心组件和一条一眼可见的主路径。',
    tags: ['架构图', 'archify', '系统设计'],
    requires: ['skill:archify'],
    source: 'https://archify.si/zh/start?type=architecture&agent=codex&source=direct&input=description',
  },
  {
    title: 'Archify · 安装 Skill',
    content: 'Install Archify for me by reading https://raw.githubusercontent.com/tt-a1i/archify/main/llms.txt',
    tags: ['archify', '安装'],
    requires: ['skill:archify'],
    source: 'https://archify.si/zh/start?type=architecture&agent=codex&source=direct&input=description',
  },
]

/** The prompt file, beside the rest of the user's DSH data. */
function storeFile() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : path.join(os.homedir(), '.dsh')
  return path.join(home, 'prompt-library', 'prompts.json')
}

function stamp() {
  return new Date().toISOString()
}

function asText(value) {
  return typeof value === 'string' ? value : ''
}

function cleanTags(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const tags = []
  for (const raw of value) {
    const tag = asText(raw).trim().replace(/\s+/g, ' ').slice(0, MAX_TAG)
    if (tag === '' || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

function cleanRequires(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const requires = []
  for (const raw of value) {
    const text = asText(raw).trim().replace(/\s+/g, ' ').slice(0, 80)
    if (text === '') continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    requires.push(text)
    if (requires.length >= 8) break
  }
  return requires
}

function titleFromContent(content) {
  const first = content.split('\n').map(line => line.trim()).find(line => line !== '') ?? ''
  const text = first.replace(/^#+\s*/, '').trim()
  if (text === '') return 'Untitled prompt'
  return text.length > 48 ? `${text.slice(0, 47)}…` : text
}

function normalizeEntry(raw) {
  const content = asText(raw.content).slice(0, MAX_CONTENT)
  return {
    id: /^[A-Za-z0-9_-]{6,64}$/.test(asText(raw.id)) ? raw.id : `p_${randomUUID()}`,
    title: asText(raw.title).trim().slice(0, MAX_TITLE) || titleFromContent(content),
    content,
    tags: cleanTags(raw.tags),
    requires: cleanRequires(raw.requires),
    source: asText(raw.source).trim().slice(0, MAX_SOURCE),
    createdAt: asText(raw.createdAt) || stamp(),
    updatedAt: asText(raw.updatedAt) || stamp(),
  }
}

function seedState() {
  const createdAt = stamp()
  return {
    version: 1,
    prompts: SEED_PROMPTS.map(seed => normalizeEntry({ ...seed, createdAt, updatedAt: createdAt })),
  }
}

/** One first read seeds the file; concurrent readers share that write. */
let seeding = null

/** The whole file, seeding it on first use so every caller sees the same entries. */
async function readStore() {
  const file = storeFile()
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      if (seeding === null) {
        seeding = (async () => {
          const seeded = seedState()
          await writeStore(seeded)
          return seeded
        })()
        seeding.then(() => { seeding = null }, () => { seeding = null })
      }
      return await seeding
    }
    throw new Error(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.prompts) ? parsed.prompts : []
  return {
    version: 1,
    prompts: list.filter(item => item !== null && typeof item === 'object').map(normalizeEntry),
  }
}

async function writeStore(state) {
  const file = storeFile()
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await rename(temporary, file)
}

let queue = Promise.resolve()

/** Writes read-modify-write the file; one writer at a time keeps them from racing. */
function serialized(task) {
  const run = () => task()
  const next = queue.then(run, run)
  queue = next.then(() => undefined, () => undefined)
  return next
}

function preview(content) {
  const single = content.replace(/\s+/g, ' ').trim()
  return single.length > 120 ? `${single.slice(0, 119)}…` : single
}

function summarize(entry) {
  return {
    id: entry.id,
    title: entry.title,
    tags: entry.tags,
    source: entry.source,
    chars: entry.content.length,
    preview: preview(entry.content),
    updatedAt: entry.updatedAt,
  }
}

function savePrompt(input) {
  const prompt = input !== null && typeof input === 'object' ? input : {}
  return serialized(async () => {
    const content = asText(prompt.content)
    if (content.trim() === '') throw new Error('content must be a non-empty prompt')
    const state = await readStore()
    const id = asText(prompt.id).trim()
    const existing = id === '' ? undefined : state.prompts.find(item => item.id === id)
    if (id !== '' && existing === undefined) throw new Error(`no stored prompt with id ${id}; save without \`id\` to create one`)
    const updatedAt = stamp()
    if (existing !== undefined) {
      existing.content = content.slice(0, MAX_CONTENT)
      const title = asText(prompt.title).trim().slice(0, MAX_TITLE)
      if (title !== '') existing.title = title
      if (prompt.tags !== undefined) existing.tags = cleanTags(prompt.tags)
      if (prompt.requires !== undefined) existing.requires = cleanRequires(prompt.requires)
      if (prompt.source !== undefined) existing.source = asText(prompt.source).trim().slice(0, MAX_SOURCE)
      existing.updatedAt = updatedAt
      await writeStore(state)
      return existing
    }
    const created = normalizeEntry({
      title: prompt.title,
      content,
      tags: prompt.tags,
      requires: prompt.requires,
      source: prompt.source,
      createdAt: updatedAt,
      updatedAt,
    })
    state.prompts.push(created)
    await writeStore(state)
    return created
  })
}

function deletePrompt(input) {
  const prompt = input !== null && typeof input === 'object' ? input : {}
  return serialized(async () => {
    const id = asText(prompt.id).trim()
    if (id === '') throw new Error('id is required')
    const state = await readStore()
    const index = state.prompts.findIndex(item => item.id === id)
    if (index === -1) throw new Error(`no stored prompt with id ${id}`)
    const [removed] = state.prompts.splice(index, 1)
    await writeStore(state)
    return { id: removed.id, title: removed.title }
  })
}

async function listPrompts(input = {}) {
  const query = asText(input.query).trim().toLowerCase()
  const tag = asText(input.tag).trim().toLowerCase()
  const requested = Number(input.limit)
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(Math.trunc(requested), 200) : 200
  const state = await readStore()
  let items = state.prompts.slice()
  if (tag !== '') items = items.filter(item => item.tags.some(value => value.toLowerCase() === tag))
  if (query !== '') {
    items = items.filter(item => `${item.title}\n${item.content}\n${item.tags.join(' ')}`.toLowerCase().includes(query))
  }
  items.sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0))
  return {
    total: state.prompts.length,
    matched: items.length,
    prompts: items.slice(0, limit).map(summarize),
  }
}

async function getPrompt(input = {}) {
  const state = await readStore()
  const id = asText(input.id).trim()
  const title = asText(input.title).trim().toLowerCase()
  if (id === '' && title === '') throw new Error('provide `id` or `title`')
  const found = id !== ''
    ? state.prompts.find(item => item.id === id)
    : state.prompts.find(item => item.title.toLowerCase() === title)
  if (found === undefined) {
    throw new Error(id !== '' ? `no stored prompt with id ${id}` : `no stored prompt titled ${asText(input.title)}`)
  }
  return found
}

/** Newest first, so a just-saved entry is the first row in the panel; requirements arrive resolved. */
async function snapshot(ctx, sessionId) {
  const state = await readStore()
  const inventory = await dependencyInventory(ctx, sessionId)
  const prompts = state.prompts.slice()
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0))
    .map(entry => ({ ...entry, requirements: resolveRequirements(entry.requires, inventory) }))
  return { ok: true, total: prompts.length, prompts }
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&hellip;/gi, '…')
}

/** Readable text from a page, keeping application/json payloads that often carry the copyable prompts. */
function htmlToText(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, ' ')
  const kept = withoutComments.replace(/<(script|style|noscript|svg|template)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, body) => {
    if (String(tag).toLowerCase() === 'script' && /application\/json/i.test(attrs)) return `\n${body}\n`
    return ' '
  })
  const text = kept
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|br|pre|code|blockquote|td|th)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(text)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeCandidates(parsed) {
  const list = Array.isArray(parsed && parsed.prompts) ? parsed.prompts : []
  const prompts = []
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const content = asText(item.content).trim().slice(0, MAX_CONTENT)
    if (content === '') continue
    prompts.push({
      title: asText(item.title).trim().slice(0, MAX_TITLE) || titleFromContent(content),
      content,
      tags: cleanTags(item.tags),
    })
    if (prompts.length >= MAX_IMPORTED) break
  }
  return { prompts, note: asText(parsed && parsed.note).trim().slice(0, 500) }
}

const EXTRACT_SYSTEM = [
  'You extract reusable prompts from one web page for a prompt library.',
  'Answer with ONE JSON object and nothing else: {"prompts":[{"title":string,"content":string,"tags":string[]}],"note":string}.',
  'Include every prompt the page itself provides: starter prompts, recipes, templates, copy-prompt blocks, system instructions, or example inputs addressed to an AI agent.',
  'When the page has no explicit prompt, write ONE new prompt that captures its reusable instruction or workflow.',
  'Keep each content verbatim when the page gives one; only repair obvious whitespace or markup damage. Placeholders such as [describe ...] stay as written.',
  'Match the language of the page. Use at most 8 prompts and at most 4 short tags each, without leading #.',
  'Return an empty prompts array only when the page contains no instruction-like content at all.',
].join(' ')

/** One model pass over the page text; throws with a readable reason instead of guessing. */
async function extractWithModel(ctx, selection, url, pageText, truncated, signal) {
  const llm = ctx.get('llm')
  if (llm === undefined) throw new Error('no language model service is available in this deployment')
  const header = `URL: ${url}\nPage text truncated: ${truncated ? 'yes' : 'no'}\n\nPAGE TEXT:\n`
  let reply = ''
  const chunks = llm.stream({
    provider: selection.provider,
    model: selection.model,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: header + pageText }] }],
    maxTokens: 2400,
    signal,
  })
  for await (const chunk of chunks) {
    if (chunk.type === 'text-delta') reply += chunk.text
    if (chunk.type === 'finish') {
      const kind = chunk.reason && chunk.reason.kind
      if (kind === 'error') {
        const failure = chunk.reason.failure
        throw new Error(`the model call failed: ${failure && failure.message ? failure.message : 'unknown error'}`)
      }
      if (kind === 'aborted') throw new Error('the model call was aborted')
    }
  }
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('the model did not return JSON')
  let parsed
  try {
    parsed = JSON.parse(reply.slice(start, end + 1))
  } catch {
    throw new Error('the model reply was not valid JSON')
  }
  const { prompts, note } = normalizeCandidates(parsed)
  if (prompts.length === 0) throw new Error('no prompt-like content was found on this page')
  return { prompts, note }
}

/** Fetch one URL and let the default model turn it into prompt candidates. */
async function importFromUrl(ctx, rawUrl) {
  const url = asText(rawUrl).trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('url must start with http:// or https://')
  const web = ctx.get('web')
  if (web === undefined) throw new Error('web access is not available in this deployment')
  const selection = ctx.get('agentDefaultModel')
  const current = selection === undefined ? undefined : selection.currentSelection()
  if (current === undefined || asText(current.provider) === '' || asText(current.model) === '') {
    throw new Error('no default model is configured; choose one in Settings first')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS)
  try {
    const fetched = await web.fetch({ url }, controller.signal)
    if (fetched.statusCode < 200 || fetched.statusCode >= 300) {
      throw new Error(`fetching the page failed with HTTP ${fetched.statusCode}`)
    }
    const body = fetched.body === null || fetched.body === undefined ? {} : fetched.body
    const raw = typeof body.content === 'string' ? body.content : ''
    const pageText = (body.kind === 'html' ? htmlToText(raw) : raw).trim()
    if (pageText.length < 40) throw new Error('the page has too little readable text')
    const excerpt = pageText.slice(0, MAX_PAGE_CHARS)
    const truncated = fetched.truncated === true || pageText.length > MAX_PAGE_CHARS
    const { prompts, note } = await extractWithModel(ctx, current, url, excerpt, truncated, controller.signal)
    return { url, prompts, note, truncated }
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`the import took longer than ${Math.round(IMPORT_TIMEOUT_MS / 1000)}s and was cancelled`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const DEP_CACHE_MS = 30000
let depCache = { key: '', at: 0, skills: [], plugins: [], bundles: [] }

function uniqueNames(values) {
  const seen = new Set()
  const names = []
  for (const value of values) {
    const text = asText(value).trim()
    if (text === '') continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(text)
  }
  return names
}

/** Installed skills and plugins, cached per session because a project skill lives beside the session's cwd. */
async function dependencyInventory(ctx, sessionId) {
  const key = asText(sessionId).trim() === '' ? 'global' : asText(sessionId).trim()
  if (depCache.key === key && Date.now() - depCache.at < DEP_CACHE_MS) return depCache
  const skills = []
  const plugins = []
  const bundles = []
  let listed = false
  // A session knows its own project root, which is where `.agents/skills` project skills live.
  const catalog = ctx.get('sessionSkillCatalog')
  if (key !== 'global' && catalog !== undefined) {
    try {
      const value = await catalog.list({ sessionId: key }, AbortSignal.timeout(8000))
      for (const entry of value.skills) skills.push(entry.name)
      listed = true
    } catch {
      // Fall back to the deployment-wide registry below.
    }
  }
  const skillService = ctx.get('skills')
  if (!listed && skillService !== undefined) {
    try {
      const directory = ctx.get('workingDirectory')
      const cwd = directory === undefined ? undefined : directory.defaultDirectory
      const list = await skillService.list(cwd === undefined || cwd === '' ? {} : { cwd })
      for (const item of list) skills.push(item.name)
    } catch {
      // Discovery failures degrade to "no skills known", never to a broken panel.
    }
  }
  const manager = ctx.get('pluginManager')
  if (manager !== undefined) {
    try {
      const entries = await manager.listPlugins()
      for (const entry of entries) plugins.push(entry.moduleName)
    } catch {
      // Same policy as skills.
    }
    try {
      const list = await manager.listBundles()
      for (const bundle of list) {
        if (bundle.installed === false) continue
        plugins.push(bundle.name)
        bundles.push(bundle.name)
      }
    } catch {
      // Same policy as skills.
    }
  }
  depCache = { key, at: Date.now(), skills: uniqueNames(skills), plugins: uniqueNames(plugins), bundles: uniqueNames(bundles) }
  return depCache
}

/** `skill:name` and `plugin:name` resolve against the inventory; bare text stays a note. */
function resolveRequirements(requires, inventory) {
  const skills = new Set(inventory.skills.map(value => value.toLowerCase()))
  const plugins = new Set(inventory.plugins.map(value => value.toLowerCase()))
  return requires.map((raw) => {
    const match = /^(skill|plugin)\s*[:：]\s*(.+)$/i.exec(raw)
    if (match === null) return { raw, kind: 'note', name: raw, status: 'unknown' }
    const kind = match[1].toLowerCase()
    const name = match[2].trim()
    const known = kind === 'skill' ? skills : plugins
    return { raw, kind, name, status: known.has(name.toLowerCase()) ? 'ready' : 'missing' }
  })
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/** The browser panel's only entry point; it returns the complete list after every write. */
async function handleRequest(ctx, request) {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const sessionId = url.searchParams.get('sessionId') ?? undefined
      const result = await listPrompts({ query: url.searchParams.get('query') ?? '' })
      return jsonResponse(200, { ...(await snapshot(ctx, sessionId)), matched: result.matched })
    }
    if (request.method !== 'POST') return jsonResponse(405, { ok: false, error: 'method not allowed' })
    let body
    try {
      body = await request.json()
    } catch {
      return jsonResponse(400, { ok: false, error: 'request body must be JSON' })
    }
    const action = asText(body && body.action)
    const sessionId = asText(body && body.sessionId).trim() === '' ? undefined : asText(body.sessionId)
    if (action === 'save') {
      const entry = await savePrompt(body.prompt ?? body)
      return jsonResponse(200, { ...(await snapshot(ctx, sessionId)), saved: entry })
    }
    if (action === 'delete') {
      const removed = await deletePrompt(body)
      return jsonResponse(200, { ...(await snapshot(ctx, sessionId)), removed })
    }
    if (action === 'install') {
      const raw = asText(body && body.raw).trim()
      if (raw === '') return jsonResponse(400, { ok: false, error: 'raw is required' })
      if (sessionId === undefined) return jsonResponse(400, { ok: false, error: 'install needs a sessionId' })
      const agents = ctx.get('agents')
      const agent = agents === undefined ? undefined : agents.get(sessionId)
      if (agent === undefined) {
        return jsonResponse(409, { ok: false, error: 'no running agent for this session; ask the agent in the chat instead' })
      }
      const match = /^(skill|plugin)\s*[:：]\s*(.+)$/i.exec(raw)
      const kind = match === null ? 'dependency' : match[1].toLowerCase()
      const name = match === null ? raw : match[2].trim()
      const title = asText(body && body.title).trim()
      const source = asText(body && body.source).trim()
      const lines = [
        `「提示词库」里${title === '' ? '有一条提示词' : `有一条提示词「${title}」`}依赖${kind === 'skill' ? '技能' : kind === 'plugin' ? '插件' : '依赖'} \`${name}\`，但当前环境没有检测到它。`,
        '请帮我把它装好，装完用一句话说明结果，以及我还需要做什么。',
      ]
      if (source !== '') lines.push(`参考来源：${source}`)
      agent.followup({ content: [{ type: 'text', text: lines.join('\n') }], source: { kind: 'user' } })
      return jsonResponse(200, { ok: true, message: lines[0] })
    }
    if (action === 'deps') {
      const inventory = await dependencyInventory(ctx, sessionId)
      return jsonResponse(200, { ok: true, skills: inventory.skills, plugins: inventory.bundles })
    }
    if (action === 'import') {
      const result = await importFromUrl(ctx, body.url)
      return jsonResponse(200, { ok: true, ...result })
    }
    return jsonResponse(400, { ok: false, error: `unknown action ${action === '' ? '(missing)' : action}` })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return jsonResponse(400, { ok: false, error: message })
  }
}

function saveTool(ctx) {
  ctx.effect(() => ctx.tools.register({
    name: 'prompt_save',
    description: 'Save one prompt in the user\'s prompt library (提示词库) so it survives the session and can be reused in the composer panel. Use it when the user asks to remember, store, or bookmark a prompt, or when you just produced a prompt worth keeping. Saving with an existing `id` updates that entry instead of adding a duplicate. The library lives in one JSON file on this machine and is shared with the 提示词库 panel.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['content'],
      properties: {
        content: { type: 'string', description: 'The prompt text, stored verbatim.' },
        title: { type: 'string', description: 'Short name shown in the list. Defaults to the first non-empty line of the content.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional labels, at most 12.' },
        source: { type: 'string', description: 'Optional page or document the prompt came from.' },
        requires: { type: 'array', items: { type: 'string' }, description: 'Dependencies this prompt needs, written as `skill:name` or `plugin:package-name`; bare text is kept as a note. The panel shows whether each one is installed.' },
        id: { type: 'string', description: 'Existing entry id to update instead of creating a new entry.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'chars', 'tags', 'requires'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          chars: { type: 'integer', description: 'Characters stored in the content.' },
          tags: { type: 'array', items: { type: 'string' } },
          requires: { type: 'array', items: { type: 'string' } },
        },
      },
      render(_args, value) {
        const needs = value.requires.length > 0 ? ` Needs: ${value.requires.join(', ')}.` : ''
        return [{
          type: 'text',
          text: `Saved "${value.title}" (id ${value.id}, ${value.chars} characters).${needs}`,
        }]
      },
    },
    async execute(rawArgs) {
      const entry = await savePrompt(rawArgs)
      return { id: entry.id, title: entry.title, chars: entry.content.length, tags: entry.tags, requires: entry.requires }
    },
  }), 'prompt-library: prompt_save')
}

function listTool(ctx) {
  ctx.effect(() => ctx.tools.register({
    name: 'prompt_list',
    description: 'List the prompts in the user\'s prompt library (提示词库) as short summaries: id, title, tags, size, and a preview. Use it before prompt_get to find the entry the user means, or to answer what is stored.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Case-insensitive text matched against title, content, and tags.' },
        tag: { type: 'string', description: 'Only entries carrying this tag.' },
        limit: { type: 'integer', description: 'Most entries to return, default 200.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['total', 'matched', 'prompts'],
        properties: {
          total: { type: 'integer' },
          matched: { type: 'integer' },
          prompts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'title', 'tags', 'chars', 'preview'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                chars: { type: 'integer' },
                preview: { type: 'string' },
                source: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      render(_args, value) {
        if (value.matched === 0) {
          return [{ type: 'text', text: `No prompt matched. The library holds ${value.total} prompt(s).` }]
        }
        const lines = value.prompts.map(item => `- ${item.title} [${item.id}] ${item.tags.length > 0 ? `#${item.tags.join(' #')} ` : ''}(${item.chars} characters)\n  ${item.preview}`)
        return [{
          type: 'text',
          text: `${value.matched} of ${value.total} prompt(s):\n${lines.join('\n')}`,
        }]
      },
    },
    async execute(rawArgs) {
      const result = await listPrompts(rawArgs ?? {})
      return { total: result.total, matched: result.matched, prompts: result.prompts }
    },
  }), 'prompt-library: prompt_list')
}

function getTool(ctx) {
  ctx.effect(() => ctx.tools.register({
    name: 'prompt_get',
    description: 'Read one saved prompt from the user\'s prompt library (提示词库) in full, by id or exact title. Use prompt_list first when the id is unknown.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Entry id from prompt_list or prompt_save.' },
        title: { type: 'string', description: 'Exact title, compared case-insensitively; ignored when `id` is given.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'content', 'tags', 'requires'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          requires: { type: 'array', items: { type: 'string' } },
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['raw', 'kind', 'name', 'status'],
              properties: {
                raw: { type: 'string' },
                kind: { type: 'string', enum: ['skill', 'plugin', 'note'] },
                name: { type: 'string' },
                status: { type: 'string', enum: ['ready', 'missing', 'unknown'] },
              },
            },
          },
          source: { type: 'string' },
          updatedAt: { type: 'string' },
        },
      },
      render(_args, value) {
        const meta = [`id ${value.id}`, value.tags.length > 0 ? `tags ${value.tags.join(', ')}` : 'no tags']
        if (value.requirements.length > 0) {
          meta.push(`needs ${value.requirements.map(req => `${req.raw} (${req.status})`).join(', ')}`)
        }
        if (value.source !== '') meta.push(`source ${value.source}`)
        return [{
          type: 'text',
          text: `"${value.title}" (${meta.join(' · ')})\n\n${value.content}`,
        }]
      },
    },
    async execute(rawArgs, exec) {
      const entry = await getPrompt(rawArgs ?? {})
      const inventory = await dependencyInventory(ctx, sessionIdOf(exec))
      return {
        id: entry.id,
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
        requires: entry.requires,
        requirements: resolveRequirements(entry.requires, inventory),
        source: entry.source,
        updatedAt: entry.updatedAt,
      }
    },
  }), 'prompt-library: prompt_get')
}

function deleteTool(ctx) {
  ctx.effect(() => ctx.tools.register({
    name: 'prompt_delete',
    description: 'Delete one entry from the user\'s prompt library (提示词库) by id. Only do this when the user asks to remove that prompt; read it with prompt_get first when the id is uncertain.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Entry id from prompt_list or prompt_get.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
        },
      },
      render(_args, value) {
        return [{ type: 'text', text: `Deleted "${value.title}" (${value.id}) from the prompt library.` }]
      },
    },
    async execute(rawArgs) {
      return deletePrompt(rawArgs ?? {})
    },
  }), 'prompt-library: prompt_delete')
}

function sessionIdOf(exec) {
  try {
    const session = exec === undefined || exec.agent === undefined ? undefined : exec.agent.session
    return session === undefined ? undefined : String(session.id)
  } catch {
    return undefined
  }
}

function importTool(ctx) {
  ctx.effect(() => ctx.tools.register({
    name: 'prompt_import_url',
    description: 'Read one web page and extract the prompts it contains for the user\'s prompt library: the page text is fetched and the default model pulls out every starter prompt, recipe, template, or system instruction; when the page has none, it writes one reusable prompt instead. Pass `save: true` to store the candidates (source = the URL), or omit it to review them first. Use this when the user pastes a link and asks to keep its prompts; the 提示词库 panel offers the same via 从链接智能录入.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string', description: 'Page URL beginning with http:// or https://.' },
        save: { type: 'boolean', description: 'Store every candidate in the library. Defaults to false.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'prompts'],
        properties: {
          url: { type: 'string' },
          note: { type: 'string' },
          saved: { type: 'integer' },
          prompts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'content', 'tags'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      render(_args, value) {
        const lines = value.prompts.map(item => `- ${item.title}${item.id ? ` [${item.id}]` : ''}${item.tags.length > 0 ? ` #${item.tags.join(' #')}` : ''}`)
        const saved = value.saved > 0 ? `Stored ${value.saved} prompt(s) from ${value.url}.` : `Found ${value.prompts.length} prompt(s) on ${value.url} (nothing stored).`
        const note = value.note === '' ? '' : `\nNote: ${value.note}`
        return [{ type: 'text', text: `${saved}\n${lines.join('\n')}${note}` }]
      },
    },
    async execute(rawArgs) {
      const result = await importFromUrl(ctx, rawArgs.url)
      const save = rawArgs.save === true
      const prompts = []
      for (const candidate of result.prompts) {
        if (!save) {
          prompts.push({ title: candidate.title, content: candidate.content, tags: candidate.tags })
          continue
        }
        const entry = await savePrompt({ ...candidate, source: result.url })
        prompts.push({ id: entry.id, title: entry.title, content: entry.content, tags: entry.tags })
      }
      return { url: result.url, note: result.note || '', saved: save ? prompts.length : 0, prompts }
    },
  }), 'prompt-library: prompt_import_url')
}

/**
 * Register the plugin. `config.agentTools` defaults to true (volatile, read at load): false skips
 * registering the five Agent tools, and because the field is volatile the change takes effect after
 * DSH restarts or the plugin reloads. Only the Agent tools are affected — the composer panel and the
 * `/api` route keep working.
 */
export function apply(ctx, config) {
  if (agentToolsEnabled(config)) {
    saveTool(ctx)
    listTool(ctx)
    getTool(ctx)
    deleteTool(ctx)
    importTool(ctx)
  }

  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.connection.fetch.register({
      path: ROUTE,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: request => handleRequest(connectionCtx, request),
    })
  })
}
