See [AGENTS.md](AGENTS.md) for project instructions.

## Boundaries

- Never install packages or invoke any package manager or language runtime (e.g. `yarn`, `npm`,
  `php`) directly on the host machine — always run it through `docker-compose`. The only exception
  is a specific command the user has explicitly allowed on the host, either in their message in the
  current conversation or through a standing user instruction (for example a user memory entry).
- Keep backend controllers thin — business logic belongs in each module's service, not the
  controller, unless a change explicitly documents why an exception is warranted.
