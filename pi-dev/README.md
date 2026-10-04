# pi-dev

pi.dev model configs (`~/.pi/agent/models.json`) for each platform.

## Files

| File | Platform | Copy to |
|------|----------|---------|
| `models-mac.json` | macOS (M2 Max, 64GB) | `~/.pi/agent/models.json` |
| `models-fedora.json` | Fedora (RX 9060 XT, ROCm) | `~/.pi/agent/models.json` |
| `settings-mac.json` | macOS | `~/.pi/agent/settings.json` |
| `settings-fedora.json` | Fedora | `~/.pi/agent/settings.json` |

## Setup

```bash
# macOS
cp pi-dev/models-mac.json ~/.pi/agent/models.json

# Fedora
cp pi-dev/models-fedora.json   ~/.pi/agent/models.json
cp pi-dev/settings-fedora.json ~/.pi/agent/settings.json
```

No editing needed: the NeuralWatt entry uses `"apiKey": "$NEURALWATT_API_KEY"`, which pi
interpolates from the environment at request time. Export the key from your shell (see
[neuralwatt/setup.md](../neuralwatt/setup.md#api-key)).

**Never put a literal key in the templates.** If you hardcode one in `~/.pi/agent/models.json`,
do not copy that file back into the repo.

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
