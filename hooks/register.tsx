import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Row } from '../types'

const PANE = 'workflow'
const rows = atom({ plugin: 'workflow-pane', key: 'rows' } as const, [], {
  shape: 'rows-3',
})

// Phase titles of the latest Workflow call, read from its script's `meta`.
const phases = atom({ plugin: 'workflow-pane', key: 'phases' } as const, [], {
  shape: 'phases-1',
})

// A new "wave" starts when an agent spawns after every earlier one has ended.
// A heuristic stand-in for the current phase: the engine does not say it.
const waveOf = (list: Row[]) => {
  const sorted = [...list].sort((a, b) => a.startedAt - b.startedAt)
  let wave = 0
  sorted.forEach((r, i) => {
    if (i > 0 && sorted.slice(0, i).every(p => p.endedAt && p.endedAt <= r.startedAt)) wave++
  })
  return wave
}
const nextPhase = (list: Row[], names: string[]) => names[waveOf(list) + 1]

// "Bash: npm test", "Read: src/a.ts" — the tool and its main argument.
const brief = (e: Record<string, unknown>) => {
  const arg = [e.command, e.file_path, e.path, e.pattern, e.url, e.query, e.description].find(
    v => typeof v === 'string' && v,
  ) as string | undefined
  const one = arg ? arg.replace(/\s+/g, ' ').slice(0, 46) : ''
  return one ? `${String(e.tool)}: ${one}` : String(e.tool)
}
const ago = (ms: number) => (ms < 1500 ? 'now' : `${dur(ms)} ago`)

// Palette read off the built-in agents pane.
const AMBER = '#d29922'
const GREEN = '#3fb950'
const PINK = '#e0267e'
const CYAN = '#2fb8d8'

// One single-width glyph for what an agent is doing: its current tool first,
// else a guess from its label.
const TOOL_ICON: Record<string, string> = {
  Bash: '$',
  Read: '▤',
  Write: '✎',
  Edit: '✎',
  NotebookEdit: '✎',
  Grep: '⌕',
  Glob: '⌕',
  WebFetch: '◍',
  WebSearch: '◍',
  Agent: '⧉',
  Workflow: '⧉',
}
const LABEL_ICON: [RegExp, string][] = [
  [/review|verify|check|audit/i, '◎'],
  [/test|probe/i, '⚗'],
  [/search|research|explore|find|scan/i, '⌕'],
  [/fix|edit|write|implement|build|refactor/i, '✎'],
  [/summar|wrap|report|synth/i, '≡'],
]
const iconFor = (r: Row) => {
  const tool = (r.lastTool ?? '').split(':')[0]
  if (TOOL_ICON[tool]) return TOOL_ICON[tool]
  if (tool.startsWith('mcp__')) return '◈'
  return LABEL_ICON.find(([re]) => re.test(r.label))?.[1] ?? '•'
}

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const EIGHTHS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']

const dur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`
}
const tok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

// Smooth bar: `frac` of `width` cells, eighth-block precision.
const bar = (frac: number, width: number, tick = -1) => {
  const eighths = Math.round(Math.min(1, Math.max(0, frac)) * width * 8)
  const full = Math.floor(eighths / 8)
  const part = eighths % 8
  const used = full + (part ? 1 : 0)
  const empty = ' '
    .repeat(width - used)
    .split('')
    .map(() => '░')
  if (tick >= 0 && empty.length > 0) {
    const at = tick % (empty.length + 4)
    if (at < empty.length) empty[at] = '▓'
    if (at - 1 >= 0 && at - 1 < empty.length) empty[at - 1] = '▒'
  }
  return '█'.repeat(full) + (part ? EIGHTHS[part] : '') + empty.join('')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'workflow-pane',
      description: 'Show workflow agents live in a pane',
    })
    void $.ui.open({ id: PANE, title: 'Workflow' })
    $.ui.status(undefined)
    // Redraw 5x/second so the spinner and timers move.
    $.clock.every(200, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('command.run', { command: 'workflow-pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Workflow' })
    return { text: 'Workflow pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id) {
      const what = brief(e as unknown as Record<string, unknown>)
      await update($, rows, list =>
        list.map(r =>
          r.agentId === id ? { ...r, lastTool: what, lastAt: Date.now(), isBusy: true, calls: (r.calls ?? 0) + 1 } : r,
        ),
      )
    }
    const ran = await next(e)
    if (id) {
      await update($, rows, list => list.map(r => (r.agentId === id ? { ...r, isBusy: false, lastAt: Date.now() } : r)))
    }
    return ran
  })

  on('tool.call', { tool: 'Workflow' }, async ($, e, next) => {
    const script = typeof e.script === 'string' ? e.script : ''
    const meta = script.slice(0, script.indexOf('phase(') > 0 ? script.indexOf('phase(') : 4000)
    const titles = [...meta.matchAll(/title:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
    await update($, phases, () => titles)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const wf = e.workflow
    if (!wf) return next(e)
    const key = `${wf.runId}#${wf.agentIndex}`
    const row: Row = {
      runId: wf.runId,
      index: wf.agentIndex,
      label: e.description || e.prompt.slice(0, 40),
      startedAt: Date.now(),
      tokens: 0,
    }
    await update($, rows, list => [...list, row].slice(-100))
    const spawned = await next(e)
    if (spawned.deny === undefined && spawned.agentId) {
      const agentId = spawned.agentId
      await update($, rows, list => list.map(r => (`${r.runId}#${r.index}` === key ? { ...r, agentId } : r)))
    }
    return spawned
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id) {
      const u = e.usage
      const t = u ? u.input_tokens + u.output_tokens : 0
      await update($, rows, list =>
        list.map(r => (r.agentId === id ? { ...r, endedAt: Date.now(), tokens: r.tokens + t } : r)),
      )
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const all = await read($, rows)
    if (all.length === 0) {
      return <Text dimColor>No workflow agents yet. Run a workflow to see it here.</Text>
    }

    const now = Date.now()
    const runId = all[all.length - 1].runId
    const list = all.filter(r => r.runId === runId)
    const names = await read($, phases)
    const upcoming = nextPhase(list, names)
    const doneN = list.filter(r => r.endedAt).length
    const live = list.filter(r => !r.endedAt)
    const finished = live.length === 0
    const start = Math.min(...list.map(r => r.startedAt))
    const end = finished ? Math.max(...list.map(r => r.endedAt ?? 0)) : now
    const tokens = list.reduce((a, r) => a + r.tokens, 0)
    const spin = SPIN[Math.floor(now / 100) % SPIN.length]
    const tick = finished ? -1 : Math.floor(now / 150)
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 8) / 3))
    const w = Math.max(24, (e.viewport?.columns ?? 40) - 4)

    return (
      <Box flexDirection="column">
        <Text>
          <Text color={CYAN}>◈ </Text>
          <Text bold>{list.length} agents</Text>
          <Text color={AMBER}>{`  ● ${live.length}`}</Text>
          <Text color={GREEN}>{`  ✓ ${doneN}`}</Text>
        </Text>
        <Text dimColor>
          {bar(doneN / list.length, 12, tick)} {dur(end - start)}
          {tokens ? ` · ↓ ${tok(tokens)} tok` : ''}
          {upcoming && !finished ? ` · next ▸ ${upcoming}` : ''}
        </Text>
        <Text> </Text>
        {live.length > 0 && (
          <Text bold color={AMBER}>
            {`▾ RUNNING ${live.length}`}
          </Text>
        )}
        {finished && (
          <Text bold color={GREEN}>
            {`▾ FINISHED ${doneN}`}
          </Text>
        )}
        <Text bold color={PINK}>
          {`⧉ ${runId}`}
        </Text>
        {live.slice(0, room).map(r => {
          const name = r.label.slice(0, Math.max(8, w - 14))
          const t = dur(now - r.startedAt)
          const [tool, ...rest] = (r.lastTool ?? '').split(': ')
          return (
            <Box flexDirection="column">
              <Text>
                <Text color={CYAN}>{`${spin} `}</Text>
                <Text color={AMBER}>{`${iconFor(r)} `}</Text>
                <Text>{name.padEnd(Math.max(8, w - 14))}</Text>
                <Text dimColor>{t.padStart(6)}</Text>
              </Text>
              {r.lastTool ? (
                <Text>
                  <Text>{'  '}</Text>
                  <Text color={CYAN}>{tool}</Text>
                  <Text dimColor>
                    {` ${rest.join(': ')}`.slice(0, Math.max(6, w - 24))}
                    {r.isBusy
                      ? ` · running ${dur(now - (r.lastAt ?? now))}`
                      : ` · done ${ago(now - (r.lastAt ?? now))}`}
                  </Text>
                </Text>
              ) : (
                <Text dimColor>{'  starting…'}</Text>
              )}
            </Box>
          )
        })}
        {live.length > room && <Text dimColor>{`+ ${live.length - room} more running`}</Text>}
      </Box>
    )
  })
}
