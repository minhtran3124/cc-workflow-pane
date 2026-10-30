# Changelog

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- The progress track is longer, built from `▰` cells with an amber-to-green colour ramp, a shade that slides along it like a barber pole while the run is live, and a percent figure.

## [0.2.0] - 2026-10-30

### Added

- Detail mode: `/workflow-pane detail on|off` shows the last three tool calls, with their output, for the three newest running agents.
- `/workflow-pane off` closes the pane.

### Changed

- The pane lists the newest agent first, and keeps finished agents in the list.
- Every running agent has a full block. Finished agents have one line each, below it.
- A blank line separates the agents.
- A running agent shows its model and its effort on a third line.
- A finished agent shows the tokens it used.
- An agent that ends with an error or is stopped shows `✗`, and the first line counts it.

### Fixed

- The progress track is a coloured line with a glint, not dim shaded blocks that looked like the background.
- The agent rows use the pane's width, so the time no longer wraps onto its own line.

## [0.1.0]

### Added

- The `workflow-pane` mod: a pane that shows the agents of a running workflow.
- A summary of the run: the agents that run and finish, a progress bar, the time, the tokens and the next phase.
- For each running agent: its label, the time it runs, and the tool it calls now (`running` or `done`).
- An icon for each agent, from its current tool or its label.
- `/workflow-pane`: opens the pane.
