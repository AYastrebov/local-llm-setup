# JetBrains Central Setup

[JetBrains Central CLI](https://central-cli.labs.jb.gg) runs a local proxy that routes requests from coding agents to the JetBrains AI Platform. It handles authentication, quota tracking, and model routing — agents use dummy API keys, the proxy strips them and adds the real JWT.

## Install

Download from https://central-cli.labs.jb.gg and run `jbcentral login`.

## Proxy

The proxy binds to `127.0.0.1:19516` (localhost only). After login, the wire secret is stored in `~/.wire/config.json`:

```json
{
  "proxy_port": 19516,
  "proxy_secret": "<your-secret>",
  "license": { "name": "All Products Pack" }
}
```

## Shell environment

Add to `~/.zshrc` (included in `zshrc-snippet.sh`):

```sh
# Derive wire base URL from ~/.wire/config.json
export JB_WIRE_SECRET=$(jq -r '.proxy_secret' ~/.wire/config.json 2>/dev/null)
export JB_WIRE_PORT=$(jq -r '.proxy_port' ~/.wire/config.json 2>/dev/null)
export JB_WIRE_BASE="http://127.0.0.1:${JB_WIRE_PORT}/wire/${JB_WIRE_SECRET}"

# Dummy keys — proxy strips them and adds the real JWT
export ANTHROPIC_API_KEY=sk-ant-dummy
export OPENAI_API_KEY=sk-openai-dummy
export GOOGLE_OAUTH_ACCESS_TOKEN=dummy-jbcentral
export GOOGLE_VERTEX_LOCATION=default-location
export GOOGLE_VERTEX_PROJECT=default-project
```

## Wire paths per agent

Each agent type has its own wire path for quota tracking:

| Agent | Anthropic | OpenAI | Vertex |
|-------|-----------|--------|--------|
| OpenCode | `opencode/anthropic/v1` | `opencode/openai` | `opencode/vertex` |
| Claude Code | `claude-code/anthropic` | — | — |
| Codex CLI | — | `codex/openai` | — |
| Gemini CLI | — | — | `gemini-cli/vertex` |
| pi.dev | `claude-code/anthropic` | `codex/openai` | `gemini-cli/vertex` |

**Note:** The `opencode/vertex` path does not work for Gemini. Use `gemini-cli/vertex` path instead (confirmed working via curl).

## OpenCode wiring

JetBrains Central auto-generates `~/.config/opencode/opencode.json` with provider baseURLs. Do **not** edit this file — it will be overwritten. The user config is `~/.config/opencode/opencode.jsonc`.

See `opencode.json` in this directory for the reference template.

## Quota

```sh
jbcentral quota     # raw output
jb-usage            # formatted (see neuralwatt/nw-usage pattern)
jb-usage --tmux     # compact for statusline
jb-usage --json     # parsed JSON
```
