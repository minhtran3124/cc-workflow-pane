export type Call = {
  id: string
  tool: string
  arg: string
  isDone: boolean
  isError?: boolean
  out?: string
}

export type Row = {
  runId: string
  index: number
  label: string
  agentId?: string
  startedAt: number
  endedAt?: number
  tokens: number
  lastTool?: string
  lastAt?: number
  calls?: number
  isBusy?: boolean
  isFailed?: boolean
  model?: string
  effort?: string
  log?: Call[]
}

declare module 'claude-code' {
  interface PluginState {
    'workflow-pane': { rows: Shaped<Row[]>; phases: Shaped<string[]>; detail: boolean }
  }
}
