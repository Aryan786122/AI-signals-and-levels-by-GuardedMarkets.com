# GuardedMarketsAI — Environment & Configuration Reference

## Environment Variables (.env)

```env
# Database Connection (SQLite by default; or PostgreSQL connection string)
DATABASE_URL="file:./dev.db"

# Active AI Provider: "local" | "gemini" | "openai" | "anthropic" | "ollama"
DEFAULT_AI_PROVIDER="local"
DEFAULT_AI_MODEL="gemini-2.0-flash"

# Optional External API Keys (Leave empty to use local deterministic engine)
GEMINI_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# Ollama Endpoint (for local open models)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2"

# Media Storage Directory (Relative to root or absolute path)
STORAGE_DIR="./storage"

# App State
PORT=3000
NODE_ENV="development"
DEBUG_MODE="true"
```

## Security Best Practices (Section 39)
- External API keys are read server-side only in Route Handlers.
- Next.js does NOT expose variables without `NEXT_PUBLIC_` to client-side bundles.
- File uploads are sanitized and restricted to media MIME types.
