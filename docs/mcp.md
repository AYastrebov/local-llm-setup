# MCP servers in pi

pi 1.0 supports MCP natively; no package is needed (`pi-mcp-adapter` is obsolete). User-level servers
live in `~/.pi/agent/mcp.json`; a project can add or override servers in `.pi/mcp.json` once trusted.

```bash
cp pi-dev/mcp.json ~/.pi/agent/mcp.json && chmod 600 ~/.pi/agent/mcp.json
pi mcp list          # connects to every server and prints state, tools and errors
```

| Server | Transport | Auth | Notes |
|---|---|---|---|
| `github` | `https://api.githubcopilot.com/mcp/` | `Authorization: Bearer ${GITHUB_TOKEN}` | ~49 tools: repos, issues, PRs, code search, Actions |
| `context7` | `https://mcp.context7.com/mcp` | `CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}` header | Current library docs (`resolve-library-id`, `query-docs`) |
| `tavily` | `https://mcp.tavily.com/mcp/` | OAuth: run `pi mcp login tavily` once | `tavily_search`, `_extract`, `_crawl`, `_map`, `_research`; token stored in `~/.pi/agent/mcp-auth.json`. Tavily's separate agent skills need its CLI + an API key and add nothing beyond this |
| `playwright` | stdio: `npx -y @playwright/mcp@latest` | none | Browser automation (~25 tools) |
| `jetbrains` | `http://127.0.0.1:64342/stream` | none | Needs a running JetBrains IDE (2025.2+) with Settings → Tools → MCP Server enabled; check the port there |

Rules that matter (from pi's `docs/mcp.md`):

- `${NAME}` in `headers`/`env` is read from the environment, so the file holds no secrets. Export
  the tokens from your shell (see `zshrc-snippet.sh`).
- Only stdio and streamable HTTP are supported. **SSE is rejected**: Claude Code's JetBrains entry
  (`http://localhost:64342/sse`) does not work in pi; use the `/stream` endpoint above.
- Tools are reached through `codemode` by default, so 80+ MCP tools do not inflate every request.
  Use `/mcp` in a session to inspect servers, sign in, or change exposure.
