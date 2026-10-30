# Contributing to cc-workflow-pane

Thank you for your help with `workflow-pane`. This guide tells you how to report a problem, set up the mod, and send a change.

We welcome these changes:

- Bug fixes, with a test that fails before the fix.
- Better icons, labels and layout of the pane.
- Documentation.

## Report a problem

[Open an issue](https://github.com/minhtran3124/cc-workflow-pane/issues). Include:

- The Claude Code version (`claude --version`)
- The surface: terminal, desktop, VS Code or mobile
- The workflow that you ran, and what the pane showed
- What you expected to occur

Do not paste secrets. The pane shows the argument of tool calls, so check it first.

## Set up

```sh
git clone https://github.com/minhtran3124/cc-workflow-pane.git
cd cc-workflow-pane
npm install                # once, for Prettier
claude --plugin-dir .
```

There is no build step. Claude Code reads `hooks/register.tsx` when it loads the mod, so restart Claude Code after you change it. Claude Code writes `.claude-plugin/types/` for your build. Git ignores that folder.

## Make a change

| Path                      | What it holds                                 |
| ------------------------- | --------------------------------------------- |
| `hooks/register.tsx`      | The hooks: agent events, tool calls, the pane |
| `types/index.d.ts`        | Types of the mod's session state              |
| `tests/register.test.tsx` | Tests                                         |
| `.claude-plugin/`         | The manifest and the marketplace entry        |

Follow these rules:

- Prettier sets the format. Run `npm run format` and do not argue with it.
- A hook must never block or change a tool call or an agent. Each hook ends in `next(e)` and returns what `next` returns.
- Change the `shape` tag of an atom when you change the fields of its value. Claude Code keeps the old value after a reload.
- Name a Boolean with `is` or `has`, as in `isBusy`.
- Write a comment to say why, not what. Keep it short.
- Keep the README in step with the code.

## Test

Run these commands before you send a change:

```sh
claude plugin validate .
claude plugin test .
npm run format:check
```

Add a test in `tests/register.test.tsx` for each new behaviour.

The tests cannot show how the pane looks. Test by hand in a real session as well:

1. Start Claude Code with `claude --plugin-dir .`.
2. Ask Claude to run a workflow with a few agents, each with several tool calls.
3. Check that the pane shows each running agent, that the icon follows the tool, and that `next ▸` names the next phase.
4. Check that a finished agent leaves the list, and that the first line counts it.

## Send a pull request

1. Create a branch from `main`.
2. Make the change and add tests.
3. Run validate, test and format:check.
4. Open a pull request. Say what changed and why.

Write the commit subject in the imperative, as in "Add an icon for MCP tools". Use the body to say why.

## License

When you contribute, you agree that your contribution is under the [MIT License](LICENSE).
