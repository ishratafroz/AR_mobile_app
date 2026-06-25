---
name: ollama-llama-setup
description: Local Llama 3 (Ollama) backend for the app's left chat panel — how it's wired and how to start it
metadata:
  type: project
---

The 🦙 left chat panel in ARDietApp is powered by **Llama 3 8B in Ollama on the PC**
(not on the phone — Moto G 5G has only 3.5 GB RAM). It runs on the PC's **RTX 3050
6 GB GPU** (CUDA), so it's fast.

**Setup facts:**
- Ollama installed via `winget install Ollama.Ollama`; exe at
  `C:\Users\USER\AppData\Local\Programs\Ollama\ollama.exe`.
- Model `llama3` (8B, Q4_0, ~4.7 GB) stored on **D:** not C: — C: was 100% full (0 GB).
  Set via user env var `OLLAMA_MODELS=D:\ollama\models`. The server MUST be started with
  that env var in its process (the installer's auto-started server uses the default C:
  path and will fail to pull with "not enough space").
- To (re)start the server pointed at D::
  ```powershell
  Get-Process ollama* | Stop-Process -Force
  $env:OLLAMA_MODELS="D:\ollama\models"
  & "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" serve   # run in background
  ```
- API on `http://localhost:11434` (`/api/tags`, `/api/chat`). Verified reachable.

**Phone → PC link:** `adb reverse tcp:11434 tcp:11434` (same mechanism as Metro's 8081).
Proven working: `adb shell "curl -s http://localhost:11434/api/tags"` returned
`llama3:latest`. The device HAS `curl` (toybox lacks `wget`/`nc`).

**App side:** `services/LlamaChat.js` (`isLlamaAvailable`, `chatLlama(messages, facts)`),
grounded with `engine/Assistant.buildFacts(ctx)`. Right panel stays rule-based
(`engine/Assistant.answer`) and offline. See [[android-build-workaround]] for build/run.

Note: Claude can't run in Ollama (hosted-only); Llama 3 is the local model of record.
