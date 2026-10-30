import { describe, expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'workflow-pane',
  component: 'Pane',
  requestId: 'workflow',
  props: {
    title: 'Workflow',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const NOW = Date.now()
const ROWS = [
  {
    runId: 'wf_test',
    index: 1,
    label: 'work-1',
    agentId: 'a1',
    startedAt: NOW - 9000,
    tokens: 0,
    lastTool: 'Bash: sleep 20',
    lastAt: NOW - 3000,
    isBusy: true,
    calls: 1,
  },
  {
    runId: 'wf_test',
    index: 2,
    label: 'read-1',
    agentId: 'a2',
    startedAt: NOW - 9000,
    tokens: 0,
    lastTool: 'Read: /etc/hostname',
    lastAt: NOW - 2000,
    isBusy: false,
    calls: 2,
  },
  {
    runId: 'wf_test',
    index: 3,
    label: 'old-1',
    agentId: 'a3',
    startedAt: NOW - 9000,
    endedAt: NOW - 1000,
    tokens: 1200,
  },
]

describe('register', () => {
  test('lists the running agents and the finished one', async ($, on) => {
    on('state.get', (_, e) =>
      e.key === 'rows'
        ? { value: { value: { shape: 'rows-6', value: ROWS }, version: 1 } }
        : { value: { value: undefined, version: 0 } },
    )

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ type: 'Text', text: /work-1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /read-1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /old-1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /finished · 1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /running/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /done/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('gives every running agent a block, and a finished one a line', async ($, on) => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      runId: 'wf_test',
      index: i + 1,
      label: `agent-${i + 1}`,
      agentId: `a${i + 1}`,
      startedAt: NOW - 60000 + i * 1000,
      // The first two are done; the other six run.
      endedAt: i < 2 ? NOW - 1000 : undefined,
      lastTool: 'Bash: sleep 5',
      model: 'sonnet-5-5',
      effort: 'low',
      lastAt: NOW - 500,
      isBusy: true,
      tokens: 0,
    }))
    on('state.get', (_, e) =>
      e.key === 'rows'
        ? { value: { value: { shape: 'rows-6', value: many }, version: 1 } }
        : { value: { value: undefined, version: 0 } },
    )

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /finished · 2/ })).toBeDefined()
    // Every running agent is listed, not only the first five.
    expect(await ui.find({ type: 'Text', text: /agent-1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /agent-7/ })).toBeDefined()
    await ui.unmount()
  })

  test('shows the model and effort of a running agent, and marks a failed one', async ($, on) => {
    const rows = [
      {
        runId: 'wf_test',
        index: 1,
        label: 'ok-agent',
        agentId: 'a1',
        startedAt: NOW - 9000,
        tokens: 0,
        model: 'sonnet-5-5',
        effort: 'high',
      },
      {
        runId: 'wf_test',
        index: 2,
        label: 'bad-agent',
        agentId: 'a2',
        startedAt: NOW - 9000,
        endedAt: NOW - 1000,
        tokens: 2400,
        isFailed: true,
      },
    ]
    on('state.get', (_, e) =>
      e.key === 'rows'
        ? { value: { value: { shape: 'rows-6', value: rows }, version: 1 } }
        : { value: { value: undefined, version: 0 } },
    )

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /sonnet-5-5 · high/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✗ 1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2\.4k/ })).toBeDefined()
    await ui.unmount()
  })

  test('detail mode lists tool calls with output for the newest running agents only', async ($, on) => {
    const rows = Array.from({ length: 4 }, (_, i) => ({
      runId: 'wf_test',
      index: i + 1,
      label: `agent-${i + 1}`,
      agentId: `a${i + 1}`,
      startedAt: NOW - 60000 + i * 1000,
      tokens: 0,
      lastTool: 'Bash: sleep 5',
      log: [
        { id: `t${i}a`, tool: 'Bash', arg: 'sleep 5', isDone: true, out: `out-${i + 1}` },
        { id: `t${i}b`, tool: 'Read', arg: '/etc/hostname', isDone: false },
      ],
    }))
    on('state.get', (_, e) =>
      e.key === 'rows'
        ? { value: { value: { shape: 'rows-6', value: rows }, version: 1 } }
        : e.key === 'detail'
          ? { value: { value: true, version: 1 } }
          : { value: { value: undefined, version: 0 } },
    )

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    // agent-4, 3 and 2 are the newest three; agent-1 stays compact.
    expect(await ui.find({ type: 'Text', text: /└ out-4/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /└ out-2/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /└ out-1/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /└ running…/ })).toBeDefined()
    await ui.unmount()
  })

  test('shows the share of finished agents on the progress bar', async ($, on) => {
    on('state.get', (_, e) =>
      e.key === 'rows'
        ? { value: { value: { shape: 'rows-6', value: ROWS }, version: 1 } }
        : { value: { value: undefined, version: 0 } },
    )

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    // One agent of three is finished: some cells are full, some are empty.
    expect(await ui.find({ type: 'Text', text: /33%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '▰' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '▱' })).toBeDefined()
    await ui.unmount()
  })

  test('fills the progress bar when every agent has finished', async ($, on) => {
    const done = ROWS.map(r => ({ ...r, endedAt: NOW - 500, isBusy: false }))
    on('state.get', (_, e) =>
      e.key === 'rows'
        ? { value: { value: { shape: 'rows-6', value: done }, version: 1 } }
        : { value: { value: undefined, version: 0 } },
    )

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /100%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '▰' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '▱' })).toBeUndefined()
    await ui.unmount()
  })

  test('says so when no workflow ran', async ($, on) => {
    on('state.get', () => ({ value: { value: undefined, version: 0 } }))

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /No workflow agents/ })).toBeDefined()
    await ui.unmount()
  })

  test('a value an earlier version stored is declined', async ($, on) => {
    // What the code before this edit wrote stays through the reload.
    on('state.get', () => ({ value: { value: { shape: 'rows-1', value: [{ label: 'old' }] }, version: 1 } }))

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /No workflow agents/ })).toBeDefined()
    await ui.unmount()
  })
})
