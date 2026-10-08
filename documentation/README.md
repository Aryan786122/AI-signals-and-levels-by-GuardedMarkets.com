# GuardedMarketsAI — Personal Trading AI Student & Market Analyst

> **A local-first personal AI trading system that learns trading directly from your teaching videos, voice explanations, chart examples, rules, exceptions, corrections, and scenario-based demonstrations.**

---

## What is GuardedMarketsAI?

GuardedMarketsAI is **NOT** a generic retail chatbot. It is **NOT** an automated trading bot. It is **NOT** a simple document RAG wrapper.

Instead, GuardedMarketsAI behaves like a **diligent trading student that you personally teach**:

1. **You teach concepts & setups** through short videos, audio recordings, or transcripts.
2. **You explain why a setup is valid** and why similar-looking situations are invalid.
3. **You can contradict or refine** something you taught earlier; the AI student harmonizes the knowledge using hierarchy, exceptions, and context rather than blindly overwriting or ignoring history.
4. **The AI watches your chart or screen continuously** via user-controlled screen capture with client-side pixel diffing.
5. **It recognizes developing scenarios** using everything you have taught it.
6. **It tells you when a potential setup is forming**, and when satisfied, proposes Entry, SL, and TP according to your taught methodology.
7. **It explains WHY** it reached that conclusion and **WHAT CHANGED** in its interpretation.
8. **It distinguishes between**:
   - `OBSERVATION`
   - `SETUP_FORMING`
   - `SETUP_CONFIRMED`
   - `TRADE_CANDIDATE`
   - `INVALID_SETUP`
   - `WAIT`
   - `NO_TRADE`

> [!IMPORTANT]
> **Safety Protocol**: Live trade execution and real-money broker order placement are strictly disabled at this stage. The system focuses on pedagogical mastery, explainable reasoning, and continuous market analysis.

---

## Core Features

- **Training Workspace**: Upload 1–5 minute teaching videos (.mp4, .mov, .webm) or voice audio. Scrub through videos, extract concepts, base conditions, exceptions, and positive/negative examples, and review them before permanent approval.
- **Relational Knowledge Engine**: 22 domain entities modeling Concepts, Rules, Atomic Conditions, Exceptions, Examples, Counterexamples, and Conflicts.
- **Contradiction Adjudicator**: When teaching evolves, the AI identifies whether a new statement is an **Exception**, a **Supersession**, or a **Separate Setup** without ever silently destroying historical knowledge.
- **Interactive Knowledge Graph**: Canvas/SVG network graph exploring connected trading concepts, rules, exceptions, and linked lessons.
- **Data-Driven Scenario Engine**: Sequence builder supporting `AND`, `OR`, `NOT`, `IF`, `THEN`, `EXCEPT`, and `UNLESS` operators.
- **Market Analysis Terminal**: High-density dark interface with live/historical candlestick charts, visual annotations (Support, Resistance, Entry, SL, TP), and auditable "WHY" & "WHAT CHANGED" panels.
- **Screen Monitor**: Client-side canvas pixel diffing to monitor TradingView or chart windows without wasteful continuous AI token calls.
- **Replay Lab**: Incremental candle replay without future lookahead, logging the step-by-step evolution of the AI's mind.
- **Exam Mode**: Test the AI with unseen scenarios; grade its decisions (`CORRECT`, `PARTIALLY CORRECT`, `WRONG`), and persist teacher corrections into memory.
- **AI Student Interrogator**: Grounded chat widget allowing you to interview your student about everything it has learned.

---

## Quick Start (Local PC)

### Prerequisites
- Node.js v18+ (tested on Node v24)
- npm v9+

### 1. Clone & Install
```bash
git clone <repo-url> GuardedMarketsAI
cd GuardedMarketsAI
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*Note: External AI API keys (Gemini, OpenAI, Anthropic) are completely optional. Out of the box, GuardedMarketsAI runs with its local deterministic reasoning engine.*

### 3. Initialize Database & Seed Starter Knowledge
```bash
npm run prisma:push
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation Index
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — High-level system architecture and data flows.
- [`DATABASE.md`](./DATABASE.md) — Complete relational database schema & pgvector guide.
- [`AI_ARCHITECTURE.md`](./AI_ARCHITECTURE.md) — Multi-provider abstraction and prompt structuring.
- [`KNOWLEDGE_ENGINE.md`](./KNOWLEDGE_ENGINE.md) — Hierarchy, conditional logic, and contradiction resolution.
- [`TRAINING_PIPELINE.md`](./TRAINING_PIPELINE.md) — Video ingestion, transcription, and teacher approval loop.
- [`SCREEN_ANALYSIS.md`](./SCREEN_ANALYSIS.md) — Client-side capture, change detection, and vision analysis.
- [`ENVIRONMENT.md`](./ENVIRONMENT.md) — Configuration variables and model endpoints.
