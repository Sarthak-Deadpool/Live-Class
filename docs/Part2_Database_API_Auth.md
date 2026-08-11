# TeacherConnect — System Study & Engineering Design Document
## Part 2 of 5: Database, API, Authentication, Authorization, Identity, Enrollment

> Continues directly from Part 1. Read that first if you haven't — Part 2 assumes you know the state machines and trust-boundary model already established.

---

## 9. Database Design

### 9.1 Design philosophy before the schemas

Your prompt lists a plausible collection set. It's *almost* right, but two things need correcting before we lock it in:

1. **`liveRooms` should not be a permanent standalone collection that outlives the class session** — a live room's entire lifecycle is bound to exactly one class session. Modeling it as a separate collection you constantly have to join against `classSessions` is unnecessary indirection. Instead: embed live-room metadata (roomId, provider room name, started/ended timestamps) **inside** the `classSessions` document as a sub-object. One class session has at most one "live occurrence" worth of room metadata in MVP (no re-starting a completed session).
2. **`studentIds` should not be their own collection.** A student ID is a property *of an enrollment*, not an independent entity with its own lifecycle — see §16. It lives as a field on the `Enrollment` document.

Everything else in your list is right. Final collection set:

`users`, `courses`, `enrollments`, `classSessions` (with embedded live-room sub-object), `attendance`, `resources`, `announcements`, `notifications`, `auditLogs`.

That's 9 collections, not 10 — deliberately fewer than proposed, because every collection is a thing you have to index, secure, and query-join correctly. Fewer, well-chosen collections beat a "textbook-normalized" set for a solo dev's maintenance burden.

### 9.2 `users`

```js
User {
  _id: ObjectId,
  name: String,               // required, 2-100 chars
  email: String,               // required, unique, lowercase, indexed
  passwordHash: String,        // required, bcrypt, never returned in any response
  role: String,                 // enum: 'teacher' | 'student', required, immutable after creation
  status: String,                // enum: INVITED | ACTIVATION_PENDING | ACTIVE | SUSPENDED | DEACTIVATED
  isEmailVerified: Boolean,     // default false
  avatarUrl: String,            // optional
  refreshTokenVersion: Number,  // default 0 — incremented to invalidate all refresh tokens (see §14)
  createdAt: Date,
  updatedAt: Date
}
```

**Why `role` is immutable**: a user is either a teacher or a student for the life of the account in MVP. Allowing role-switching opens a whole class of authorization bugs (a student who becomes a teacher mid-session, whose old JWT still claims `role: student`) that isn't worth the complexity for a feature nobody asked for. If a person needs both roles, they register two accounts with two emails (documented as **Assumption A4**, §56 in Part 5) — a real institution-scale product might revisit this, but not the MVP.

**Why `refreshTokenVersion` exists**: explained fully in §14. Short version — it's the mechanism for "log out everywhere" / credential-compromise recovery without maintaining a token blocklist.

### 9.3 `courses`

```js
Course {
  _id: ObjectId,
  teacherId: ObjectId,        // ref: User, required, immutable, indexed
  title: String,                // required, 3-150 chars
  description: String,          // optional, up to 2000 chars
  status: String,                 // enum: DRAFT | ACTIVE | ARCHIVED
  createdAt: Date,
  updatedAt: Date
}
```

Deliberately thin. Things like "syllabus," "cover image," "category tags" are all easy additive fields later — don't design them in before you need them.

### 9.4 `enrollments`

```js
Enrollment {
  _id: ObjectId,
  studentId: ObjectId,         // ref: User, required, indexed
  courseId: ObjectId,          // ref: Course, required, indexed
  status: String,                 // enum: REQUESTED | ACTIVE | REJECTED | WITHDRAWN | REMOVED
  studentCourseId: String,      // the "Student ID", generated only on approval, see §16. null until ACTIVE
  requestedAt: Date,
  decidedAt: Date,               // when approved/rejected
  decidedBy: ObjectId,           // ref: User (teacher), for audit
  removedAt: Date,               // if withdrawn/removed
  rejectionReason: String,        // optional
  createdAt: Date,
  updatedAt: Date
}
```

**Why `studentCourseId` lives here, not on `User`**: because it's a property of *this specific membership*, not of the person globally — the whole point of §5.3/§16. A student in 3 courses has 3 `Enrollment` documents, each with its own `studentCourseId`.

**Compound uniqueness**: You must prevent a student from having two simultaneously "live" enrollments (`REQUESTED` or `ACTIVE`) in the same course — that's the race condition in FR-03. This is a partial unique index (see §11).

### 9.5 `classSessions`

```js
ClassSession {
  _id: ObjectId,
  courseId: ObjectId,          // ref: Course, required, indexed
  teacherId: ObjectId,         // ref: User, denormalized copy of course.teacherId for fast ownership checks without a join
  title: String,
  scheduledStart: Date,          // required
  scheduledEnd: Date,             // required
  mode: String,                    // enum: OFFLINE | ONLINE
  lifecycle: String,                // enum: SCHEDULED | LIVE | COMPLETED | CANCELLED
  liveRoom: {                       // embedded sub-object, only populated once mode transitions to ONLINE
    roomName: String,               // provider (LiveKit) room identifier
    startedAt: Date,
    endedAt: Date,
    startedBy: ObjectId             // teacher who actually pressed "start"
  },
  modeChangedAt: Date,
  modeChangedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

**Why `teacherId` is denormalized here**: every authorization check on a class session ("does this teacher own this session?") would otherwise require a join to `courses` first. Duplicating an immutable field (course ownership never transfers in MVP, §9.3) to avoid that join on every single request is a deliberate, safe denormalization — not sloppy schema design. This is the kind of embed-vs-reference tradeoff §10 discusses generally.

### 9.6 `attendance`

```js
AttendanceSegment {
  _id: ObjectId,
  classSessionId: ObjectId,     // ref: ClassSession, required, indexed
  studentId: ObjectId,           // ref: User, required, indexed
  enrollmentId: ObjectId,        // ref: Enrollment, required — snapshot link, survives enrollment status changes
  joinedAt: Date,                  // required
  leftAt: Date,                     // null while still connected
  source: String,                   // enum: SOCKET | MANUAL_CORRECTION
  correctedBy: ObjectId,           // ref: User (teacher), only if source=MANUAL_CORRECTION
  createdAt: Date
}
```

**Why "segments" not one row per student per class**: a student who disconnects and reconnects three times produces three segments. Total attendance = sum of segment durations. This is what §5.6/§22 requires — one join/leave pair per student per session is not expressive enough for real network behavior. Deriving a "did they attend" boolean and a duration is a query/aggregation over segments, computed on read, not stored as a separate mutable field that could drift out of sync with the underlying data.

### 9.7 `resources`

```js
Resource {
  _id: ObjectId,
  courseId: ObjectId,           // ref: Course, required, indexed
  uploadedBy: ObjectId,          // ref: User (teacher), required
  title: String,
  fileUrl: String,                 // signed/stable URL, see §28
  fileType: String,                 // mime type
  fileSizeBytes: Number,
  createdAt: Date,
  deletedAt: Date                  // soft delete — preserves reference integrity for anyone who already has a link, and audit history
}
```

### 9.8 `announcements`

```js
Announcement {
  _id: ObjectId,
  courseId: ObjectId,          // required, indexed
  teacherId: ObjectId,          // required
  title: String,
  body: String,
  createdAt: Date
}
```

### 9.9 `notifications`

```js
Notification {
  _id: ObjectId,
  userId: ObjectId,             // recipient, required, indexed
  type: String,                   // enum: ENROLLMENT_APPROVED | ENROLLMENT_REJECTED | CLASS_ONLINE | ANNOUNCEMENT | CLASS_CANCELLED | etc.
  payload: Object,                 // small denormalized data needed to render without a join, e.g. { courseTitle, classSessionId }
  isRead: Boolean,                  // default false, indexed
  createdAt: Date
}
```

### 9.10 `auditLogs`

```js
AuditLog {
  _id: ObjectId,
  actorId: ObjectId,             // who did it
  action: String,                  // enum, see §36
  targetType: String,               // 'Enrollment' | 'ClassSession' | 'Resource' | ...
  targetId: ObjectId,
  metadata: Object,                  // minimal, non-sensitive context
  createdAt: Date
}
```

---

## 10. Database Relationships

```
User(teacher) 1───* Course
Course 1───* Enrollment ───* User(student)     (Enrollment is the join entity)
Course 1───* ClassSession
ClassSession 1───* AttendanceSegment ───* User(student)
Enrollment 1───* AttendanceSegment              (snapshot reference, see §9.6)
Course 1───* Resource
Course 1───* Announcement
User 1───* Notification
```

### Embedding vs. referencing decisions

| Relationship | Choice | Why |
|---|---|---|
| ClassSession → LiveRoom metadata | **Embed** | 1:1, small, always fetched together, never queried independently |
| Course → ClassSessions | **Reference** | 1:many, unbounded growth, queried independently (session list, calendar view) |
| Enrollment → AttendanceSegments | **Reference** | 1:many, unbounded, queried both "by session" and "by student" independently — embedding in either parent would force awkward duplication |
| Course → Enrollments | **Reference** | Unbounded growth; also enrollments are frequently queried standalone ("all my enrollments across courses") |
| ClassSession.teacherId | **Denormalized reference** (copy) | Read-heavy authorization check, immutable source field — see §9.5 |
| Notification.payload | **Embedded denormalized snapshot** | Notifications must remain readable/renderable even if the source course/session is later modified or archived; a notification is a historical fact, not a live view |

**General rule used throughout**: embed when the relationship is 1:1 (or 1:few, bounded, always co-accessed) and reference when it's 1:many/unbounded or independently queried. This is standard MongoDB modeling guidance — I'm not deviating from convention anywhere here, because there's no reason to; your instinct to ask about it per-relationship rather than pick one style globally was the right instinct.

---

## 11. Database Indexing

| Collection | Index | Query it serves | Notes |
|---|---|---|---|
| users | `{ email: 1 }` unique | Login lookup | Case-normalize email before storing/querying |
| courses | `{ teacherId: 1 }` | "My courses" | |
| courses | `{ status: 1 }` | Public course discovery | Compound with title-text-index if you add search later |
| enrollments | `{ studentId: 1, courseId: 1, status: 1 }` **partial unique** on status ∈ [REQUESTED, ACTIVE] | Prevent duplicate active/pending enrollment (FR-03) | This is the concurrency-safety index from §5.1/§34 |
| enrollments | `{ courseId: 1, status: 1 }` | Teacher's pending-approval queue, active roster | |
| classSessions | `{ courseId: 1, scheduledStart: 1 }` | Course calendar view | |
| classSessions | `{ teacherId: 1, lifecycle: 1 }` | Teacher dashboard | |
| attendance | `{ classSessionId: 1, studentId: 1 }` | Roster attendance for one session | |
| attendance | `{ studentId: 1, classSessionId: 1 }` | Student's own attendance history | Note: same fields, different leading key — MongoDB doesn't reuse a compound index efficiently if the leading field differs and cardinality patterns differ; both directions get real traffic, so both indexes earn their keep |
| notifications | `{ userId: 1, isRead: 1, createdAt: -1 }` | Unread inbox, sorted | |
| resources | `{ courseId: 1, deletedAt: 1 }` | Active resource list per course | |
| auditLogs | `{ targetType: 1, targetId: 1, createdAt: -1 }` | "History for this entity" | |

**Tradeoff note**: every index speeds reads and costs writes + storage. None of these are exotic — they're all direct reflections of the actual query patterns this document has already described (roster lookups, ownership checks, per-student history). Don't add indexes speculatively; add them when a query is slow or when uniqueness is a correctness requirement (the enrollment partial-unique index is correctness, not performance).

---

## 12. API Design (representative core — full route table)

Convention used throughout: `Authorization: Bearer <accessToken>` (or httpOnly cookie, see §14), all bodies validated with Zod before touching a controller, all responses follow the format in §26.

### `/api/auth`
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | none | Create account (§FR-01) |
| POST | `/login` | none | Issue access+refresh tokens |
| POST | `/refresh` | refresh token (cookie) | Rotate access token |
| POST | `/logout` | access token | Invalidate refresh token |
| POST | `/verify-email` | none (token in body) | Complete email verification |

### `/api/courses`
| Method | Route | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/` | yes | teacher | Create course |
| GET | `/` | yes | any | List (own courses if teacher; public+enrolled if student) |
| GET | `/:id` | yes | any (with ownership/membership check for private fields) | Course detail |
| PATCH | `/:id` | yes | teacher (owner) | Edit |
| PATCH | `/:id/status` | yes | teacher (owner) | Publish/archive |

### `/api/enrollments`
| Method | Route | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/` | yes | student | Request enrollment |
| GET | `/course/:courseId` | yes | teacher (owner) | Roster/pending queue |
| GET | `/mine` | yes | student | My enrollments |
| PATCH | `/:id/approve` | yes | teacher (owner) | FR-04 |
| PATCH | `/:id/reject` | yes | teacher (owner) | FR-04 |
| DELETE | `/:id` | yes | student (own) or teacher (owner of course) | Withdraw / remove |

### `/api/classes`
| Method | Route | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/` | yes | teacher (owns courseId in body) | Create session |
| GET | `/course/:courseId` | yes | teacher (owner) or student (enrolled) | List sessions |
| PATCH | `/:id` | yes | teacher (owner) | Edit while SCHEDULED |
| PATCH | `/:id/mode` | yes | teacher (owner) | Offline→Online, §18 |
| PATCH | `/:id/start` | yes | teacher (owner) | SCHEDULED/pending → LIVE |
| PATCH | `/:id/end` | yes | teacher (owner) | LIVE → COMPLETED |
| PATCH | `/:id/cancel` | yes | teacher (owner) | → CANCELLED |

### `/api/live`
| Method | Route | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/:sessionId/token` | yes | teacher (owner) or student (ACTIVE enrollment) | Mint SFU access token, §20 |
| POST | `/:sessionId/remove-participant` | yes | teacher (owner) | Force-remove live participant |

### `/api/attendance`, `/api/resources`, `/api/announcements`, `/api/notifications`
Follow the identical pattern (ownership/membership check → business-rule check → DB op). Full endpoint-by-endpoint tables for these land in Part 3 next to their algorithms, so validation rules sit beside the logic they validate rather than being repeated twice.

### Example — full internal execution trace for one endpoint

```
PATCH /api/classes/:id/mode
Body: { mode: "ONLINE" }

1. authMiddleware       → verify JWT, attach req.user
2. validateBody(Zod)     → mode ∈ ['ONLINE']  (only forward direction allowed)
3. loadSession           → findById(id), 404 if missing
4. authorizeOwnership    → session.teacherId === req.user.id, else 403
5. checkStateRule        → session.lifecycle === 'SCHEDULED' && session.mode === 'OFFLINE', else 409 INVALID_STATE
6. service.convertToOnline(session)   → atomic update, see §18 pseudocode
7. emit socket 'class:online' to room `course:${courseId}`
8. create Notification docs for all ACTIVE enrollments (bulk insert)
9. return 200 { session }
```

---

## 13. Route Design

```
routes/  → maps HTTP verb+path to a controller function, does nothing else
  ↓
middleware/  → auth, validation, rate-limit — cross-cutting, reusable
  ↓
controllers/  → parse req, call service, shape response — thin, no business logic
  ↓
services/  → business rules, state transitions, orchestration across multiple models
  ↓
models/ (Mongoose) → schema, validation, direct DB access
```

**Should controllers touch Mongoose models directly, or always go through a service?** For a solo MERN developer: **use a service layer for anything with more than one business rule or more than one DB write**, and let controllers call Mongoose directly only for trivial single-document reads (e.g., `GET /courses/:id`). This is a middle ground, not full hexagonal-architecture ceremony — you don't need a repository-pattern abstraction on top of Mongoose (that's solving a "swap your database" problem you don't have), but you do want business logic out of controllers so it's testable and reusable. Concretely: enrollment approval, offline→online conversion, and live-room token issuance all *must* be services (multi-step, multi-document, business-rule-heavy). Fetching a single announcement by ID does not need one.

---

## 14. Authentication Architecture

### JWT vs. sessions — the actual comparison, not just a verdict

| | Session-based | JWT |
|---|---|---|
| Server state | Requires session store (Redis/Mongo) | Stateless (mostly) |
| Revocation | Instant (delete session) | Requires extra mechanism (see below) |
| Scaling | Needs shared session store across instances | Naturally stateless-scalable |
| Complexity for solo dev | Lower conceptually, but adds infra (session store) | Higher conceptually, no extra infra for basic case |

**Recommendation: JWT**, specifically **short-lived access token + long-lived refresh token**, because this project already needs a low-friction way to authorize Socket.io connections and (indirectly) LiveKit token minting, and stateless JWTs are simpler to pass across those boundaries than session cookies validated against a shared store. This is a real tradeoff, not "JWT is trendy" — session-based auth would also work fine and is a legitimate alternative if you'd rather not deal with refresh-token complexity (documented in §51 Design Decision Records).

### Full lifecycle

1. **Login**: verify credentials → issue **access token** (JWT, 15 min expiry, contains `userId`, `role`, `tokenVersion`) and **refresh token** (JWT, 7–30 day expiry, contains `userId`, `tokenVersion`, opaque otherwise).
2. **Storage**: access token in memory (React state/store) or a short-lived cookie; refresh token in an **httpOnly, Secure, SameSite=Strict cookie** — never in localStorage (XSS-readable, see §27).
3. **Every API request**: access token sent via `Authorization: Bearer` header (if in-memory) or read from cookie by middleware. Middleware verifies signature + expiry + (optionally) that `tokenVersion` matches the user's current `refreshTokenVersion` in DB — this is what makes "log out everywhere" possible without a blocklist.
4. **Refresh flow**: when access token expires, frontend calls `/api/auth/refresh` — browser automatically sends the httpOnly refresh cookie, server verifies it, checks `tokenVersion` against DB, issues a new access token. If refresh token itself is expired/invalid → force re-login.
5. **Token rotation**: on every refresh, optionally issue a **new** refresh token too and invalidate the old one (rotate). This limits the damage window of a stolen refresh token — if the old one is reused after rotation, that's a signal of theft and you can force-invalidate the whole family (increment `tokenVersion`).
6. **Logout**: clear cookies client-side + increment `user.refreshTokenVersion` server-side, which instantly invalidates all outstanding access tokens issued with the old version (they'll fail the version check) and all refresh tokens.
7. **CSRF**: because the refresh token lives in a cookie, CSRF is a real concern for that specific endpoint. Mitigate with `SameSite=Strict` (blocks cross-site cookie sending in the first place) plus a CSRF token double-submit pattern if you want defense in depth. The access token, if kept in memory/header (not cookie), is naturally immune to CSRF since it's not auto-sent by the browser.
8. **Token theft scenario**: if an access token is stolen, damage is capped at 15 minutes. If a refresh token is stolen, damage is capped by rotation-reuse detection + the user (or you, manually) incrementing `tokenVersion`. Neither token, alone, should ever be treated as sufficient for a *sensitive* action without re-checking current DB state (e.g., don't trust a JWT's embedded `role` for authorization decisions on data that could have changed — always re-verify ownership/membership against the DB per request, not just the token's claims — see §15).

---

## 15. Authorization

**Authentication answers "who are you." Authorization answers "what can you touch, right now."** A valid JWT proves identity; it proves nothing about whether *this* user can act on *this* course/session/resource. Every sensitive endpoint in this system performs both, in order:

```
1. authenticate(token) → req.user
2. authorize(req.user, resource) → ownership or membership check against current DB state
3. validateBusinessState(resource) → state machine check
```

Concrete rules (each server-enforced, never inferred from frontend routing/UI hiding):

```
Teacher can modify a course  ⟺  course.teacherId === req.user.id
Teacher can manage a class session ⟺ session.teacherId === req.user.id
Student can access a course's private content ⟺ exists Enrollment{studentId: req.user.id, courseId, status: 'ACTIVE'}
Student can join a live session ⟺ above AND session.lifecycle ∈ ['LIVE','SCHEDULED' with mode ONLINE + waiting room]
Student cannot view another student's attendance ⟺ attendance query always filtered by req.user.id for student role, never accepts a studentId param from a student caller
```

**Why "never rely on frontend authorization" is worth repeating explicitly**: hiding a button doesn't stop someone from calling the API directly (Postman, curl, browser devtools). Every one of the rules above must be enforced in the Express layer as a real conditional that returns 403, independent of whatever the React app happens to render.

---

## 16. Student ID / Identity Architecture — full comparison

### Option A: Student ID globally unique (one ID per person, forever)
Looks appealing ("like a national ID") but conflates *who the person is* with *their membership in one course* — breaks the moment a student is in two courses and you need to ask "which membership does this ID refer to." Rejected.

### Option B: Student ID unique within each course, independent of any global identity
E.g., "Student #7 in Course X" and "Student #3 in Course Y," generated per-course with no cross-course linkage stored anywhere convenient. Workable, but you'd still need the underlying global `userId` for login/auth anyway — this option doesn't save you anything over Option C, it just under-specifies where the global identity lives.

### Option C (recommended): Global `userId` (from `users`) + course-scoped `studentCourseId` (on `Enrollment`)
This is what's modeled in §9.4. The user's account (email/password/JWT identity) is global and singular. The "Student ID" that gets issued is a **per-enrollment label** — human-readable, exportable to a roster, potentially even printable — that has zero authentication power. It exists purely as the "trusted member" badge your original spec asked for.

**Generation**: e.g. `courseCode + zero-padded sequence`, assigned atomically at approval time using a per-course counter (a `findOneAndUpdate` with `$inc` on a counter field, or a dedicated `Counters` collection keyed by courseId — standard MongoDB auto-increment pattern, since Mongo has no native auto-increment). Collision prevention is inherent: the counter increment is atomic, so two simultaneous approvals in the same course can't get the same number.

**Is it secret?** No — and it shouldn't be treated as one. It can be shown in a roster, exported to CSV, read aloud in class. If it leaks, the worst case is someone knows "this person is member #12 of this course" — a mild privacy fact, not an account-compromise vector, precisely because it authenticates nothing.

**Can it be regenerated?** Not needed in MVP — since it's not a secret, there's no "rotate it because it leaked" scenario. If a teacher wants to reassign roster numbers, that's a course-management feature, not a security feature.

**Relationship to authentication**: none, by design (§5.3). Relationship to enrollment: it *is* a field of the enrollment, created exactly once, at approval.

---

## 17. Course Enrollment System — operational detail

- **Duplicate enrollment**: prevented at the DB layer by the partial unique index (§11), and pre-checked at the service layer for a fast, friendly error before hitting the DB constraint.
- **Re-enrollment** after rejection/withdrawal/removal: allowed, creates a new `Enrollment` document (§6.1). The old document is never mutated for this purpose — it's a closed historical record.
- **Course completion**: not a first-class state in MVP (no explicit "course ended, archive all enrollments" flow) — when a `Course` is archived, existing `ACTIVE` enrollments simply stop being actionable for new class sessions (no new sessions can be created on an archived course), but historical data remains queryable. Documented as **Assumption A5** (§56) — a real "course term ends, mass-transition enrollments to COMPLETED" flow is a reasonable v2 addition if you want a cleaner "past courses" view for students.

---

## 18. Offline → Online Transition — the flagship algorithm

### Pseudocode

```
function convertSessionToOnline(sessionId, requestingTeacherId):
    session = ClassSession.findById(sessionId)
    if session is null: return 404 SESSION_NOT_FOUND

    if session.teacherId != requestingTeacherId: return 403 NOT_OWNER

    # Idempotency / race-condition guard — see below
    result = ClassSession.findOneAndUpdate(
        filter: { _id: sessionId, mode: 'OFFLINE', lifecycle: 'SCHEDULED' },
        update: {
            mode: 'ONLINE',
            modeChangedAt: now(),
            modeChangedBy: requestingTeacherId,
            'liveRoom.roomName': generateRoomName(sessionId)
        },
        options: { new: true }
    )

    if result is null:
        # The filter didn't match — either already ONLINE, or not SCHEDULED anymore.
        # Re-fetch to give a precise error rather than a generic failure.
        current = ClassSession.findById(sessionId)
        if current.mode == 'ONLINE': return 409 ALREADY_ONLINE  # idempotent-friendly: treat as success-ish on the client
        return 409 INVALID_STATE

    # Only reaches here on the single request that actually won the atomic update
    createOrReserveSfuRoom(result.liveRoom.roomName)   # best-effort; failure handled below
    notifyEnrolledStudents(result.courseId, result._id) # fire-and-forget, retried by a background job on failure

    return 200 { session: result }
```

### Why the `findOneAndUpdate` with a filter on current state *is* the concurrency control

This is the direct answer to "teacher double-clicks Switch Online" and "two tabs open, both submit." MongoDB's `findOneAndUpdate` is atomic per-document. By including `mode: 'OFFLINE', lifecycle: 'SCHEDULED'` in the **filter**, not just the update, only the first of two near-simultaneous requests can possibly match and win — the second one's filter fails to match (because the first request already flipped `mode` to `ONLINE`), so it falls through to the "already handled" branch instead of double-processing. **No explicit transaction or lock needed** — this is the standard MongoDB idiom for exactly this class of problem, and it's simpler and cheaper than wrapping a multi-document transaction around it. You only need a real multi-document transaction (§34) when you're mutating more than one document atomically together; this operation only atomically mutates one, so a conditional single-document update is sufficient and preferable.

### Failure handling
- **SFU room creation fails**: don't roll back the DB state — the session is still validly "ONLINE," you just retry room creation (idempotent — creating an already-existing LiveKit room by the same name is a no-op or safely reconciled). Surface a "still setting up, refresh in a moment" state to the teacher rather than reverting their action.
- **Notification fan-out fails partway**: not transactional with the state change — notifications are best-effort (§23). A background reconciliation job can re-check "sessions that went ONLINE in the last hour with fewer notifications than active enrollments" and backfill, if you want that robustness; not required for MVP.
- **Teacher retries after a transient failure**: safe, because the operation is idempotent from the client's perspective (a second identical request either succeeds fresh or returns `409 ALREADY_ONLINE`, which the frontend treats as "fine, it's online, proceed").

---

*End of Part 2. Part 3 covers: Live Classroom Architecture (WebRTC → SFU → LiveKit, full concept chain), Live Room Security (token model), Socket.io event catalog, Attendance algorithm, Notifications, Resources, Validation rules, and Error handling.*
