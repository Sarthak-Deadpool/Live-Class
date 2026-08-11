# TeacherConnect — System Study & Engineering Design Document
## Part 1 of 5: Foundations — Overview, Requirements, Business Logic, Architecture

> **How to use this document**: This is Part 1 of a 5-part blueprint. It is meant to be read in order, then kept open as a reference while you build. Every section that makes a claim ("use JWT", "use referencing not embedding") is followed by the reasoning — if you only remember one rule from this whole project, remember: **never implement something because a document told you to; implement it because you understand why.**

---

## 1. Executive System Overview

### 1.1 Non-technical description

Picture a real teacher running a real course. Enrollment isn't automatic — the teacher decides who's in the class. Once you're in, you're *known* to the teacher: attendance, participation, resources, all tied to your enrolled identity, not just "whoever showed up." The product's job is to digitize that trust relationship, not to be a generic video-calling app.

The single differentiating feature is this: **a scheduled offline class is not a dead end when reality intervenes.** Rain, a closed building, a sick teacher — instead of "class cancelled," the teacher flips one switch and the *same* class becomes a live online session, and only the students who were already trusted members of that course can walk in. Nobody joins with a bare link. Nobody self-registers into a classroom. The chain of trust — teacher → course → approved student — is what gates entry to the live room, at every step, no exceptions.

### 1.2 Technical description

A MERN application with three cooperating subsystems:

1. **A REST API (Express + MongoDB)** — the system of record. Owns courses, enrollments, users, class sessions, attendance, resources. Every write here is guarded by authentication + authorization + a business-rule state check.
2. **A realtime signaling layer (Socket.io)** — pushes state changes (class went online, student joined, announcement posted) to connected clients. It does **not** carry audio/video.
3. **A live media layer (WebRTC via an SFU, e.g. LiveKit)** — carries audio, video, and screen-share. It is authorized independently, per-join, using short-lived tokens minted only after the REST layer confirms the requester is an active, approved member of that specific class session.

These three subsystems are deliberately decoupled: the media layer knows nothing about "courses" or "enrollment" — it only knows "this token grants access to this room, for this identity, until this time." All the trust logic lives in the REST layer, upstream of video ever starting. This separation is the architectural embodiment of your core requirement, and Section 20 explains it end-to-end.

### 1.3 Core modules

| Module | Responsibility |
|---|---|
| Identity & Auth | Registration, login, password/token lifecycle |
| Course Management | Teacher creates/edits/archives courses |
| Enrollment | Student requests → teacher approves/rejects → membership lifecycle |
| Student Identity | Issuance and management of the enrollment-scoped student ID (see §16) |
| Scheduling | Class session CRUD, offline/online mode, transition logic |
| Live Classroom | Room authorization, WebRTC/SFU session, screen share, in-room chat |
| Attendance | Join/leave tracking, duration calculation, manual correction |
| Resources | Upload/download of notes tied to a course, access-controlled |
| Notifications | In-app + realtime + email notification fan-out |
| Announcements | Teacher broadcast messages to a course |

### 1.4 System boundaries

**Inside the system**: everything above.
**Outside the system (explicitly, for MVP)**: payments/subscriptions, institutional multi-tenant admin, class recording/storage, mobile native apps, AI features, quizzes/assignments grading. These are Section 45 "future" items — mentioning them here so you don't accidentally start building them mid-MVP.

---

## 2. Requirement Analysis

Below is a representative set of functional requirements in full IEEE-ish format. I've done the highest-risk / highest-value ones in full detail; for the remaining feature list I give a compact table, because writing 40 of these at full length would bury the important ones. Use the full template for every requirement you personally implement — it's a genuinely useful design habit, not just documentation for its own sake.

### FR-01: Teacher Registration
- **Actor**: Prospective Teacher
- **Preconditions**: Email not already registered
- **Main flow**: Teacher submits name/email/password → system validates → password hashed → user created with `role: teacher`, `status: pending_verification` → verification email sent → teacher clicks link → `status: active`
- **Alternate flow**: Email already registered but unverified → resend verification instead of erroring immediately (avoids user confusion) but do **not** reveal via response timing/content whether the email exists for a *verified* account (enumeration protection — see §27)
- **Failure flow**: Weak password → 400 with field errors. Duplicate verified email → 409 generic "cannot register with this email"
- **Postconditions**: Teacher account exists in `pending_verification` or `active`
- **Business rules**: A teacher account is never auto-approved into "active" without email verification — this is the first link in the trust chain
- **Security considerations**: Rate-limit registration per IP; never log raw passwords; timing-safe responses for enumeration

### FR-02: Course Creation
- **Actor**: Teacher (must be `active`)
- **Preconditions**: Authenticated, role = teacher
- **Main flow**: Teacher submits title/description/schedule metadata → course created with `status: draft` or `active`, `teacherId` = requester's ID
- **Alternate flow**: Teacher saves as draft, publishes later
- **Failure flow**: Missing required fields → 400
- **Postconditions**: Course exists, owned by exactly one teacher
- **Business rules**: `teacherId` is immutable after creation (ownership doesn't transfer in MVP — that's a future feature, see §45)
- **Security considerations**: `teacherId` always taken from the authenticated JWT, **never** from the request body (classic IDOR vector — see §27)

### FR-03: Student Enrollment Request
- **Actor**: Student (authenticated)
- **Preconditions**: Course exists and is `active`/not `archived`; student has no existing `ACTIVE` or `REQUESTED` enrollment in this course
- **Main flow**: Student requests to join → `Enrollment` doc created with `status: REQUESTED` → teacher notified
- **Alternate flow**: Student previously `REMOVED` → allowed to re-request (business decision, see §5/§17) → new enrollment doc, old one kept for history
- **Failure flow**: Duplicate active/pending request → 409 `ALREADY_ENROLLED_OR_PENDING`
- **Postconditions**: One `Enrollment` document, status `REQUESTED`
- **Business rules**: No auto-approval, ever — this is the whole point of the system
- **Security considerations**: Unique compound index `(studentId, courseId, status in [REQUESTED,ACTIVE])` prevents race-condition duplicate requests (see §34)

### FR-04: Teacher Approves/Rejects Enrollment
- **Actor**: Teacher (must own the course)
- **Preconditions**: Enrollment exists, `status: REQUESTED`, teacher owns `courseId`
- **Main flow (approve)**: Teacher approves → enrollment `status: ACTIVE` → student ID generated and attached to enrollment (see §16) → student notified (in-app + email) → student now counted as course member
- **Main flow (reject)**: `status: REJECTED`, reason optional, student notified
- **Failure flow**: Teacher does not own course → 403 (ownership check, not just role check — this is authorization, not authentication)
- **Postconditions**: Enrollment in terminal-for-now state (`ACTIVE` or `REJECTED`)
- **Business rules**: Only the owning teacher can approve — never "any teacher"
- **Security considerations**: Ownership verified server-side on every request touching the enrollment, never trusted from client state

### FR-05 through FR-24 (compact form)

| ID | Feature | Actor | One-line rule |
|---|---|---|---|
| FR-05 | Student ID issuance | System (triggered by FR-04) | Issued only on approval, never on request |
| FR-06 | Student account activation | Student | Activates password/login only after first approval — see §16 for why identity ≠ credential |
| FR-07 | Enrollment withdrawal | Student | Student can leave; enrollment → `WITHDRAWN`, history retained |
| FR-08 | Enrollment revocation | Teacher | Teacher can remove a student; → `REMOVED`, attendance history retained |
| FR-09 | Class session creation | Teacher | Must belong to teacher's own course |
| FR-10 | Class session edit | Teacher | Only while `SCHEDULED`, not while `LIVE`/`COMPLETED` |
| FR-11 | Class cancellation | Teacher | Any time before `LIVE`; students notified |
| FR-12 | Offline→Online conversion | Teacher | Full algorithm in §18 |
| FR-13 | Student notification of mode change | System | Real-time + persisted, never silently dropped |
| FR-14 | Live room join (student) | Student | Only if `ACTIVE` enrollment + session `LIVE`/`ONLINE_PENDING` |
| FR-15 | Live room start (teacher) | Teacher | Only session owner; transitions `SCHEDULED/ONLINE_PENDING → LIVE` |
| FR-16 | Screen share | Teacher | Teacher-only publish permission for screen track |
| FR-17 | In-room chat | Teacher + Student | Scoped to room, moderated by teacher (mute/remove) |
| FR-18 | Resource upload | Teacher | Scoped to course, access-controlled to enrolled students |
| FR-19 | Resource download | Student | Only for courses with `ACTIVE` enrollment |
| FR-20 | Announcement post | Teacher | Broadcast to all `ACTIVE` enrollments in course |
| FR-21 | Attendance recording | System | Derived from join/leave socket + room events, see §22 |
| FR-22 | Attendance manual correction | Teacher | Override allowed, audit-logged |
| FR-23 | Class history view | Teacher + Student | Student sees only own attendance; teacher sees full roster |
| FR-24 | Participant removal (live) | Teacher | Revokes room token in real time, see §20 |

---

## 3. Non-Functional Requirements

| Category | Target | Type |
|---|---|---|
| API response time | p95 < 300ms for CRUD, < 800ms for list+filter endpoints | Assumption (adjust after profiling) |
| Live join latency | Room token issuance → media connected < 3s on good network | Assumption |
| Notification delivery (in-app) | < 1s from trigger event via socket | Hard requirement (it's just a socket emit) |
| Notification delivery (email) | Best-effort, < 2 min | Soft requirement |
| Max classroom size (MVP) | 50 participants | Assumption — drives SFU vs P2P decision in §19 |
| Availability | No formal SLA for MVP; design for graceful degradation, not 5 nines | Assumption |
| Rate limiting | Auth endpoints: 10 req/min/IP; general API: 100 req/min/user | Recommended |
| Data integrity | Enrollment state transitions must be atomic (no partial states) | Hard requirement |
| Privacy | Students never see other students' PII beyond name/avatar in shared contexts (roster, chat) | Hard requirement |
| Browser support | Latest 2 versions of Chrome/Firefox/Edge/Safari; WebRTC requires these anyway | Hard constraint (not a choice) |
| Mobile responsiveness | Full responsive web UI; native app is future (§45) | Confirmed requirement |

**Explicitly not targeting for MVP**: horizontal auto-scaling, multi-region deployment, 99.9%+ uptime SLA, sub-second p99 latency. Building these now would be premature optimization for a solo developer's first version — see §50 "Common Design Mistakes: overengineering too early."

---

## 4. Actors and Roles

### Teacher
Owns courses. Controls enrollment, scheduling, live sessions, resources, announcements, attendance corrections. Cannot access another teacher's course data — ownership is per-document, checked server-side on every request.

### Student
Requests enrollment, cannot self-approve. Once `ACTIVE` in a course: can view schedule, join authorized live sessions, download resources, see own attendance, participate in chat. Cannot see other courses' data, cannot see other students' attendance, cannot self-issue or modify their student ID.

### System (automated actor)
Issues student IDs, calculates attendance, sends notifications, expires tokens, transitions session states on timers (e.g., auto-mark `COMPLETED` after scheduled end + grace period).

### Admin (future, not in MVP)
Would exist for multi-teacher/institutional deployments. Not designed in depth here because building it now would shape the data model around a requirement you don't have yet (see Assumption A3, §56).

### Permission Matrix

| Action | Teacher | Student (not enrolled) | Student (enrolled/ACTIVE) | System |
|---|---|---|---|---|
| Create course | YES (own) | NO | NO | NO |
| View course details | YES (own) | Public fields only | YES | — |
| Request enrollment | NO | YES | N/A (already enrolled) | NO |
| Approve/reject enrollment | YES (own course) | NO | NO | NO |
| Issue student ID | NO (triggered, not manual) | NO | NO | YES |
| Remove student from course | YES (own course) | NO | N/A | NO |
| Create/edit class session | YES (own course) | NO | NO | NO |
| Convert offline→online | YES (own session) | NO | NO | NO |
| Start live session | YES (own session) | NO | NO | NO |
| Join live session | YES (own session) | NO | YES, only if session LIVE/pending & own enrollment ACTIVE | NO |
| Remove participant from live room | YES (own session) | NO | NO | NO |
| Screen share (publish) | YES | NO | NO (view-only by default) | NO |
| Upload resource | YES (own course) | NO | NO | NO |
| Download resource | YES (own course) | NO | YES (own course only) | NO |
| Post announcement | YES (own course) | NO | NO | NO |
| View own attendance | N/A | NO | YES | — |
| View full roster attendance | YES (own course) | NO | NO | — |
| Correct attendance | YES (own course) | NO | NO | NO |
| Receive notifications | YES (own courses) | NO | YES (own courses) | — |

---

## 5. Complete Business Logic

This is the section you should re-read most often. Every rule here has to become a server-side check — never a frontend-only gate.

### 5.1 Course enrollment rules

- **Who can request enrollment?** Any authenticated student, for any non-archived course. Open discovery, gated membership — the browsing is public-ish, the *joining* is not.
- **Can teacher approval be skipped?** No — not even for "trusted" students, not even via an admin override in MVP. This is a hard rule because it's the entire value proposition; if you build a bypass "just for testing," it will end up in production.
- **Can teacher reject?** Yes, with optional reason. Rejected students may re-request (business decision — a rejection isn't necessarily permanent, e.g. "wrong course" or "prerequisite not yet met"). Re-request creates a **new** enrollment document; the rejected one stays for history.
- **Can teacher revoke an ACTIVE enrollment?** Yes → `REMOVED`. Historical attendance and past class access remain intact (attendance records reference the enrollment/session by ID, not by "is currently active" — deleting access shouldn't delete history, see §5.2).
- **Can student leave voluntarily?** Yes → `WITHDRAWN`. Same non-destructive history rule applies.
- **What happens to a LIVE session if a student is removed mid-class?** Enrollment status change triggers immediate room-token revocation via socket event (`participant:force-remove`) — see §20 and §34's race-condition analysis, because "remove while joining" is a real race.

### 5.2 Why historical records must survive membership changes

This deserves its own callout because it drives a database design decision (§9–10): **never delete an Enrollment document, and never let Attendance/ClassSession records depend on the enrollment still being ACTIVE.** Attendance references `enrollmentId` (or `studentId` + `courseId` + `classSessionId` directly — see the referencing debate in §10), and its own status is independent of the current enrollment status. A student removed in week 8 should still show up correctly in weeks 1–7's attendance reports. Soft-state transitions (status enums), not deletion, are the pattern throughout this whole system.

### 5.3 Student identity rules — the most important design decision in this document

You asked me to specifically challenge this, so here's the full analysis promised in §16 (detailed there); the ruling in brief:

- Student ID is issued **once per enrollment**, at approval time, not at registration and not at class start.
- Student ID is **not** a credential. It is never compared against a submitted secret to authenticate anyone. Authentication is handled entirely by the normal login credential (password hash / JWT), which belongs to the **user account**, not the enrollment.
- A student ID is scoped to (student, course) — one student enrolled in 3 courses has 3 IDs, because "membership in course X" is what the ID represents, not "who this person is globally." The global "who this person is" is the `userId`/account, which already exists from registration.
- Why separate identity from credential: if the Student ID were also a login secret, then (a) it would have to be kept secret, contradicting its natural use as a visible "roster number" a teacher might read aloud or export to a spreadsheet, and (b) compromise of the ID (which is far more exposed — it appears in rosters, CSV exports, printed material) would mean full account compromise. Separating them means the ID can be freely visible/shareable/printable without being a security boundary at all — it's a *label*, and the *lock* is the password/JWT that never appears anywhere except the login flow and secure storage.
- **Live-room authorization is a third, separate concept from both.** Even with valid login credentials and a valid student ID, a student gets a room token only after the server checks: authenticated (credential) → enrollment ACTIVE for this course (identity/membership) → session is LIVE/joinable (class state) → *then* issue a short-lived room token. Four independent gates, not one merged check. This is what makes "share the link" attacks impossible — the link/token means nothing without the upstream state being correct at the moment of request, and the token itself expires quickly (§20).

### 5.4 Class scheduling rules

- Only the owning teacher creates/edits/cancels sessions for their own course.
- A session can be edited freely while `SCHEDULED`. Once `LIVE`, only operational actions apply (end session, remove participant) — not schedule edits.
- Offline → Online is one-directional per "live occurrence": once a session has gone online and been started, you don't flip it back to offline mid-lifecycle — that doesn't make physical sense (the class already happened online). A *future* session can always be scheduled as offline again; this rule is about not retroactively rewriting what already happened.
- Transition timing: allowed any time between session creation and the session's scheduled end time (with a small grace window after, in case the teacher is transitioning at the last minute — e.g. "already 5 minutes late, switching now"). Not allowed after the session has already been marked `COMPLETED` or `CANCELLED`.

### 5.5 Live class rules

- Only the owning teacher can start a session.
- Students can join once the session is `LIVE` (or `ONLINE_PENDING`, if you choose to allow a "waiting room" state — recommended, see §6). Joining before the teacher exists as a UX choice: allow it into a waiting-room state, don't allow it into the actual media room, so students aren't stuck refreshing.
- If teacher disconnects: session does not auto-end immediately (network blips happen) — a grace timer (e.g. 60–120s) before the system marks it as needing teacher reconnect / auto-ends if unrecovered. This avoids punishing a flaky-wifi teacher by nuking the whole class.
- If a student disconnects: their attendance "leave" timestamp is recorded; they may rejoin and get a new join segment (see §22 attendance algorithm — attendance is a sum of segments, not a single join/leave pair).
- Class ending: teacher explicitly ends, or scheduled-end + grace period auto-completes it if the teacher forgot.

### 5.6 Attendance rules
Covered in depth in §22 (Part 3) — the short version: presence is tracked as time-in-room, not just "did they ever join," because a 30-second drive-by join shouldn't count as attended.

### 5.7 Resource rules
- Upload/delete: teacher, scoped to own course.
- Access: only students with `ACTIVE` enrollment in that course. A student who withdraws loses download access to *new* resources but — business decision — keeps access to resources they already downloaded (you can't unsend a PDF) but not to the *live* resource list going forward. This is a policy choice you should confirm for yourself; documented as **Assumption A2** in §56.

---

## 6. State Machines

### 6.1 Enrollment

```
REQUESTED ──approve(teacher)──> ACTIVE
REQUESTED ──reject(teacher)───> REJECTED
ACTIVE ──withdraw(student)────> WITHDRAWN
ACTIVE ──remove(teacher)──────> REMOVED
REJECTED ──re-request(student)─> REQUESTED   (new document)
WITHDRAWN ──re-request(student)> REQUESTED   (new document)
REMOVED ──re-request(student)──> REQUESTED   (new document, teacher decision to re-approve)
```

Terminal-but-reversible states: `REJECTED`, `WITHDRAWN`, `REMOVED` are all terminal *for that enrollment document*, but the relationship can be re-established via a fresh `REQUESTED` document. This keeps history honest — you can see "this student was removed on date X, then re-requested and was re-approved on date Y" instead of one document silently flipping back and forth.

### 6.2 Course

```
DRAFT ──publish(teacher)───> ACTIVE
ACTIVE ──archive(teacher)──> ARCHIVED
DRAFT ──archive(teacher)───> ARCHIVED   (abandon before publishing)
```
`ARCHIVED` is terminal. No un-archiving in MVP (business decision — keep it simple; if wrong, add `ACTIVE → ARCHIVED → ACTIVE` later, it's a cheap migration).

### 6.3 Class Session — improved from your draft

Your proposed `SCHEDULED → ONLINE_PENDING → LIVE → COMPLETED` is close but missing two real states: `CANCELLED` (from any pre-live state) and a distinction between the *mode* (offline/online) and the *lifecycle* (scheduled/live/completed). I recommend modeling these as **two orthogonal fields**, not one linear chain:

```
mode: OFFLINE | ONLINE            (can change OFFLINE -> ONLINE, one-directional, see §5.4)
lifecycle: SCHEDULED -> LIVE -> COMPLETED
           SCHEDULED -> CANCELLED
           LIVE -> CANCELLED       (emergency abort mid-class)
```

Why split them: "a class is online" and "a class is currently live" are different questions. An `ONLINE` mode session is still just `SCHEDULED` until the teacher actually starts it — modeling them as one combined enum (`ONLINE_PENDING`) works but conflates two independent facts and makes queries/UI logic messier ("give me all online-mode sessions regardless of whether they've started" becomes awkward). Two fields, one compound "what should the UI show" derivation, is cleaner. This is exactly the kind of place where a proposed structure looks fine on paper but causes friction in querying — worth catching now rather than after you've built five screens around it.

### 6.4 Student account

```
INVITED (created implicitly on registration; or on first enrollment approval if using invite-first flow)
  → ACTIVATION_PENDING (email verification sent)
  → ACTIVE (verified, can log in)
  → SUSPENDED (teacher/system flags, e.g. abuse) → ACTIVE (unsuspend)
  → DEACTIVATED (self-deletion or admin action) — terminal
```
Invalid transitions worth guarding explicitly in code (not just relying on "nobody would call that"): `ACTIVATION_PENDING → SUSPENDED` shouldn't happen (you can't suspend an account that was never active) — treat as an assertion/guard, not just an omitted case.

---

## 7. Complete User Flows (representative set — full set continues to follow the same template)

### 7.1 Offline → Online conversion (the flagship flow)

| Step | User action | Frontend | API | Backend logic | DB op | Socket event | Response |
|---|---|---|---|---|---|---|---|
| 1 | Teacher clicks "Switch to Online" on a scheduled class | Confirms intent (modal) | `PATCH /api/classes/:id/mode` | Verify JWT → verify teacher owns session → verify `lifecycle=SCHEDULED` and `mode=OFFLINE` | Read session | — | — |
| 2 | — | — | — | Atomically update `mode: ONLINE`, generate `liveRoomId` | Update session (conditioned on current mode, see §18 for idempotency) | — | — |
| 3 | — | — | — | Create/reserve LiveKit room metadata | Insert/update LiveRoom doc | — | — |
| 4 | — | — | — | Build notification docs for every `ACTIVE` enrollment in course | Bulk insert Notifications | emit `class:online` to course room | 200 with updated session |
| 5 | Students see toast/banner | Listens on socket, updates UI | — | — | — | received `class:online` | "Join" button enabled |

### 7.2 Student joining a live class

| Step | User action | Frontend | API | Backend | DB | Socket | Response |
|---|---|---|---|---|---|---|---|
| 1 | Student clicks Join | — | `POST /api/live/:sessionId/token` | Verify JWT → verify enrollment ACTIVE for this course → verify session lifecycle is LIVE (or ONLINE_PENDING if waiting room enabled) | Read enrollment + session | — | — |
| 2 | — | — | — | Mint short-lived LiveKit access token scoped to this room + this identity | — | — | 200 `{ token, roomUrl }` |
| 3 | Client connects to LiveKit with token | WebRTC connect | — | LiveKit validates token independently | — | LiveKit emits participant-joined | Video/audio streams start |
| 4 | — | — | `POST /api/attendance/join-event` (or emitted via socket) | Record join timestamp | Insert attendance segment | emit `student:joined` to teacher | — |

### 7.3 Unauthorized user attempts to join

| Step | Action | Result |
|---|---|---|
| 1 | User (not enrolled, or not authenticated) hits join endpoint with a room ID they obtained somehow | REST layer checks enrollment — fails |
| 2 | — | 403 `NOT_ENROLLED`, no token issued, no room URL ever returned |
| 3 | Even if user has an old/leaked room URL | LiveKit still requires a valid, non-expired token bound to that room; connecting without one fails at the SFU layer independently |

This double-gate (REST-level + SFU-level) is intentional defense in depth — see §20.

*(The remaining flows — teacher registration, student activation, resource upload/download, announcement, disconnection handling, etc. — follow this exact same table format. I'll build these out in full in Part 3 alongside the systems they belong to, so they sit next to the algorithms that implement them rather than being a disconnected list here.)*

---

## 8. System Architecture

### 8.1 High-level component diagram

```
                        ┌─────────────────────┐
                        │   React Frontend     │
                        │ (Vercel / static)    │
                        └──────────┬───────────┘
                     ┌─────────────┼──────────────┐
                     │             │              │
                     ▼             ▼              ▼
            ┌────────────┐ ┌─────────────┐ ┌──────────────┐
            │  REST API   │ │  Socket.io   │ │  LiveKit SFU  │
            │  (Express)  │ │  (realtime)  │ │  (media)      │
            └──────┬──────┘ └──────┬───────┘ └───────┬───────┘
                   │               │                  │
                   ▼               ▼                  │
            ┌─────────────────────────────┐            │
            │        MongoDB Atlas         │◄───────────┘
            │  (system of record: courses, │   (room membership state
            │   enrollments, sessions,     │    read via REST before
            │   attendance, resources)     │    token minted)
            └──────────────────────────────┘
```

### 8.2 Why three separate communication channels

- **REST**: source of truth, transactional, cacheable, easy to authorize per-request. All *state changes* go through here.
- **Socket.io**: cheap, low-latency fan-out of "something changed, go refetch or update UI." It is not authoritative — if a socket message is missed, the client should still be correct on next REST fetch. Treat sockets as a notification bus, not a database replication channel.
- **LiveKit/SFU**: purpose-built for media; reinventing packet routing, jitter buffers, bandwidth adaptation, and simulcast in raw Socket.io/WebRTC would be a huge, unnecessary undertaking for a solo dev (detailed comparison in §19).

### 8.3 Trust boundaries

```
[Untrusted: Browser]
        │  (JWT in httpOnly cookie, or Authorization header)
        ▼
[Trust boundary #1: Express auth middleware]  — verifies WHO
        │
        ▼
[Trust boundary #2: Authorization checks in controller/service] — verifies WHAT they can touch (ownership/membership)
        │
        ▼
[Trust boundary #3: Business-rule/state checks] — verifies WHETHER it's currently allowed (state machine)
        │
        ▼
[Trusted: Database / room-token minting]
```

Every sensitive action crosses all three boundaries, every time, server-side. Section 27 covers what happens if any one of these is skipped (spoiler: IDOR, privilege escalation, or state corruption — one for each boundary).

---

*End of Part 1. Part 2 covers Database Design, ER relationships, Indexing, API specification, Route architecture, Authentication, Authorization, Student Identity Architecture (full comparison), Enrollment System detail, and the Offline→Online algorithm with pseudocode.*
