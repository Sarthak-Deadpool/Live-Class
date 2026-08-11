# TeacherConnect — System Study & Engineering Design Document
## Part 4 of 5: Security, Architecture Layout, Data Flow, Algorithms, Concurrency, Edge Cases

> Continues from Part 3. This part is where every rule from Parts 1–3 gets stress-tested against attackers, race conditions, and real-world failure modes.

---

## 27. Security Architecture (OWASP-mapped)

| OWASP category | Applies here as... | Mitigation |
|---|---|---|
| Broken Access Control | **The single highest-risk category for this project.** See §27.1 below — this is the one you specifically flagged | Ownership/membership re-checked server-side on every request, never inferred from URL params or client claims |
| Injection (NoSQL) | Mongoose query built from unsanitized user input (e.g., `{ [req.body.field]: value }` patterns, or operator injection like `{ $gt: "" }` submitted as a password field) | Zod schema validation rejects unexpected shapes before the value ever reaches a query; never spread raw `req.body` into a Mongoose filter |
| Cryptographic failures | Passwords, tokens | bcrypt (cost factor ≥ 10) for passwords, JWT signed with a strong secret (env-managed, rotated if ever exposed), HTTPS everywhere (enforced by hosting platform) |
| Insecure design | Skipping the trust-chain checks "just for now" during development and forgetting to add them back | This entire document exists to prevent that — see §50 |
| Security misconfiguration | Default CORS `*`, missing Helmet headers, verbose error stack traces in prod | `cors` locked to known frontend origin(s), `helmet()` middleware, `NODE_ENV=production` strips stack traces from error responses |
| Vulnerable/outdated components | Stale npm packages | `npm audit` periodically; not a one-time setup task |
| Auth failures | Weak password policy, no rate limiting on login, session fixation | §14's full lifecycle, rate limiting below |
| Data integrity failures | Trusting client-supplied state (e.g., a `role` or `status` field in a request body) | Server always derives sensitive fields from the authenticated session or current DB state, never accepts them as client input where it matters (§27.1) |
| Logging/monitoring failures | No audit trail for sensitive actions | §36 |
| SSRF | Not a major surface here (no user-controlled outbound URL fetching in MVP) | N/A for MVP, revisit if you add "import from URL" style features later |

### 27.1 Broken Access Control / IDOR — deep dive, because you specifically flagged this

**IDOR (Insecure Direct Object Reference)** happens when an endpoint identifies *which* record to act on using an ID the client supplies, but doesn't verify the *authenticated user* actually has rights to that specific ID. The classic exploit: change `/api/courses/64f.../students` to a different course ID in the URL and see another teacher's roster.

**Where this project is exposed to it, concretely**, and the mitigation for each:

- `GET /api/enrollments/course/:courseId` — a malicious teacher could try any `courseId`. **Mitigation**: after loading the course, compare `course.teacherId === req.user.id` before returning anything; if mismatch, 403 (don't even reveal whether the course exists — 404 is arguably *more* correct here than 403, to avoid confirming the ID is valid at all; a legitimate design choice worth making consciously — documented as **Assumption A6**, §56).
- `PATCH /api/classes/:id/mode` — already covered in §12's execution trace: ownership check is step 4, not optional, not "implied by role."
- `GET /api/attendance/student/:studentId` — a student could try another student's ID. **Mitigation**: this endpoint, for a `student`-role caller, should **ignore** any `studentId` param entirely and always use `req.user.id` — don't even trust it enough to compare-and-reject, just never read it from a student caller's request in the first place. Only a `teacher` role, further gated by course ownership, can query attendance for a specific student.
- `GET /api/resources/:id/download` — must verify the resource's `courseId` has an `ACTIVE` enrollment for `req.user.id` before minting the signed URL (§24) — the resource ID alone is not sufficient authorization even if it's an unguessable Mongo ObjectId (obscurity isn't authorization).
- `POST /api/courses` with a `teacherId` field in the body — **never read `teacherId` from the request body at all**; always set it from `req.user.id`. This class of bug (trusting a client-supplied owner/actor field) is arguably the single most common real-world IDOR variant and the easiest to prevent by just never parsing that field from input in the first place.

**The general defense pattern, repeated because it's the crux of the whole security model**: every handler that loads a document by ID must, before doing anything else with it, check that the *authenticated* user (never a client-supplied user reference) has a legitimate relationship to that document — ownership (`teacherId` match) or active membership (`Enrollment` lookup) — re-verified against **current** database state on every single request, never cached in a JWT claim, never assumed from a previous request in the same session.

### 27.2 Other items, briefly (each already touched on where relevant)

- **XSS**: sanitize any user-generated text that gets rendered to other users (§25); React's default JSX escaping helps a lot but doesn't cover `dangerouslySetInnerHTML` usage or any raw HTML you might accept.
- **CSRF**: mitigated primarily by `SameSite` cookie policy (§14); add double-submit token if you want defense in depth on state-changing cookie-authenticated endpoints.
- **Brute force / rate limiting**: `express-rate-limit` on `/api/auth/login` and `/api/auth/register` specifically (tighter limits) plus a general API-wide limiter (§3's NFR numbers).
- **JWT theft**: covered fully in §14 (short expiry, rotation, tokenVersion invalidation).
- **WebSocket authorization**: covered in §21 — auth happens at connection time, not assumed from the HTTP session that preceded it.
- **Room hijacking**: covered fully in §20 — structurally prevented by the token model, not just "hard to guess."
- **Clickjacking**: `helmet()`'s default `X-Frame-Options`/frame-ancestors CSP directive covers this; no reason your app should ever be iframed by a third party.

---

## 28. File Upload Security

- **Allowed MIME types**: explicit allowlist (`application/pdf`, `image/png`, `image/jpeg`, `image/webp`, and optionally `application/vnd.openxmlformats-officedocument.*` for docx/pptx) — check both the declared MIME type **and** sniff actual file bytes (magic numbers) server-side, since a client can lie about `Content-Type`.
- **Maximum file size**: enforce at the multipart-parsing layer (e.g., `multer` limits) before the whole file is even buffered into memory, not just after — an unbounded upload is a trivial DoS vector.
- **Filename sanitization**: never use the client-supplied filename directly as a storage key; generate your own (UUID + original extension, extension itself validated against the allowlist) to prevent path traversal (`../../etc/passwd`-style names) and storage-key collisions.
- **Virus scanning**: out of scope for MVP given solo-dev resourcing — documented as a known gap; if you later handle sensitive institutional data, integrating a scanning step (e.g., ClamAV or a cloud scanning API) before a file is served to other users becomes worth the cost.
- **Storage & access**: object storage (not the app server's disk — doesn't survive redeploys/scaling anyway), served via signed short-lived URLs per §24, never a permanently public bucket for anything that should be access-controlled.
- **Deletion**: soft-delete in DB (§9.7) + eventually purge from actual storage via a background job, not synchronously on the delete request (keeps the delete endpoint fast and doesn't block on a storage-provider round trip).

### Storage provider comparison (Cloudinary vs S3 vs R2)

| | Cloudinary | AWS S3 | Cloudflare R2 |
|---|---|---|---|
| Best for | Images (built-in transforms/optimization) | General-purpose, industry standard, deep IAM control | S3-compatible API, **zero egress fees** |
| PDF/docs | Supported but not its specialty | Native fit | Native fit |
| Cost model | Generous free tier, gets pricier at scale for non-image assets | Pay for storage + **egress** (can add up if students download resources a lot) | Pay for storage only, no egress charges — meaningfully cheaper for a resource-download-heavy education product |
| Solo-dev friction | Very low (SDK handles upload+transform+URL in one call) | Low-medium (well-documented, more IAM setup) | Low (S3-compatible, most S3 tooling works unmodified) |

**Recommendation**: **Cloudinary for images** (avatars, any inline images) because its automatic optimization/transformation is genuinely valuable and free-tier-friendly; **Cloudflare R2 for PDFs/notes/general resources**, specifically because of the egress-fee difference — a course resource system is inherently download-heavy (many students downloading the same PDF repeatedly), and R2's zero-egress model directly avoids the cost pattern that makes S3 expensive for exactly this use case. This is a genuine architectural choice, not just picking the newest option — worth recording in §51 (Part 5) as a Design Decision Record.

---

## 29. API Security (middleware stack)

```
app.use(helmet())                                  // security headers
app.use(cors({ origin: FRONTEND_URL, credentials: true }))  // locked origin, not '*'
app.use(express.json({ limit: '1mb' }))              // request size cap
app.use(generalRateLimiter)                          // e.g. 100 req/min/user
app.use('/api/auth/login', authRateLimiter)          // tighter, e.g. 10 req/min/IP
app.use('/api/auth/register', authRateLimiter)
// per-route: authMiddleware -> validationMiddleware -> controller
app.use(errorHandlingMiddleware)                      // last in chain, catches everything
```

**Logging**: log request method/path/status/duration/userId for every API call (structured JSON logs); **never log** request bodies containing passwords, tokens, or full JWTs — redact those fields explicitly in your logging middleware, don't rely on "we just won't look at that field."

---

## 30. Frontend Architecture

```
src/
  pages/          — route-level components (one per URL, composes components+hooks)
  components/     — reusable UI pieces (Button, CourseCard, RosterTable...), no business logic
  layouts/         — shared page shells (TeacherLayout, StudentLayout, AuthLayout)
  hooks/            — data-fetching + stateful logic (useCourses, useEnrollments, useLiveRoom)
  services/          — Axios API call definitions, one file per resource (courseService.js, enrollmentService.js...) — the ONLY place that knows API URLs/shapes
  store/              — Zustand stores for cross-cutting client state (auth user, socket connection, active notifications)
  utils/               — pure helper functions (date formatting, validation helpers)
  constants/            — enums mirrored from backend (enrollment statuses, session lifecycle values) — keep these as the single source of truth for magic strings used in JSX
```

**Why this split**: `services/` isolates all knowledge of "what the API looks like" so a backend contract change touches one file, not every component that happens to call `axios.get(...)` inline. `hooks/` isolates "how do I get and cache this data for a component" so components themselves stay close to pure rendering. This is a standard, uncomplicated separation — resist the urge to add Redux, a GraphQL layer, or a folder-per-feature micro-frontend structure for a solo-dev MVP; it would be solving problems you don't have yet (§50).

---

## 31. Backend Architecture

```
server/
  config/        — env loading, DB connection, LiveKit client config
  models/         — Mongoose schemas (one file per collection from §9)
  middleware/      — auth, validation, rate-limit, error-handler
  controllers/      — thin: parse req, call service, shape response
  services/          — business logic, state transitions (enrollmentService, classSessionService, liveRoomService, attendanceService)
  routes/             — Express routers, grouped exactly as in §12
  validators/          — Zod schemas, one per route group
  sockets/              — Socket.io connection handler + event handler modules, grouped by domain (classSocketHandlers, chatSocketHandlers)
  jobs/                  — background tasks: auto-complete overdue sessions, close stale attendance segments, notification retry
  constants/               — enums shared across models/services (mirrors the frontend constants, kept in sync manually or via a shared package if you later split into a monorepo)
  utils/                    — generic helpers (id generation, date math)
  server.js                  — composition root: wires config, DB, Express app, Socket.io, and starts listening
```

Every directory here maps directly to a layer already described in §13's route-design diagram — nothing here is speculative structure, it's the physical embodiment of the layered flow you already understand from Part 2.

---

## 32. Data Flow Analysis (representative traces)

### Login
```
User submits form → React (services/authService.login) → POST /api/auth/login
  → validationMiddleware(Zod) → controller → authService.login()
  → User.findOne({email}) → bcrypt.compare(password, hash)
  → sign access+refresh JWTs → set refresh cookie, return access token
  → React store (Zustand: setUser, setAccessToken) → redirect to dashboard
```

### Enrollment approval
```
Teacher clicks Approve → PATCH /api/enrollments/:id/approve
  → auth + ownership check (course.teacherId === req.user.id, via a join through Enrollment→Course)
  → enrollmentService.approve():
      - findOneAndUpdate filter{status:'REQUESTED'} (idempotency, same pattern as §18)
      - generate studentCourseId (atomic counter increment, §16)
      - create Notification doc
      - emit socket 'notification:new' to user:studentId
  → 200 response → React updates roster list state → UI shows "Active"
```

### Offline → Online conversion
Already fully traced in §18 — reused here as the canonical example of "REST mutation → socket fan-out → frontend reactive update."

### Join live class
Already fully traced in §7.2/§20 — REST token mint → LiveKit connect → attendance join-event.

*(Upload resource follows the identical shape: validate → authorize by course ownership → upload to storage → create DB record → socket-notify enrolled students → frontend list updates. Not re-traced in full here since it's a direct application of patterns already shown twice.)*

---

## 33. Algorithms

### 33.1 Student ID generation
```
Input: courseId
Precondition: called only within enrollmentService.approve(), inside the approval transaction
Steps:
  1. counter = Counters.findOneAndUpdate({ _id: `course:${courseId}` }, { $inc: { seq: 1 } }, { upsert: true, new: true })
  2. studentCourseId = `${course.shortCode}-${String(counter.seq).padStart(4, '0')}`
Output: unique, human-readable string
Complexity: O(1)
Edge cases: first enrollment in a course (upsert creates the counter at seq=1); concurrent approvals (the $inc is atomic, no collision possible)
```

### 33.2 Enrollment approval (already shown as pseudocode-adjacent in §32; formalized here)
```
Input: enrollmentId, requestingTeacherId
Preconditions: enrollment exists, status=REQUESTED, requestingTeacherId owns the course
Steps:
  1. load enrollment, join to course for ownership check
  2. if not owner: fail 403
  3. atomic findOneAndUpdate filter{_id, status:'REQUESTED'} → set status:'ACTIVE', studentCourseId, decidedAt, decidedBy
  4. if update matched nothing: fail 409 (already decided by a concurrent request, or someone withdrew the request in the meantime)
  5. create Notification, emit socket
Output: updated enrollment
Failure conditions: race with a simultaneous reject (only one wins, same atomic-filter idiom as §18)
```

### 33.3 Course membership verification (used everywhere as a helper)
```
Input: userId, courseId
Steps: Enrollment.exists({ studentId: userId, courseId, status: 'ACTIVE' })
Output: boolean
Complexity: O(1) with the index from §11
```

### 33.4 Offline→online conversion
Fully specified in §18.

### 33.5 Live-room authorization + token generation
Fully specified in §20 (steps 2-5).

### 33.6 Attendance calculation
Fully specified in §22.

### 33.7 Reconnection handling
```
Client detects LiveKit disconnect (connection-state event)
  → attempt automatic reconnect with existing token, a few times, short backoff
  → if token has expired or reconnect fails repeatedly:
      re-run the full join flow from §7.2 (fresh REST authorization + fresh token)
  → this naturally re-validates enrollment/session state on every reconnect, which is desired behavior, not just a fallback
```

### 33.8 Duplicate enrollment prevention
Fully specified via the partial unique index in §11 + the pre-check in §17.

### 33.9 Notification delivery
```
Input: event context (type, recipients, payload)
Steps:
  1. bulk-insert Notification docs (one per recipient) within the same service call as the triggering state change
  2. for each recipient currently connected: emit socket 'notification:new'
  3. for high-value types only: enqueue email (fire-and-forget, don't block the response on email send)
Failure conditions: email send failure does not roll back the DB notification or the underlying state change (§18's failure-handling philosophy applied generally)
```

### 33.10 Teacher participant removal (live)
```
Input: sessionId, targetStudentId, requestingTeacherId
Steps:
  1. verify requestingTeacherId owns session
  2. call LiveKit server API: removeParticipant(roomName, targetStudentId)
  3. optionally also set enrollment status if this is a disciplinary removal (business decision — "remove from this one class" vs "remove from the course" are different actions and should be two different endpoints, not conflated)
  4. emit socket 'student:removed' to that student's personal channel
Output: 200 ack
Edge case: student already disconnected when remove is called — LiveKit call is a no-op/harmless in that case
```

### 33.11 Session lifecycle management
```
Background job, runs every N minutes:
  find ClassSession where lifecycle='LIVE' and scheduledEnd + gracePeriod < now()
    → auto-transition to COMPLETED, close open attendance segments (§22)
  find ClassSession where lifecycle='SCHEDULED' and mode='ONLINE' and scheduledEnd + gracePeriod < now() and never started
    → auto-transition to CANCELLED (teacher never started it — don't leave it dangling forever)
```

---

## 34. Concurrency and Race Conditions

| Scenario | Risk | Prevention |
|---|---|---|
| Two simultaneous enrollment approvals (e.g. teacher double-clicks) | Double notification, wasted writes | Atomic `findOneAndUpdate` with state filter (§33.2) — second request's filter fails to match, returns 409 harmlessly |
| Teacher clicks "Switch Online" twice | Duplicate room creation, duplicate notifications | Same atomic-filter idiom, §18 |
| Teacher starts class twice | Duplicate `liveRoom.startedAt` overwrite, confusing state | `findOneAndUpdate` filtered on `lifecycle: 'SCHEDULED'`/`'ONLINE_PENDING'` transitioning to `'LIVE'` — second attempt no-ops |
| Student joins twice (two tabs) | Overlapping attendance segments | LiveKit single-active-connection-per-identity setting (§22) prevents this at the media layer; attendance join-handler can also defensively check for an already-open segment before creating a new one |
| Teacher ends class while a student is mid-join | Student's token request happens between "session was LIVE" and "session just became COMPLETED" | The token-mint endpoint re-checks `lifecycle` at request time (not cached) — if it's already COMPLETED, the join attempt correctly fails with a clear error rather than connecting to a room that's about to be torn down |
| Notification generated twice (e.g., a retry job re-processing the same trigger) | Duplicate inbox spam | Idempotent notification creation — check-then-insert on a natural key (event type + recipient + source entity ID) if you add a retry job; not needed for the synchronous fan-out path since that only runs once per real state change |
| Enrollment approved and rejected "simultaneously" from two open teacher tabs | Same class of problem as row 1 | Same solution — atomic filtered update, whichever transition's filter matches first wins, the other gets a clean 409 |

**The unifying technique across every row above**: express every state transition as a `findOneAndUpdate` (or equivalent atomic operation) whose **filter** includes the expected *current* state, not just the document ID. This single MongoDB idiom, applied consistently, eliminates the need for explicit locking or multi-document transactions for the vast majority of this system's race conditions — you only reach for a real multi-document transaction when a single logical operation must atomically touch more than one collection in a way that partial failure would leave genuinely inconsistent (e.g., none of the flows above actually require that; if you find one that does during implementation, that's the signal to reach for `session.withTransaction()`, not before).

---

## 35. Edge Case Checklist

| Edge case | Expected behavior |
|---|---|
| Student loses internet mid-class | Attendance segment closes on disconnect detection (or on session-completion sweep at latest); student can reconnect and get a new segment; no error state shown beyond a normal "reconnecting..." UI |
| Teacher loses internet mid-class | Grace period before any auto-action (§5.5); students see a "waiting for teacher to reconnect" state, not an abrupt class-ended |
| Teacher browser closes without ending class | Same grace-period auto-completion via the background job (§33.11) — class doesn't stay "LIVE" forever |
| Student refreshes page | Frontend re-fetches current state via REST on load; if still enrolled+session still live, rejoin flow re-runs cleanly (§33.7) |
| Student opens two tabs | Single-active-connection enforcement at LiveKit layer (§22) |
| Student joins from two devices | Same as above — one active presence, by design |
| Class is cancelled (before going live) | `lifecycle → CANCELLED`, students notified, join endpoint now correctly rejects with `INVALID_STATE` |
| Class is rescheduled | Only allowed while `SCHEDULED` (§5.4); students notified of new time |
| Teacher accidentally clicks Switch Online | No hard "undo" in MVP (documented as **Assumption A7**, §56) — mitigated by a confirmation modal on the frontend (§7.1 step 1) rather than a backend rollback feature, since reverting mode is a conceptually messy operation (§5.4) |
| Teacher switches online twice (double click) | Idempotent, handled (§34) |
| Unauthorized user has a room URL | Cannot join — no valid token exists for them (§20) |
| Student removed from course while inside a live class | `student:removed`-equivalent flow triggers on the enrollment-status-change side too — teacher's removal action (§33.10, if conflated with course removal) immediately revokes the live token; if removal happens outside a live-room-remove call (e.g., a separate "remove from course" action while student happens to be in class), that action's service should also call the LiveKit disconnect API as a side effect, not leave it to chance |
| Student's enrollment is suspended while class is live | Same as above — any transition of `Enrollment.status` away from `ACTIVE` should trigger a live-room disconnect side effect if the student currently has an open attendance segment for a live session in that course |
| LiveKit/SFU service goes down | REST layer still functions (course/enrollment management unaffected); token-mint endpoint returns `SERVICE_UNAVAILABLE` (§26) with a clear message rather than a confusing generic error |
| MongoDB becomes unavailable | Entire API degrades to 500s via the centralized error handler (§26) — no partial-write risk because of the atomic-operation patterns used throughout (§34), so at least there's no silent corruption, just unavailability |
| Notification service (email) fails | Non-blocking, doesn't affect the underlying state change (§23/§33.9) |
| File upload fails partway | No DB record created until the storage upload confirms success — never create a `Resource` doc pointing at a file that might not exist |
| JWT access token expires while user is mid-action | Frontend Axios interceptor catches 401, silently attempts `/api/auth/refresh`, retries the original request once; if refresh also fails, redirect to login |
| JWT expires specifically while inside a live class | Doesn't affect the already-established LiveKit connection (that's authorized by its own separate, independent token per §20) — only affects subsequent REST calls (chat persistence, attendance events over REST if you're not doing them purely over the already-authenticated socket) |

---

*End of Part 4. Part 5 (final) covers: Audit Logging, Scalability by class size, Performance/caching guidance, Observability, Testing Strategy + API testing examples, Development Roadmap by phase, Implementation Order, MVP Definition, Future Features, Mermaid diagrams, ER diagram, Security Threat Model, Business-vs-Technical-logic recap, Common Design Mistakes, Design Decision Records, Glossary, and the Final Master Blueprint.*
