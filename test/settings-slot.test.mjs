/**
 * Static test: the client half wires the plugin page's settings card for `agentTools`.
 *
 * Reads client.js as text (it is a browser bundle, not importable under plain Node) and checks the
 * structural pieces that make the `plugins.bundle.config` slot appear. No third-party dependencies.
 *
 * Run with: node test/settings-slot.test.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')

let failed = 0

function count(needle) {
  let n = 0
  let at = source.indexOf(needle)
  while (at !== -1) {
    n += 1
    at = source.indexOf(needle, at + needle.length)
  }
  return n
}

function check(label, ok, detail) {
  if (ok) {
    console.log(`${label} -> PASS (${detail})`)
  } else {
    failed += 1
    console.log(`${label} -> FAIL (${detail})`)
  }
}

check('[slot] plugins.bundle.config registered', count('plugins.bundle.config') >= 1, `occurrences=${count('plugins.bundle.config')}`)
check("[slot] register key is 'dsh-prompt-library'", count("key: 'dsh-prompt-library'") >= 1, `occurrences=${count("key: 'dsh-prompt-library'")}`)
check("[slot] locale namespace is 'prompt-library'", count("const NS = 'prompt-library'") === 1, `occurrences=${count("const NS = 'prompt-library'")}`)
check('[slot] registration carries locale: NS', count('locale: NS') >= 1, `occurrences=${count('locale: NS')}`)
check('[slot] AgentToolsSettings component exists', count('function AgentToolsSettings') === 1, `occurrences=${count('function AgentToolsSettings')}`)
check('[slot] setAgentTools writer is provided', count('setAgentTools') >= 2, `occurrences=${count('setAgentTools')}`)

const KEYS = ['config.title', 'config.agentTools', 'config.agentToolsHint', 'config.readOnly', 'config.saveFailed', 'config.restartHint']
for (const key of KEYS) {
  const n = count(`'${key}'`)
  check(`[dict] ${key} in both languages`, n >= 2, `occurrences=${n}`)
}

if (failed === 0) {
  console.log('ALL PASS')
} else {
  console.log(`${failed} check(s) failed`)
  process.exit(1)
}
