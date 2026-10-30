# cc-workflow-pane

`workflow-pane` is a Claude Code mod. It shows the agents of a running workflow in a pane next to the chat. You see what each agent does now, how long it runs, and which phase comes next.

## How it works

The pane opens when a session starts. Run `/workflow-pane` to open it again. The pane updates five times each second, so the spinner and the timers move.

The first lines show the run:

- `◈ N agents`, then the number of running agents (`●`) and finished agents (`✓`).
- A progress bar, the time since the first agent started, and the tokens that the agents used.
- `next ▸ <phase>`, the phase after the current one.

Under them, the pane lists the agents that are running. Each agent has two lines:

```
⠹ $ work-1                 33s
  Bash sleep 20 · running 6s
```

1. A spinner, an icon, the agent label and the time it runs.
2. The tool that the agent calls now, with its main argument, and `running` or `done`.

An agent that has finished is counted in the first line. The pane does not list it. When all agents of the run finish, the pane shows `▾ FINISHED` and the count.

### Icons

The icon shows what the agent does. The mod uses the current tool first. If the agent has not called a tool yet, the mod guesses from the agent label.

| Icon | Meaning                                               |
| ---- | ----------------------------------------------------- |
| `$`  | `Bash`                                                |
| `▤`  | `Read`                                                |
| `✎`  | `Write`, `Edit`, or a label with fix, edit, implement |
| `⌕`  | `Grep`, `Glob`, or a label with search, explore, find |
| `◍`  | `WebFetch`, `WebSearch`                               |
| `⧉`  | `Agent`, `Workflow`                                   |
| `◈`  | A tool of an MCP server                               |
| `◎`  | A label with review, verify, check, audit             |
| `⚗`  | A label with test, probe                              |
| `≡`  | A label with summarize, wrap, report                  |
| `•`  | The mod cannot tell                                   |

## Limits

- The mod only sees what happens after it loads. A workflow that started before does not show.
- The mod does not know how many agents a workflow will start. `done` and `total` count the agents that have started.
- `next ▸` is a guess. The mod reads the phase names from `meta.phases` of the script, and it starts a new phase when an agent starts after all earlier agents finished. A workflow whose phases overlap can show the wrong name. A workflow that you start by `name` or `scriptPath` has no `next`, because the mod reads only the inline `script`.
- The pane needs room. A pane that you open yourself shows from 110 columns.
- The mod does not show an agent that waits for a permission.

## Requirements and access

Tested with Claude Code 2.1.314. The mod uses function hooks, an early-access API that can change without notice.

The mod does this on your machine:

- It reads the input of each `Workflow` tool call, to get the phase names.
- It reads the start and end of each workflow agent, and each tool call that an agent makes. It keeps the tool name and the main argument (a command, a path or a pattern) of the latest call.
- It keeps this in the session state only. It makes no network call and writes no file.

## Install

In Claude Code, add this repository as a marketplace, then install the mod:

```
/plugin marketplace add minhtran3124/cc-workflow-pane
/plugin install workflow-pane@cc-workflow-pane
```

Or clone the repository, then start Claude Code with the mod loaded:

```sh
git clone https://github.com/minhtran3124/cc-workflow-pane.git
claude --plugin-dir ./cc-workflow-pane
```

To load the mod in every session, add the folder's absolute path to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`.

## Commands

```
/workflow-pane              open the pane
```

## Develop

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you send a change. It covers setup, tests and the file layout. [CHANGELOG.md](CHANGELOG.md) lists the changes in each version.

## License

MIT. See [LICENSE](LICENSE).
