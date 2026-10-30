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
  test('lists the running agents, not the finished one', async ($, on) => {
    on('state.get', (_, e) =>
      e.key === 'rows'
        ? { value: { value: { shape: 'rows-3', value: ROWS }, version: 1 } }
        : { value: { value: undefined, version: 0 } },
    )

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ type: 'Text', text: /work-1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /read-1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /old-1/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /running/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /done/ })).toBeDefined()
      await ui.unmount()
    }
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
