# GuardedMarketsAI Database Design & Relational Schema

## 1. Design Philosophy

Trading knowledge is fundamentally hierarchical and conditional. Flattening rules into unindexed text or pure vector blobs loses the crucial distinction between **Base Rules**, **Mandatory Conditions**, and **Exceptions**.

GuardedMarketsAI uses a strict relational model with 22 interconnected entities:

---

## 2. Core Entities & Relationships

| Entity | Purpose | Key Fields |
|---|---|---|
| `User` | Teacher profile | `email`, `role` |
| `Lesson` | Teaching session unit | `title`, `durationSec`, `videoUrl`, `status` |
| `LessonAsset` | Video, audio, keyframe assets | `assetType`, `filePath`, `fileSize`, `timestampSec` |
| `Transcript` | Complete transcribed text | `fullText`, `language`, `confidence` |
| `TranscriptSegment` | Timestamped speech chunks | `startTimeSec`, `endTimeSec`, `text` |
| `Concept` | Core trading concept | `name`, `slug`, `category`, `definition`, `importance` |
| `KnowledgeItem` | Unified knowledge record | `type`, `title`, `description`, `priority`, `status` |
| `Rule` | Base trading rule | `title`, `statement`, `priority`, `version`, `status` |
| `Condition` | Atomic conditional logic | `field`, `operator`, `threshold`, `isMandatory` |
| `Exception` | Conditional override | `name`, `description`, `overrideBehavior`, `conditionLogic` |
| `Setup` | Formal setup pattern | `name`, `direction`, `triggerCondition`, `riskRewardMin` |
| `Scenario` | Sequential market sequence | `name`, `marketContext`, `expectedAction`, `invalidationCondition` |
| `ScenarioCondition` | Logic node in scenario | `stepOrder`, `logicOp` (AND, OR, NOT, IF, THEN, EXCEPT, UNLESS) |
| `Example` | Positive verified trade setup | `market`, `timeframe`, `teacherDecision`, `teacherExplanation` |
| `CounterExample` | Negative false-setup | `market`, `timeframe`, `whyInvalid`, `teacherExplanation` |
| `Correction` | Teacher exam correction | `previousAiDecision`, `correctedDecision`, `explanation` |
| `KnowledgeRelation` | Graph directed edge | `fromId`, `toId`, `relationType` |
| `KnowledgeConflict` | Detected contradiction | `ruleAId`, `ruleBId`, `conflictType`, `status` |
| `KnowledgeVersion` | Historical rule audit log | `ruleId`, `version`, `statement`, `changeReason` |
| `Evaluation` | Examination session | `title`, `type`, `overallScore` |
| `EvaluationResult` | Per-question drill score | `aiDecision`, `actualDecision`, `status` (CORRECT, WRONG) |
| `AnalysisSnapshot` | Saved screen/market analysis | `marketState`, `setupStatus`, `entryPrice`, `stopLossPrice` |
| `AIResponse` | Auditable AI JSON log | `promptPayload`, `rawOutput`, `structuredOutput` |

---

## 3. Dual Engine Strategy: SQLite & PostgreSQL

### Local Development (Default)
- **Engine**: SQLite (`file:./dev.db`)
- **Setup**: Zero-install. Works immediately upon cloning.
- **Vectors**: Serialized float embeddings queried via in-memory cosine similarity.

### Production Environment (Containerized)
- **Engine**: PostgreSQL 16 with `pgvector`
- **Schema**: `prisma/schema.postgresql.prisma`
- **Docker Compose**: `docker-compose.yml` provides a ready-to-run container on port `5432`.
- **Vectors**: Native `vector(1536)` index for high-scale semantic retrieval.
