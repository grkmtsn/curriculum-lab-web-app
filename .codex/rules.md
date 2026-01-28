# Codex Agent Ruleset — Curriculum Lab (Detailed MVP Specification)

This document defines **strict rules and implementation guidance** for a Codex Agent
working on the Curriculum Lab MVP.  
The project starts **from scratch** and must follow these rules unless explicitly overridden.

---

## 1. Product & Business Context

### 1.1 Product Vision
Curriculum Lab is an **AI-powered daily activity generation platform** for preschools,
kindergartens, and after-school programs.

Core value:
- Reduce daily planning burden
- Provide pedagogy-driven, age-appropriate activities
- Deliver structured, reliable outputs (not chat-style AI)

### 1.2 MVP Definition
The MVP proves **one thing only**:
> “Can we reliably generate a high-quality activity for *today* that teachers can actually run?”

Anything not directly supporting this goal is **out of scope**.

---

## 2. Non‑Negotiable Product Rules

These rules MUST be enforced at all times.

- ❌ No authentication (email/password/magic link)
- ✅ Access only via `pilot_token`
- ❌ No free-form chat
- ❌ No markdown or text responses from backend
- ✅ Backend returns **JSON only**
- ✅ Output language is **English only**
- ✅ Two-stage AI generation:
  1. Outline (planning)
  2. Final activity (execution-ready)
- ✅ Limited theme set (7 themes)
- ✅ Rate-limited per institution per day

If a feature conflicts with these rules, **do not implement it**.

---

## 3. Technology Stack (Authoritative)

Codex Agent must use the following stack unless explicitly instructed otherwise.

### 3.1 Core Stack
- **TanStack Start** (full-stack routing + server functions)
- **TypeScript** with:
  - `strict: true`
  - `noUncheckedIndexedAccess: true`

### 3.2 UI & Styling
- Tailwind CSS
- shadcn/ui components (optional but preferred)

### 3.3 Backend & Data
- PostgreSQL
- Prisma ORM
- Zod for runtime validation and contracts

### 3.4 AI / LLM
- OpenAI Responses API
- Default model: `gpt-4.1`
- Configurable via environment variables

### 3.5 Tooling
- pnpm
- ESLint + Prettier
- Vitest

---

## 4. Repository & Project Setup Rules

### 4.1 Package Manager
- pnpm only

### 4.2 Required Scripts
`package.json` MUST include:
- dev
- build
- start
- lint
- typecheck
- test
- db:migrate
- db:generate

### 4.3 Environment Management
- `.env` is never committed
- `.env.example` must be kept up to date

Required variables:
- DATABASE_URL
- OPENAI_API_KEY
- OPENAI_MODEL_STAGE1
- OPENAI_MODEL_STAGE2
- RATE_LIMIT_PER_DAY
- MAX_RETRY_STAGE1
- MAX_RETRY_STAGE2
- CONTENT_LANGUAGE=en
- PILOT_TOKEN_SALT
- NOVELTY_THRESHOLD

---

## 5. Pedagogy as Configuration (Critical Rule)

Pedagogical logic MUST live in JSON config files, never hardcoded in prompts.

### 5.1 Config Files
Located under `/config`:
- age_groups.json
- themes.json
- activity_templates.json
- safety_rules.json

### 5.2 Config Loading Rules
- Load once on server startup
- Cache in memory
- Fail-fast on invalid config
- No silent fallbacks

---

## 6. Data Model (Minimum Required)

### institutions
- id (uuid)
- name (nullable)
- city
- createdAt

### pilot_tokens
- tokenHash (hashed, never plaintext)
- institutionId
- expiresAt
- revokedAt
- createdAt

### generations
- id
- institutionId
- requestPayload (json)
- outlineJson (json)
- finalJson (json)
- modelStage1
- modelStage2
- latencyStage1Ms
- latencyStage2Ms
- validationPass
- errorCode
- regenerate
- noveltyRetryUsed
- createdAt

### feedback
- id
- generationId
- institutionId
- rating (up | down)
- comment
- createdAt

### rate_limits
- institutionId
- date
- count

---

## 7. API Contract Rules

### 7.1 Endpoint
POST `/api/generate-activity`

### 7.2 Request Validation (Zod)
Strictly validate:
- pilot_token
- age_group
- duration_minutes
- theme
- group_size
- optional fields only from enums

Invalid requests MUST fail before any AI call.

### 7.3 Response Rules
- JSON only
- No markdown
- No additional metadata outside schema

Standard success:
```json
{
  "schema_version": "activity.v1",
  "activity": { }
}
```

Standard error:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable explanation",
    "retryable": true
  }
}
```

---

## 8. Two‑Stage AI Orchestration

### 8.1 Stage 1 — Outline
Purpose:
- Plan before writing
- Enforce structure
- Reduce hallucinations

Rules:
- Outline JSON only
- Minimum steps/materials
- Safety checks mandatory
- Retry up to MAX_RETRY_STAGE1

### 8.2 Stage 2 — Final Activity
Purpose:
- Expand outline into execution-ready plan

Rules:
- Must strictly follow outline
- Must match schema exactly
- Retry up to MAX_RETRY_STAGE2

### 8.3 Gating Logic
Stage 2 MUST NOT run unless Stage 1 passes all checks.

---

## 9. Novelty & Regeneration

When `regenerate=true`:
- Activity must use a different core mechanic
- Avoid recent titles/concepts
- Similarity check against last N generations
- Max one extra retry

---

## 10. Rate Limiting

- Enforced per institution per calendar day
- Default limit: 10 generations/day
- Regenerate counts toward limit
- Hard fail when exceeded

---

## 11. Security Rules

- OpenAI API key server-only
- Pilot tokens hashed
- No sensitive data in logs
- CORS restricted

---

## 12. Observability

Must log:
- request_id
- institution_id
- stage timings
- retry counts
- validation failures

Metrics to support pilot decisions.

---

## 13. Testing Requirements

### Unit Tests
- Validation logic
- Rate limiting
- Token hashing
- Outline gating
- Final validation

### Integration Tests (Optional but Preferred)
- Full generate flow with mocked OpenAI

Typecheck must pass for any change.

---

## 14. Definition of Done (Backend)

Backend is MVP-ready when:
- Token-only access works
- Two-stage generation stable
- Strict JSON contract enforced
- Rate limits active
- Generation data persisted
- Logs & metrics available

---

## 15. Out of Scope (Explicit)
- User accounts
- Payments
- Parent dashboards
- Video content
- Mobile apps
