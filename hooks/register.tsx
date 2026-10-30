import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Call, Row } from '../types'

const PANE = 'workflow'
const rows = atom({ plugin: 'workflow-pane', key: 'rows' } as const, [], {
  shape: 'rows-6',
})

// Detail mode: the last tool calls of each running agent, with their output.
const detail = atom({ plugin: 'workflow-pane', key: 'detail' } as const, false)

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

const argOf = (e: Record<string, unknown>) => {
  const arg = [e.command, e.file_path, e.path, e.pattern, e.url, e.query, e.description].find(
    v => typeof v === 'string' && v,
  ) as string | undefined
  return arg ? arg.replace(/\s+/g, ' ').slice(0, 60) : ''
}
// First line of a tool's output, for the detail view.
const outOf = (text: unknown) => {
  const line = typeof text === 'string' ? text.split('\n').find(l => l.trim()) : undefined
  return line ? line.trim().slice(0, 80) : '(no output)'
}

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

const RED = '#f85149'
// Detail mode shows tool calls for this many of the newest running agents.
const DETAIL_MAX = 3

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const dur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`
}
const tok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)

// The progress track: filled cells, a glint that sweeps the rest while it runs.
const track = (frac: number, width: number, tick: number) => {
  const filled = Math.round(Math.min(1, Math.max(0, frac)) * width)
  const rest = width - filled
  const at = tick >= 0 && rest > 0 ? tick % (rest + 3) : -1
  const glint = at >= 0 && at < rest
  return { filled, before: glint ? at : rest, glint, after: glint ? rest - at - 1 : 0 }
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

  on('command.run', { command: 'workflow-pane' }, async ($, e) => {
    const [word, mode] = e.args.trim().toLowerCase().split(/\s+/)
    if (word === 'off') {
      await $.ui.close({ id: PANE })
      return { text: 'Workflow pane closed. Run /workflow-pane to open it.' }
    }
    if (word === 'detail') {
      const next = mode === 'on' ? true : mode === 'off' ? false : !(await read($, detail))
      await update($, detail, () => next)
      await $.ui.open({ id: PANE, title: 'Workflow' })
      return { text: `Detail mode ${next ? 'on' : 'off'}.` }
    }
    await $.ui.open({ id: PANE, title: 'Workflow' })
    return { text: 'Workflow pane opened. /workflow-pane detail on|off shows the tool calls of each agent.' }
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    const raw = e as unknown as Record<string, unknown>
    const call: Call = { id: e.tool_use_id, tool: e.tool, arg: argOf(raw), isDone: false }
    if (id) {
      const what = brief(raw)
      await update($, rows, list =>
        list.map(r =>
          r.agentId === id
            ? {
                ...r,
                lastTool: what,
                lastAt: Date.now(),
                isBusy: true,
                calls: (r.calls ?? 0) + 1,
                log: [...(r.log ?? []), call].slice(-3),
              }
            : r,
        ),
      )
    }
    const ran = await next(e)
    if (id) {
      const res = ran as { text?: unknown; isError?: boolean }
      await update($, rows, list =>
        list.map(r =>
          r.agentId === id
            ? {
                ...r,
                isBusy: false,
                lastAt: Date.now(),
                log: (r.log ?? []).map(c =>
                  c.id === call.id ? { ...c, isDone: true, isError: res.isError === true, out: outOf(res.text) } : c,
                ),
              }
            : r,
        ),
      )
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
      const { agentId, model } = spawned
      await update($, rows, list =>
        list.map(r => (`${r.runId}#${r.index}` === key ? { ...r, agentId, model: model.replace(/^claude-/, '') } : r)),
      )
    }
    return spawned
  })

  // The model and effort of each agent, as its requests name them.
  const seen = new Set<string>()
  on('turn.step', async function* ($, e, next) {
    const id = e.agentId
    const effort = e.effort === undefined ? '' : String(e.effort)
    const model = e.model.replace(/^claude-/, '')
    const key = `${id}|${model}|${effort}`
    if (id && !seen.has(key)) {
      seen.add(key)
      await update($, rows, list =>
        list.map(r => (r.agentId === id ? { ...r, model, effort: effort || undefined } : r)),
      )
    }
    // Forward the stream beneath, and its result, unchanged.
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id) {
      const u = e.usage
      const t = u ? u.input_tokens + u.output_tokens : 0
      await update($, rows, list =>
        list.map(r =>
          r.agentId === id ? { ...r, endedAt: Date.now(), tokens: r.tokens + t, isFailed: e.reason !== 'answer' } : r,
        ),
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
    const isDetail = await read($, detail)
    const upcoming = nextPhase(list, names)
    const doneN = list.filter(r => r.endedAt).length
    const failedN = list.filter(r => r.isFailed).length
    const live = list.filter(r => !r.endedAt)
    const finished = live.length === 0
    const start = Math.min(...list.map(r => r.startedAt))
    const end = finished ? Math.max(...list.map(r => r.endedAt ?? 0)) : now
    const tokens = list.reduce((a, r) => a + r.tokens, 0)
    const spin = SPIN[Math.floor(now / 100) % SPIN.length]
    const tick = finished ? -1 : Math.floor(now / 150)
    // Newest first. Every running agent gets a block; finished ones, one line each.
    const sorted = [...list].sort((a, b) => b.startedAt - a.startedAt || b.index - a.index)
    const top = sorted.filter(r => !r.endedAt)
    const older = sorted.filter(r => r.endedAt)
    // The pane's own width, not the terminal's: the time wraps when this is too wide.
    const w = Math.max(24, (e.props as { bodyColumns?: number }).bodyColumns ?? 40) - 1
    const bar = track(doneN / list.length, 10, tick)

    return (
      <Box flexDirection="column">
        <Text>
          <Text color={CYAN}>◈ </Text>
          <Text bold>{list.length} agents</Text>
          <Text color={AMBER}>{`  ● ${live.length}`}</Text>
          <Text color={GREEN}>{`  ✓ ${doneN - failedN}`}</Text>
          {failedN > 0 && <Text color={RED}>{`  ✗ ${failedN}`}</Text>}
        </Text>
        <Text>
          <Text color={finished ? GREEN : AMBER}>{'━'.repeat(bar.filled)}</Text>
          <Text dimColor>{'─'.repeat(bar.before)}</Text>
          {bar.glint && <Text color={CYAN}>━</Text>}
          <Text dimColor>{'─'.repeat(bar.after)}</Text>
          <Text dimColor>
            {` ${dur(end - start)}`}
            {tokens ? ` · ↓ ${tok(tokens)} tok` : ''}
            {upcoming && !finished ? ` · next ▸ ${upcoming}` : ''}
          </Text>
        </Text>
        <Text> </Text>
        <Text bold color={PINK}>
          {`⧉ ${runId}`}
        </Text>
        {top.map((r, n) => {
          const isDone = !!r.endedAt
          const name = r.label.slice(0, Math.max(8, w - 11))
          const t = dur((r.endedAt ?? now) - r.startedAt)
          const [tool, ...rest] = (r.lastTool ?? '').split(': ')
          return (
            <Box flexDirection="column">
              <Text>
                {isDone ? <Text color={GREEN}>{'✓ '}</Text> : <Text color={CYAN}>{`${spin} `}</Text>}
                <Text color={isDone ? undefined : AMBER} dimColor={isDone}>{`${iconFor(r)} `}</Text>
                <Text dimColor={isDone}>{name.padEnd(Math.max(8, w - 11))}</Text>
                <Text dimColor>{t.padStart(6)}</Text>
              </Text>
              {isDetail && n < DETAIL_MAX && r.log?.length ? (
                r.log.map(c => (
                  <Box flexDirection="column">
                    <Text>
                      <Text color={c.isError ? RED : c.isDone ? GREEN : AMBER}>{'  ● '}</Text>
                      <Text bold>{c.tool}</Text>
                      <Text dimColor>{`  ${c.arg}`.slice(0, Math.max(6, w - 10))}</Text>
                    </Text>
                    <Text dimColor>{`    └ ${c.isDone ? (c.out ?? '') : 'running…'}`.slice(0, w)}</Text>
                  </Box>
                ))
              ) : r.lastTool ? (
                <Text>
                  <Text>{'  '}</Text>
                  <Text color={isDone ? undefined : CYAN} dimColor={isDone}>
                    {tool}
                  </Text>
                  <Text dimColor>
                    {` ${rest.join(': ')}`.slice(0, Math.max(6, w - 27))}
                    {isDone
                      ? ' · finished'
                      : r.isBusy
                        ? ` · running ${dur(now - (r.lastAt ?? now))}`
                        : ` · done ${ago(now - (r.lastAt ?? now))}`}
                  </Text>
                </Text>
              ) : (
                <Text dimColor>{isDone ? '  finished' : '  starting…'}</Text>
              )}
              {(r.model || r.effort) && (
                <Text dimColor>{`  ${[r.model, r.effort].filter(Boolean).join(' · ')}`.slice(0, w)}</Text>
              )}
              <Text> </Text>
            </Box>
          )
        })}
        {older.length > 0 && <Text dimColor>{`─ finished · ${older.length}`}</Text>}
        {older.map(r => {
          const extra = r.tokens ? ` · ${tok(r.tokens)}` : ''
          const nameW = Math.max(8, w - 11 - extra.length)
          return (
            <Text>
              {r.isFailed ? <Text color={RED}>{'✗ '}</Text> : <Text color={GREEN}>{'✓ '}</Text>}
              <Text dimColor>
                {`${iconFor(r)} `}
                {r.label.slice(0, nameW).padEnd(nameW)}
                {dur((r.endedAt ?? now) - r.startedAt).padStart(6)}
                {extra}
              </Text>
            </Text>
          )
        })}
      </Box>
    )
  })
}
