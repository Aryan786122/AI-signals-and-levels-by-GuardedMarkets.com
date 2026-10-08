# GuardedMarketsAI — Knowledge Engine & Contradiction Resolution

## 1. Hierarchy & Conditional Knowledge

Trading methodologies are not simple unconditional statements like `Breakout = Buy`. GuardedMarketsAI models rules as conditional trees:

```
BREAKOUT (Concept)
├── Base Condition: Candle body close > Resistance level
│   ├── Valid: Normal candle acceptance (Range ≤ 2.5x average range)
│   └── Invalidation: Wick only, closing back inside range
│
└── Enforced Exception: Excessive Candle Extension
    ├── Condition: Candle range > 2.5x average range
    └── Action: AVOID IMMEDIATE ENTRY / WAIT FOR RETEST
```

---

## 2. Priority Hierarchy (Section 14)

Not all statements carry equal authority:
1. `CORE_RULE`: Inviolable baseline (e.g., "Always require candle body close").
2. `STRONG_RULE`: High-weight structural condition.
3. `CONDITIONAL_RULE`: Rules applying under specific session or timeframe criteria.
4. `PREFERENCE`: Discretionary execution bias.
5. `OBSERVATION`: Incidental comment; not converted into a universal rule.
6. `EXAMPLE`: Grounding historical reference.

---

## 3. Contradiction Resolution & Versioning (Section 12 & 13)

When the teacher presents new teaching that seemingly conflicts with previous statements (e.g., Lesson 1: "Take breakout after close", Lesson 20: "Avoid breakout if candle closes too high"):

The AI student **never says**: *"User contradicted himself."*

Instead, the **Contradiction Detector** analyzes the relationship and surfaces an adjudication modal with 4 explicit teacher actions:
1. **[Accept Interpretation / Add Exception]**: Attaches Rule B as a contextual exception to Rule A.
2. **[Mark Rule B as Newer / Superseding]**: Updates Rule A to status `SUPERSEDED`, generates a `KnowledgeVersion` audit record, and activates Rule B.
3. **[Keep Separate]**: Retains both rules as independent setups for distinct market contexts.
4. **[Edit Relationship]**: Custom teacher annotation.

Historical knowledge is **never destroyed**.
