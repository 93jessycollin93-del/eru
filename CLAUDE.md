# CLAUDE.md

This file holds no project knowledge, only the way in. Everything lives behind
the global agent map, which is imported below.

@AGENTS.md

## Path

1. [AGENTS.md](AGENTS.md): global map with the hard rules (no outside services; read files with `head`, never `cat`), a task router and the top-level tree.
2. [docs/agents/](docs/agents/): one map per area, each listing exact file paths.
   - [commands.md](docs/agents/commands.md)
   - [frontend.md](docs/agents/frontend.md)
   - [pages.md](docs/agents/pages.md)
   - [components.md](docs/agents/components.md)
   - [lib.md](docs/agents/lib.md)
   - [backend.md](docs/agents/backend.md)
   - [features.md](docs/agents/features.md)
   - [security.md](docs/agents/security.md)
   - [services.md](docs/agents/services.md)
   - [reference-docs.md](docs/agents/reference-docs.md)
3. The file itself. The code is the source of truth; the maps only point to it.
