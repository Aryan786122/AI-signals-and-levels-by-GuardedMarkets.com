# GuardedMarketsAI — Complete Project Migration & Context Handoff

> **IMPORTANT FOR ANY AI AGENT / DEVELOPER READING THIS:**
> This repository was migrated from `C:\Users\aryan\Desktop\GuardedMarketsAI` to `C:\Users\aryan\Desktop\Folders\Projects\GuardedMarkets\AI`.
> **DO NOT RESET, RE-AUDIT, OR REFACTOR FROM SCRATCH.** Read this document to understand the entire architecture, philosophy, complete history, and the exact last task completed so you can continue immediately.

---

## 1. Executive Summary & Core Product Philosophy

**GuardedMarketsAI** is a **Windows-native AI Student and Trading Assistant** built on a strict **Screen-First, Teacher-Taught Cognitive Model**.

### The Core Philosophy (Non-Negotiable)
The AI is **NOT** pre-programmed with canned trading strategies, indicators, or textbook market assumptions:
- ❌ The AI does **NOT** assume 5M = scalping, 15M = intraday, or 4H = higher timeframe.
- ❌ The AI does **NOT** assume support means buy, resistance means sell, or liquidity sweep means reversal.
- ❌ The AI has **NO** hardcoded demo trade setups, forced biases (`BIAS: UNDEFINED` by default), or fabricated rules.

**How It Actually Works:**
1. The AI behaves like a human student sitting beside a master trader watching their screen.
2. The teacher teaches using real screen interaction: speaking, pointing with the cursor, and drawing zones on the chart.
3. The multimodal pipeline transcribes speech (via local `faster-whisper`), detects visual chart entities, zones, and cursor movements (via PyAV / NumPy), and fuses them using temporal sliding windows and deictic resolution (*"from here"* &rarr; Support Zone Box).
4. An 8-pass **Teaching Logic Engine** extracts grounded **Teaching Claims**, **State Transition Sequences**, and **Falsifiable Hypotheses** into SQLite via Prisma.
5. The **Windows Desktop Assistant** floats persistently on top of the trader's screen as a persistent ChatGPT-style desktop pet / floating widget box, observing the live screen and offering real-time reasoning or asking honest student questions.

---

## 2. The Exact Last State & Last Task Completed

### Last Task Completed: Phase 17 — Persistent Desktop Pet Floating Assistant Window

In the most recent session, we resolved the desktop floating assistant window implementation:

| Previous Flaw | Root Cause | Implemented Solution |
| :--- | :--- | :--- |
| **Window dropped behind other apps** | Electron spawned a 1920×1080 full-screen transparent canvas with `setIgnoreMouseEvents(true, { forward: true })`. Windows DWM demoted it behind active/maximized apps. | Converted to a **dedicated widget-sized window (`460×640 px`)** positioned at screen top-right with `alwaysOnTop: true, 'floating', 1`. |
| **Window disappeared on click outside** | Losing focus demoted z-order in DWM or triggered hide-on-blur. | Implemented **`VISIBLE ≠ FOCUSED`**: On blur, the window re-asserts `alwaysOnTop(true, 'floating', 1)` without stealing focus. Users click and type into Chrome, TradingView, or VS Code normally while the assistant stays floating above them. |
| **Invisible / Blank Window Glitch** | Windows DirectComposition has known compositor issues with CSS `backdrop-filter: blur(...)` inside Electron transparent windows. | Removed `backdrop-blur`, configured solid dark theme (`bg-[#090B0F]`, `border-white/20`), and set `transparent: false` so it renders 100% reliably on all Windows GPUs. |
| **Taskbar Absence** | `skipTaskbar: true` made the app invisible in the Windows taskbar. | Changed to `skipTaskbar: false`. **TradingAI** is visible and selectable in the Windows Taskbar. |
| **Outdated `%APPDATA%` SQLite DB** | Production Electron instances cache SQLite in `%APPDATA%\guarded-markets-ai\database\dev.db`. An old DB from Sept 20 lacked newer tables (`BrainVersion`, `TeachingClaim`, etc.). | Updated `electron/main.js` to automatically copy/sync the latest database schema if newer than the cached user DB. |
| **Process Crash on Window Close** | `app.on('window-all-closed', (e) => e.preventDefault())` crashed because `e` is undefined in Electron. | Fixed handler to keep background system tray alive without throwing. |

### Current Build & Packaging Status
- **TypeScript**: `npx tsc --noEmit` &rarr; **0 errors**.
- **Next.js**: `npm run build` &rarr; **36/36 routes compiled successfully**.
- **Windows Executable**: `dist/win-unpacked/TradingAI.exe` built and verified running.
- **Windows Installer**: `dist/TradingAI-Setup.exe` (and copied to `public/TradingAI-Setup.exe` for web download) built via NSIS (`electron-builder`).

---

## 3. Complete Evolutionary History (Phases 1 through 17)

### Phase 1: Media Processing Foundation
- Integrated `fluent-ffmpeg` and verified system FFmpeg (v9.0.1).
- Built `src/lib/services/mediaProcessor.ts` and `src/lib/services/processingJob.ts` for automated audio track extraction (16kHz mono WAV) and video frame extraction at 5s intervals.

### Phase 2 & 3: Eliminating Mock Providers
- Rewrote `src/lib/providers/speech/index.ts` and `src/lib/providers/vision/index.ts`.
- Removed all hardcoded/demo transcripts and mock chart returns. Added real providers: Gemini 2.0 Flash (`@google/genai`), OpenAI Whisper/GPT-4o, and honest `NOT_CONFIGURED` fallbacks.

### Phase 4, 5, 6: Real Teaching Ingestion Pipeline
- Overhauled `src/lib/services/teachingIngestion.ts`.
- Added Prisma models: `VideoFrame`, `TeachingSegment`, `processingStage`, `processingProgress`, `diagnostics`.
- Built live SSE/polling API endpoints: `/api/lessons/[id]/status`, `/api/lessons/[id]/transcript`, `/api/lessons/[id]/timeline`.

### Phase 7 & 8: Teacher Workspace UI Overhaul
- Rebuilt `/training` dashboard: real progress bars (0%–100%), full interactive transcript with clickable timestamps jumping video playback, and keyframe inspection.
- Zero TypeScript errors; clean Next.js production builds.

### Phase 9: Local Faster-Whisper Architecture
- Created Python 3.12 `.venv` with `faster-whisper`, `ctranslate2`, `onnxruntime`, `av`, and `tokenizers`.
- Downloaded and cached `Systran/faster-whisper-small` in `./storage/models/whisper/`.
- Built hardware detector & transcriber script (`scripts/transcribe_whisper.py`) running quantized CPU transcription (~18s for 01:51 video, 98.4% coverage).

### Phase 10: Real Visual Perception, Temporal Fusion, & 9-Layer Debug Inspector
- Built deterministic Python perception engine (`scripts/perceive_frames.py`) using PyAV and NumPy.
- Detects chart regions, financial banners, cursor motion centroids, and price levels/zones (e.g., Support Zone `80,225–80,305`, Resistance Zone `80,520–80,570`).
- Built `TemporalFusionService` (`src/lib/services/temporalFusion.ts`) linking spoken phrases to on-screen objects.
- Built 9-Layer Debug Inspector (`/debug/teaching-session/[id]`) and `FrameInspectorModal.tsx`.

### Phase 11: Multi-Pass Teaching Logic Engine & Auditable Falsifiability Layer
- Defined Semantic Cognitive Models in `src/lib/types/cognitive.ts`: `TeachingClaim`, `SemanticEntity`, `SemanticRelationship`, `StateTransitionSequence`, `SessionMemory`.
- Added `TeachingClaim` model to `prisma/schema.prisma`.
- Implemented 8-pass `TeachingLogicEngine` (`src/lib/services/teachingLogicEngine.ts`) with sliding temporal context windows and deictic resolution (*"from here"* &rarr; Support Box).
- Built `WhyDidAIThinkThatModal.tsx` for complete step-by-step auditability and falsifiability analysis.
- Overhauled "What I Understood" tab in `/training` with categorized claims, state transition step diagrams, and honest reporting (0 fake rules invented).

### Phase 12: Adaptive Learning & Unified Knowledge Brain
- Added `BrainVersion`, `AdaptiveQuestion`, `QuestionAttempt`, `ConceptMastery` Prisma models.
- Built `CanonicalBrainService` (`src/lib/services/canonicalBrainService.ts`) for unified snapshot management, exam generation, and mastery tracking.
- Created `/brain` dashboard with visual mastery bars and `/knowledge/graph` with interactive SVG knowledge topology.

### Phase 13: Scope-Limited Reasoning & Provenance Engine
- Replaced forced long/short bias with scope-limited evaluation: `BIAS: UNDEFINED` unless explicitly warranted by teacher rules.
- Implemented `KnowledgeProvenanceEngine` (`src/lib/services/knowledgeProvenanceEngine.ts`) and `WhyProvenanceModal.tsx`.

### Phase 14: Screen-First Teaching AI & Top-Down Procedure Reasoning
- Created `ScreenPerceptionEngine` (`src/lib/services/screenPerceptionEngine.ts`) and `/api/screen/perceive`.
- AI reasons dynamically based on what is perceived on screen:
  1. **Procedure Active**: Taught methodology matches active market conditions.
  2. **Level Monitoring**: Price is approaching a teacher-drawn level.
  3. **Observing**: Untaught timeframe or context &rarr; student asks honest clarifying question.

### Phase 15 & 16: Standalone Windows App & Installer
- Decoupled into two modes:
  - **Teacher Workstation**: Web dashboard for lesson upload, review, exam, and brain curation.
  - **Student Desktop App**: Standalone Windows executable running background capture and floating assistant.
- Configured NSIS packaging via `electron-builder.json` producing `dist/TradingAI-Setup.exe` (307 MB).

### Phase 17: Persistent Desktop Pet Floating Assistant Window
- Replaced full-screen 1920×1080 canvas with dedicated `460×640` floating tool window.
- Non-stealing topmost re-assertion on blur (`alwaysOnTop: true, 'floating', 1`).
- Native titlebar window drag via `-webkit-app-region: drag`.
- Fixed `%APPDATA%` database schema synchronization.
- Removed Windows DWM compositor transparency glitches.

---

## 4. Architecture & Technology Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        WINDOWS DESKTOP WORKSPACE                       │
│                                                                        │
│   ┌───────────────────────────────┐   ┌────────────────────────────┐   │
│   │     Guarded AI Assistant      │   │    Teacher Workstation     │   │
│   │     (Persistent 460x640 Box)  │   │     (Dashboard / Web)      │   │
│   │  - Always-on-top floating     │   │  - Video Upload & Ingest   │   │
│   │  - Screen context & price     │   │  - Multimodal Transcript   │   │
│   │  - Active procedures / zone   │   │  - Candidate Knowledge     │   │
│   │  - Student questions          │   │  - 9-Layer Debug Inspector │   │
│   │  - Auditable [WHY] provenance │   │  - Adaptive Exam & Brain   │   │
│   └───────────────┬───────────────┘   └─────────────┬──────────────┘   │
│                   │                                 │                  │
│                   ▼                                 ▼                  │
│         [ Electron Main Process (electron/main.js) ]                   │
│         - Tray, Hotkeys (Ctrl+Shift+A/T/I/H), Screen Capture Loop      │
│         - Embedded Local Production Next.js Engine                     │
│                                   │                                    │
│                                   ▼                                    │
│         [ Next.js API Routes (src/app/api/...) ]                       │
│         - /api/screen/perceive                                         │
│         - /api/overlay/state                                           │
│         - /api/lessons/[id]/...                                        │
│         - /api/brain/...                                               │
│                                   │                                    │
│              ┌────────────────────┴────────────────────┐               │
│              ▼                                         ▼               │
│   [ SQLite (prisma/dev.db) ]                [ Python 3.12 .venv ]      │
│   - Lessons & VideoFrames                   - faster-whisper (small)   │
│   - TeachingClaims & Triples                - PyAV & NumPy perception  │
│   - StateTransitions & Mastery              - Keyframe geometry        │
└────────────────────────────────────────────────────────────────────────┘
```

### Technology Breakdown
- **Runtime**: Node.js (v20+), Python 3.12 (`.venv` with PyAV, faster-whisper, NumPy)
- **Frontend**: Next.js 14.2 (App Router), React 18, Tailwind CSS, Lucide React
- **Desktop**: Electron 31, `electron-builder` 24 (NSIS installer)
- **Database**: SQLite with Prisma ORM 5.22 (`prisma/schema.prisma`)
- **Media Engine**: FFmpeg (system binary), `fluent-ffmpeg`
- **Speech Recognition**: Local `faster-whisper-small` (primary, ~18s quantized CPU), `@google/genai` (fallback), OpenAI Whisper (fallback)
- **Visual Perception**: Deterministic frame color clustering & geometry segmentation (`scripts/perceive_frames.py`), Gemini 2.0 Flash Vision (fallback)

---

## 5. Critical Files Sitemap

| Path | Purpose |
| :--- | :--- |
| `electron/main.js` | Main Electron process: window lifecycle, system tray, global hotkeys, embedded Next.js server, desktop capturer loop, and DB schema sync. |
| `electron/preload.js` | Secure context bridge exposing `window.electronAPI`. |
| `src/app/overlay/page.tsx` | The floating assistant desktop pet UI: draggable titlebar, live perception bar, procedure status, observing prompt, and level cards. |
| `src/components/layout/AppShell.tsx` | Root shell routing: renders full app layout for dashboard and solid borderless container for `/overlay`. |
| `src/components/overlay/WhyProvenanceModal.tsx` | Auditable provenance modal explaining why the AI holds an analysis, its source lesson, and falsifiability rules. |
| `src/lib/services/screenPerceptionEngine.ts` | Analyzes live incoming screen captures to extract symbols, timeframes, active prices, and chart layout. |
| `src/lib/services/canonicalBrainService.ts` | Evaluates live screen context against stored teacher procedures, levels, and claims to output student reasoning. |
| `src/lib/services/teachingIngestion.ts` | 8-stage multimodal teaching video processing pipeline. |
| `src/lib/services/teachingLogicEngine.ts` | 8-pass semantic reasoning engine extracting claims, deictic references, and state transitions. |
| `scripts/transcribe_whisper.py` | Local Python script running `faster-whisper` on audio files with timestamped segment output. |
| `scripts/perceive_frames.py` | Local Python script extracting visual geometry, zones, and cursor coordinates from video frames. |
| `prisma/schema.prisma` | Database schema: `Lesson`, `VideoFrame`, `TeachingSegment`, `TeachingClaim`, `BrainVersion`, `AdaptiveQuestion`, etc. |
| `electron-builder.json` | NSIS Windows installer configuration. |

---

## 6. How to Run, Test, and Build

### Development Mode (Web Only)
```powershell
npm run dev
# Opens on http://localhost:3000 (or 3002)
```

### Development Mode (Desktop App)
```powershell
npm run electron:dev
# Launches Electron attached to local Next.js server
```

### Full Production Build
```powershell
npm run build
# Runs prisma generate and compiles Next.js production bundle
```

### Package Windows Desktop App & Installer
```powershell
npm run pack:win
# Builds unpacked app in dist/win-unpacked/TradingAI.exe
# Builds Windows installer in dist/TradingAI-Setup.exe
```

### Direct Executable Test (No Install Needed)
```powershell
Start-Process "dist\win-unpacked\TradingAI.exe"
```

---

## 7. Global Hotkeys Reference

| Hotkey | Action |
| :--- | :--- |
| `Ctrl + Shift + A` | Toggle floating assistant overlay visibility |
| `Ctrl + Shift + T` | Toggle desktop teaching mode (start/stop recording session) |
| `Ctrl + Shift + H` | Collapse / Expand the floating assistant card |
| `Ctrl + Shift + I` | Toggle pass-through interaction mode |

---

## 8. Next Steps for Upcoming Sessions

1. **Live Chart Verification**:
   - Run `dist\win-unpacked\TradingAI.exe` side-by-side with TradingView on your Windows screen.
   - Confirm that dragging, focusing other windows, and hotkeys (`Ctrl+Shift+A`, `Ctrl+Shift+H`) perform smoothly.
2. **Interactive Live Teaching**:
   - Use `Ctrl+Shift+T` to trigger a live teaching session, speak into your microphone while pointing at levels on TradingView, and verify the ingestion pipeline processes the session into new `TeachingClaim` records.
3. **Adaptive Question Generator**:
   - Practice the Adaptive Exam in `/brain` to verify student question generation against the newly ingested claims.
