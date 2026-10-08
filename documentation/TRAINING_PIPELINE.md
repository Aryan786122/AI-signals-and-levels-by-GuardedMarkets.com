# GuardedMarketsAI — Training Pipeline & Video Ingestion

## 1. The Pedagogical Feedback Loop (Section 30)

The core product loop operates as follows:

```
TEACH (Video / Audio / Voice Transcript)
  ↓
EXTRACT (AI identifies Concepts, Rules, Conditions, Exceptions)
  ↓
REVIEW (Teacher inspects extraction draft in Training Workspace)
  ↓
APPROVE (Verified rules permanently enter active knowledge base)
  ↓
TEST (Replay Lab / Screen Monitor / Exam Mode)
  ↓
CORRECT (Teacher grades mistake, recording learning correction)
  ↓
EVOLVE (Knowledge base updates with new exceptions or supersessions)
```

---

## 2. Ingestion Flow (Section 8)

1. **Upload**: Accepts `.mp4`, `.mov`, `.webm`, or direct voice recordings up to 100MB.
2. **Local Storage**: Files are sanitized and stored in `./storage/videos/`.
3. **Speech-to-Text**: Generates timestamped `TranscriptSegment` records via Whisper or local audio parser.
4. **AI Parsing**:
   - Primary Concept extraction.
   - Atomic conditions extraction (field, operator, threshold).
   - Negative exception extraction.
   - Positive examples and counterexamples extraction.
   - Contradiction detection against active rules.
5. **Teacher Approval**: Rules remain in `DRAFT` / `REVIEW_PENDING` until explicitly approved.
