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
}

declare module 'claude-code' {
  interface PluginState {
    'workflow-pane': { rows: Shaped<Row[]>; phases: Shaped<string[]> }
  }
}
