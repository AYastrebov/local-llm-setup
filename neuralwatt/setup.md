# NeuralWatt

[NeuralWatt](https://portal.neuralwatt.com) is an energy-aware OpenAI-compatible API. This doc covers adding it as a pi provider, plus the `nw-usage` energy reporting script.

## Models

Snapshot of `GET https://api.neuralwatt.com/v1/models`, 2026-10-04 (same data as
[portal.neuralwatt.com/models](https://portal.neuralwatt.com/models)). Prices per million tokens.
These are the models in `pi-dev/models-*.json`:

| Model ID | Currently runs | Context | $ in | $ out | Images | Notes |
|----------|----------------|---------|------|-------|--------|-------|
| `nw-flash` | DeepSeek V4.1 Flash | 1M | $0.15 | $0.60 | ✅ | Cheap and fast |
| `nw-small` | Qwen3.8 27B | 262K | $0.45 | $3.20 | ✅ | |
| `nw-large` | Kimi K3 | 1M | $3.00 | $15.00 | ✅ | Hardest tasks |
| `glm-5.3` | GLM 5.3 | 1M | $1.45 | $4.50 | ❌ | Always reasons — no "off" |
| `glm-5.3-flash` | GLM 5.3 Flash | 1M | $0.15 | $0.50 | ✅ | **pi default (Fedora)** — best quality per dollar, lowest energy; always reasons |
| `mimo-v2.6-pro` | MiMo V2.6 Pro | 1M | $0.87 | $1.74 | ✅ | Thinking on/off only; ~2x OpenRouter's price for the same model |

**`nw-flash` / `nw-small` / `nw-large` are tracking aliases.** NeuralWatt re-points them at newer
models as the catalog changes (with notice), at the target's price. Use them when you want "the cheap
one" or "the big one" without editing config every time a model is retired. The pinned IDs behind them
(`deepseek-v4.1-flash`, `qwen-3.8-27b`, `kimi-k3`) are also served but not listed in the templates.

**Variants not in the templates:** `-flex` (~35% cheaper, lower scheduling priority), `-fast`
(skips the thinking phase), `-speed`. `GET /v1/models` lists them all with prices, limits and
supported reasoning efforts — it needs no API key.

**ID scheme changed in 2026.** The old Hugging Face-style IDs (`zai-org/GLM-5.1-FP8`,
`Qwen/Qwen3.6-35B-A3B`) are unlisted; Devstral is gone. `zai-org/GLM-5.1-FP8` still answered on
2026-10-04 but should be treated as retired.

## API key

Get a key from the [portal](https://portal.neuralwatt.com). Store it in the system keyring instead of hardcoding it in your shell rc (no plaintext in dotfiles, no exposure in shell history):

```bash
printf '%s' 'sk-your-key-here' | secret-tool store \
  --label='NeuralWatt API key' service neuralwatt user "$USER"
```

Then export it from `~/.zshrc` via a lookup:

```bash
export NEURALWATT_API_KEY=$(secret-tool lookup service neuralwatt user "$USER")
```

Verify:

```bash
echo "${NEURALWATT_API_KEY:0:6}…  (len=${#NEURALWATT_API_KEY})"
```

If you don't have `secret-tool` (libsecret), install it (`sudo dnf install libsecret` on Fedora, `sudo apt install libsecret-tools` on Debian/Ubuntu). On macOS you can use `security add-generic-password` instead.

## Wiring it into pi

NeuralWatt is a custom endpoint, so it needs an entry in `~/.pi/agent/models.json` (unlike the
providers in pi's built-in catalog, which only need an env var). Both `pi-dev/models-*.json`
templates contain the same block:

```json
"neuralwatt": {
  "api": "openai-completions",
  "apiKey": "$NEURALWATT_API_KEY",
  "baseUrl": "https://api.neuralwatt.com/v1",
  "compat": {
    "supportsDeveloperRole": false,
    "supportsReasoningEffort": true,
    "supportsUsageInStreaming": true
  },
  "models": [
    {
      "id": "nw-flash",
      "reasoning": true,
      "contextWindow": 1048560,
      "maxTokens": 65536,
      "cost": { "input": 0.15, "output": 0.6, "cacheRead": 0.015, "cacheWrite": 0 },
      "thinkingLevelMap": { "off": "none", "minimal": "low", "medium": "high" }
    },
    "..."
  ]
}
```

- **`apiKey: "$NEURALWATT_API_KEY"`** — pi interpolates `$NAME` / `${NAME}` in `models.json`, so the
  key comes from the environment (see [API key](#api-key)) and the file holds no secret.
- **`compat`** — verified against the live API: `developer` role is rejected on every model;
  `reasoning_effort` is honoured; streamed responses include a final usage chunk, so pi's cost
  footer works (each model carries its `cost`).
- **`thinkingLevelMap`** — translates pi's levels to the efforts each model supports (from
  `reasoning.supported_efforts` in `/v1/models`). `null` marks a level as unsupported, e.g. `off`
  for GLM 5.3, which always reasons.

On Fedora, `pi-dev/settings-fedora.json` makes `neuralwatt` / `glm-5.3-flash` the default and scopes
the model picker with `enabledModels` (`neuralwatt/*` is included, so new entries here show up
automatically).

Select a model at runtime with `pi --provider neuralwatt --model <id>`, or `/model` in a session.


MCP servers (GitHub, Context7, Tavily, Playwright, JetBrains) are configured in pi directly — see
[docs/mcp.md](../docs/mcp.md).

## nw-usage script

Queries the NeuralWatt energy API and prints request count and Wh consumption.

### Install

```bash
cp neuralwatt/nw-usage ~/.local/bin/
chmod +x ~/.local/bin/nw-usage
```

The script looks for the API key in three places, in order:

1. `NEURALWATT_API_KEY` environment variable
2. `secret-tool lookup service neuralwatt user "$USER"` (libsecret keyring — recommended; see [API key](#api-key) above)
3. `~/.config/neuralwatt/api_key` file (legacy plaintext fallback — only use if libsecret isn't available)

Statusline-style callers (tmux, conky) often run outside an interactive shell where `~/.zshrc` hasn't been sourced — the keyring lookup keeps working in those contexts, so you don't need the plaintext file.

### Usage

```bash
nw-usage            # balance + runway, today / 7 days / 30 days, cache-hit rate
nw-usage --tmux     # compact for statusline (cached): $3.97 ↗234 ⚡18Wh
nw-usage --json     # {"balance", "energy", "summary"} raw API responses
```

```
Neuralwatt usage (UTC 2026-10-04)
  Balance:  $3.97  (~249 days at $0.02/day, 7-day avg)
  Today:    234 req, 1.5M tokens, $0.06, 18Wh, 5.7g CO2
  7 days:   285 req, 3M tokens, $0.11, 30Wh
  30 days:  1354 req, 60.2M tokens, $1.31, 330Wh, 45g CO2
  Cache:    91% of 30-day tokens were prompt-cache hits
```

Sources: `GET /v1/billing/balance`, `GET /v1/usage/summary` (cost, tokens, cached tokens, consumed
vs charged kWh), `GET /v1/usage/energy` (energy, CO2 per day) — see
[docs.neuralwatt.com/api/usage](https://docs.neuralwatt.com/api/usage). Dates are UTC.

### Inside pi

`pi-dev/extensions/neuralwatt.ts` shows `NW $<balance>` in pi's footer (refreshed at session start
and after each run, at most once a minute) and adds `/nw`, which prints the same report as
`nw-usage`. It reads `NEURALWATT_API_KEY` from the environment.

