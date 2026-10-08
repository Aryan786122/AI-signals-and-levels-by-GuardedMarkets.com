# GuardedMarketsAI — Screen Monitor & Continuous Visual Analysis

## 1. Event-Driven Architecture (Section 22)

Continuously sending full-resolution screenshots to reasoning LLMs every 3 seconds is cost-prohibitive and slow. GuardedMarketsAI uses an event-driven tiered pipeline:

```
SCREEN CAPTURE (navigator.mediaDevices.getDisplayMedia)
  ↓
SAMPLE FRAME (Hidden Canvas downscaled to 160x90)
  ↓
PIXEL DIFF DETECTION (Compare luminance delta against previous frame)
  ↓
Meaningful change detected? (Diff ≥ Threshold, default 8%)
  ├── NO  → Continue monitoring (0 API cost, 0 latency)
  └── YES →
        ↓
    VISION / CANDLE ANALYSIS
        ↓
    KNOWLEDGE BASE RETRIEVAL (Active Rules & Exceptions)
        ↓
    STRUCTURED DEEP REASONING
        ↓
    EMIT UPDATE TO UI (Setup Status, Proposed Entry/SL/TP, "WHAT CHANGED?")
```

---

## 2. Safety & Transparency (Section 21)

- **User-Controlled**: Screen capture is initiated strictly via standard browser display picker (`getDisplayMedia`).
- **Zero Covert Background Monitoring**: Active visual indicators and capture streams are shown at all times.
- **Controls**: Full Pause, Resume, Stop, and Threshold adjustment controls directly in the UI.
