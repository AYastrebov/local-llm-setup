# pi-dev

pi.dev model configs (`~/.pi/agent/models.json`) for each platform.

## Files

| File | Platform | Copy to |
|------|----------|---------|
| `models-mac.json` | macOS (M2 Max, 64GB) | `~/.pi/agent/models.json` |
| `models-fedora.json` | Fedora (RX 9060 XT, ROCm) | `~/.pi/agent/models.json` |
| `settings-mac.json` | macOS | `~/.pi/agent/settings.json` |
| `settings-fedora.json` | Fedora | `~/.pi/agent/settings.json` |
| `extensions/router.ts` | both | `~/.pi/agent/extensions/router.ts` |
| `skills/plan/`, `skills/implement/` | both | `~/.pi/agent/skills/` |

## Setup

```bash
# macOS
cp pi-dev/models-mac.json ~/.pi/agent/models.json

# Fedora
cp pi-dev/models-fedora.json   ~/.pi/agent/models.json
cp pi-dev/settings-fedora.json ~/.pi/agent/settings.json

# Both: router virtual model + plan/implement skills
mkdir -p ~/.pi/agent/extensions ~/.pi/agent/skills
cp pi-dev/extensions/router.ts ~/.pi/agent/extensions/
cp -r pi-dev/skills/plan pi-dev/skills/implement ~/.pi/agent/skills/
```

No editing needed: the NeuralWatt entry uses `"apiKey": "$NEURALWATT_API_KEY"`, which pi
interpolates from the environment at request time. Export the key from your shell (see
[neuralwatt/setup.md](../neuralwatt/setup.md#api-key)).

**Never put a literal key in the templates.** If you hardcode one in `~/.pi/agent/models.json`,
do not copy that file back into the repo.

## Plan → implement workflow

A lean take on Superpowers' spec → plan → subagent flow, built from pi primitives. Nothing loads
until you call it (both skills set `disable-model-invocation: true`), so it costs no tokens per turn.

| Piece | What it does |
|---|---|
| `router/auto` (`extensions/router.ts`) | Virtual model. A qualifier (`neuralwatt/nw-flash`, reasoning off, 8 s deadline) rates the first message once per session: **complex** → plans on `glm-5.3`, then switches to `glm-5.3-flash` after the first edit; **standard** → `glm-5.3-flash` throughout. One switch per session = one prompt-cache miss. Qualifier failure → standard. |
| `/skill:plan <request>` | Writes one short doc, `docs/plans/<topic>.md`: Goal, key Decisions, a task checklist (Files / Change / Verify command per task), Done-when. No full code in the plan. Asks at most 3 questions, in one message. |
| `/skill:implement docs/plans/<topic>.md` | Coordinator. Each task goes to a fresh `pi -p --no-skills --model router/auto` worker that sees only that task and the Decisions; the coordinator runs the Verify command itself, ticks the box, retries once on failure. One final read-only review of `git diff <base>` on `neuralwatt/glm-5.3:high`; high/medium findings become fix tasks. Never commits. |

Workers run sequentially on purpose: parallel implementers on one checkout degrade quality, and
NeuralWatt's trial tier allows 2 concurrent requests. Models are named at the top of each file.

Why not a router extension from npm: the ones that exist (`pi-model-router`, `pi-smart-router`)
re-route every turn (each switch drops the prompt cache) and have little adoption. Routing once per
session, as pi's own `jev-router.ts` example does, keeps the cache.

## Providers

| Provider | Models | Notes |
|----------|--------|-------|
| `neuralwatt` | GLM 5.3 Flash, GLM 5.3, MiMo V2.6 Pro, `nw-flash`, `nw-small`, `nw-large` — see [neuralwatt/setup.md](../neuralwatt/setup.md#models) | Requires `NEURALWATT_API_KEY` in the environment |
| `llama-cpp` | Qwen3.8-27B | Local llama.cpp at `localhost:8080` — start `qwen` (or use `pi-qwen`) first |

## What differs between mac and fedora

- **`llama-cpp` models**: same model (Qwen3.8-27B) on both; only the launcher's quant differs.
- **Default model** (`settings-*.json`): mac uses `moonshotai` / `kimi-k3`; fedora uses
  `neuralwatt` / `glm-5.3-flash`. Both share the same `enabledModels` short list.

The `neuralwatt` block is identical in both files — change it in both.

## Vendor providers

`anthropic`, `openai`, `google`, `deepseek` and friends are in pi's built-in catalog: export the
matching API key and pi picks them up on its own. They do not belong in `models.json` — only custom
endpoints (`llama-cpp`, `neuralwatt`) do.

## LSP (pi-lsp-extension)

`npm:pi-lsp-extension` is installed globally (`pi list`). It gives agents `lsp_diagnostics`, `lsp_hover`, `lsp_definition`, `lsp_references`, and other IDE-grade tools.

Built-in defaults (work automatically, no config needed):

| Language | Server |
|----------|--------|
| TypeScript / JavaScript | `typescript-language-server` |
| Go | `gopls serve` |
| Rust | `rust-analyzer` |
| Python | `pyright-langserver` |
| Java | `jdtls` |

Kotlin has no built-in default. Vue is not in the language map and won't trigger automatically. Configure non-default servers via `.pi-lsp.json` in the project root. A template is at `pi-dev/pi-lsp.json` in this repo.

```json
{
  "servers": {
    "kotlin": { "command": "kotlin-lsp", "args": ["--stdio"] }
  },
  "autoStart": ["kotlin"]
}
```

`autoStart` spins up the server at session start rather than waiting for the first tool call — recommended for Kotlin LSP, which is slow to initialize. See the [pi-lsp-extension README](https://github.com/samfoy/pi-lsp-extension) for full `.pi-lsp.json` options.

## What agents can edit here

- Add or remove models within existing providers
- Add new providers following the same structure
- Update `contextWindow` / `maxTokens` if a model's limits change
- Do **not** use env var substitution — pi.dev reads plain JSON
