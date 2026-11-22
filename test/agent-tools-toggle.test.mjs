/**
 * Plain-Node test for the `agentTools` config switch. No third-party dependencies.
 *
 * Run with: node test/agent-tools-toggle.test.mjs
 *
 * The schema block runs only when `@deepseek-ai/schemastery` can be imported (a DSH host, or a
 * local resolution placed for the test); otherwise it prints "SKIP schema" and the rest still passes.
 */
import { apply, Config } from '../index.js'

const EXPECTED = ['prompt_delete', 'prompt_get', 'prompt_import_url', 'prompt_list', 'prompt_save']
const ROUTE_PATH = '/api/prompt-library/prompts'

let failed = 0

function check(label, ok, detail) {
  if (ok) {
    console.log(`${label} -> PASS (${detail})`)
  } else {
    failed += 1
    console.log(`${label} -> FAIL (${detail})`)
  }
}

/** A fake ctx shaped like the one Cordis hands to apply(). */
function makeCtx() {
  const tools = []
  const routes = []
  const ctx = {
    tools: {
      register(def) {
        tools.push(def)
        return () => {}
      },
    },
    connection: {
      fetch: {
        register(route) {
          routes.push(route)
          return () => {}
        },
      },
    },
    effect(fn) {
      const cleanup = fn()
      return typeof cleanup === 'function' ? cleanup : () => {}
    },
    inject(_names, fn) {
      fn(ctx)
    },
    get() {
      return undefined
    },
  }
  return { ctx, tools, routes }
}

function namesOf(tools) {
  return tools.map(def => def.name).sort()
}

function expectedTools(tools) {
  const names = namesOf(tools)
  return tools.length === EXPECTED.length && EXPECTED.every(name => names.includes(name))
}

function routeOk(routes) {
  return routes.length === 1 && routes[0] && routes[0].path === ROUTE_PATH
}

/** Run one case: (config) => assert the tool count and the always-present route. */
function runCase(label, config, toolCount) {
  const { ctx, tools, routes } = makeCtx()
  apply(ctx, config)
  const toolsOk = toolCount === 5 ? expectedTools(tools) : tools.length === toolCount
  check(`${label} tools`, toolsOk, `count=${tools.length} names=${namesOf(tools).join(',')}`)
  check(`${label} route`, routeOk(routes), `routes=${routes.length} path=${routes[0] && routes[0].path}`)
}

// Plain booleans and defaults (older hosts, or a direct apply call).
runCase('[a] agentTools=undefined', undefined, 5)
runCase('[b] agentTools=false', { agentTools: false }, 0)
runCase('[c] agentTools=true', { agentTools: true }, 5)
runCase('[d] agentTools={}', {}, 5)

// Volatile references: the value arrives as an object with .get(), as schemastery produces.
runCase('[e] volatile get()=false', { agentTools: { get: () => false } }, 0)
runCase('[f] volatile get()=true', { agentTools: { get: () => true } }, 5)
runCase('[g] volatile get()=undefined', { agentTools: { get: () => undefined } }, 5)

// schema: only when @deepseek-ai/schemastery resolves.
let schemaChecked = false
try {
  await import('@deepseek-ai/schemastery')
  schemaChecked = true
} catch {
  console.log('SKIP schema: @deepseek-ai/schemastery is not importable in this environment')
}
if (schemaChecked) {
  check('[schema] Config truthy', Boolean(Config), `Config=${Config === undefined ? 'undefined' : 'object'}`)
  const standard = Config === undefined ? undefined : Config['~standard']
  const offValue = standard === undefined ? undefined : standard.validate({ agentTools: false }).value
  const onValue = standard === undefined ? undefined : standard.validate({}).value
  const offRef = offValue === undefined ? undefined : offValue.agentTools
  const onRef = onValue === undefined ? undefined : onValue.agentTools
  const isVolatileRef = v => v !== null && typeof v === 'object' && typeof v.get === 'function'
  check('[schema] agentTools is a volatile reference', isVolatileRef(offRef) && isVolatileRef(onRef), `off=${typeof offRef} hasGet=${typeof (offRef && offRef.get)}`)
  const off = isVolatileRef(offRef) ? offRef.get() : offRef
  const on = isVolatileRef(onRef) ? onRef.get() : onRef
  check('[schema] validate({agentTools:false})', off === false, `agentTools=${off}`)
  check('[schema] validate({})', on === true, `agentTools=${on}`)
}

if (failed === 0) {
  console.log('ALL PASS')
} else {
  console.log(`${failed} check(s) failed`)
  process.exit(1)
}
