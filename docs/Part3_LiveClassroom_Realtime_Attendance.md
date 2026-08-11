# TeacherConnect — System Study & Engineering Design Document
## Part 3 of 5: Live Classroom, Real-time, Attendance, Notifications, Resources, Validation, Errors

> Continues from Part 2. This part is where the "trusted membership" model from Parts 1–2 actually gets enforced at the moment a video connection is made.

---

## 19. Live Classroom Architecture

### 19.1 The concept chain, built up from first principles

**Signaling**: before two computers can exchange audio/video, they need to exchange *metadata* about how to talk to each other — what codecs they support, what network paths are reachable. This exchange itself doesn't carry media; it needs its own channel (commonly WebSockets — this is one legitimate job for Socket.io in a pure-WebRTC design).

**SDP (Session Description Protocol)**: the actual text format of that metadata — a text blob listing supported codecs, media types, network candidates. Peer A generates an "offer" SDP, sends it via signaling to Peer B, Peer B replies with an "answer" SDP.

**ICE (Interactive Connectivity Establishment)**: the process of figuring out *which* network path two peers can actually use to reach each other, since both are typically behind NAT/routers with private IPs. ICE gathers a list of "candidate" addresses (local IP, public IP via STUN, relay via TURN) and tries them in order of preference.

**STUN (Session Traversal Utilities for NAT)**: a lightweight server that tells a client "here's what your public IP:port looks like from the outside" — lets two peers behind different NATs discover a direct path to each other in most cases. Cheap to run, doesn't relay any media traffic.

**TURN (Traversal Using Relays around NAT)**: when direct connection genuinely isn't possible (symmetric NATs, restrictive firewalls — a meaningful fraction of real-world networks, especially corporate/school networks), a TURN server relays the actual media traffic between peers. It's essentially a forced middleman — necessary as a fallback, but every byte of video now flows through your TURN server's bandwidth, which costs real money at any scale.

**Peer connection**: once ICE finds a viable path and SDP is exchanged, an `RTCPeerConnection` is established — an encrypted (DTLS-SRTP) channel carrying **media tracks** (camera, microphone, and — as a special kind of video track — screen share).

### 19.2 Why pure P2P WebRTC doesn't scale to a classroom

In pure P2P (mesh) WebRTC, every participant opens a direct peer connection to *every other* participant. For N participants, that's `N×(N-1)` connections total, and critically, **each participant's upload bandwidth must support N-1 simultaneous outbound video streams** — a teacher with 30 students would need to upload 29 copies of their own video simultaneously. This falls apart well before your stated 50-participant target; it's realistically unusable past about 4–6 participants for anything beyond audio-only.

### 19.3 SFU (Selective Forwarding Unit)

An SFU is a media server sitting in the middle: each participant uploads their video **once**, to the SFU, and the SFU forwards (routes, doesn't decode/re-encode) copies to whichever other participants need it. Upload bandwidth per participant becomes constant (one stream out), regardless of room size. This is the standard architecture for any classroom/webinar-scale product (Zoom, Meet, Teams all use SFU-class architectures, sometimes with an MCU for very large broadcast scenarios — MCU decodes+mixes+re-encodes everything into one stream, which is even more server-CPU-expensive and generally not needed at your scale).

### 19.4 Comparison table

| | P2P WebRTC | Self-hosted mediasoup | Self-hosted LiveKit | LiveKit Cloud |
|---|---|---|---|---|
| Complexity to build | Low-medium (but scaling problems appear fast) | High — you write signaling, room logic, recording, reconnection handling yourself | Medium — LiveKit provides room/track/permission abstractions and SDKs; you still run/maintain infra | Low — managed, you integrate via SDK + API keys |
| Scalability | Poor beyond ~5 users | Excellent, but you own that engineering | Excellent | Excellent |
| Cost | $0 infra (but TURN bandwidth if used) | Server costs, your engineering time | Server costs, less engineering time than raw mediasoup | Usage-based, no server ops |
| Learning value | High — you learn WebRTC fundamentals directly | Very high — you learn SFU internals, but at a steep time cost for a solo dev's first version | Medium-high — you still integrate real WebRTC concepts (tracks, permissions, tokens) without hand-rolling signaling | Medium — same client-side concepts, zero infra learning |
| Time-to-working-MVP | Fast for demo, slow to make robust | Slow | Medium | Fastest |

### 19.5 Recommendation

**LiveKit** (start with LiveKit Cloud's free/dev tier to avoid infra ops while learning; self-host later if cost or data-residency becomes a real constraint — migration path is low-friction since your application code talks to LiveKit's SDK either way, not to the raw infra). Reasoning: mediasoup gives you more low-level control and arguably "purer" learning value, but it means you are also building room membership, permission, and reconnection logic that LiveKit already provides correctly — and your actual differentiator (per your own spec) is the *authorization layer around* the video, not the media transport itself. Spending your limited solo-dev time re-implementing SFU internals doesn't serve the project's actual goal. **You still need to understand the WebRTC concept chain above** because LiveKit's client SDK is a WebRTC wrapper, not a replacement for understanding tracks/ICE/connection states — when something goes wrong (a student can't connect, e.g. hard corporate firewall with no permissive TURN egress), your debugging vocabulary is still ICE candidates and connection states, not "LiveKit is broken."

---

## 20. Live Room Security — the token model

### The wrong model (never do this)
```
Room URL: https://app.com/live/abc123
Anyone who has this URL → can join
```
This is exactly the "trust the link" pattern your spec explicitly rejects, and rightly so — links leak (screenshots, forwarded messages, browser history on shared computers).

### The correct model

```
1. Authenticated User requests to join session X
        ↓
2. REST layer: verify JWT (WHO)
        ↓
3. REST layer: verify Enrollment.status === ACTIVE for this course (MEMBERSHIP)
        ↓
4. REST layer: verify ClassSession.lifecycle is joinable (LIVE, or SCHEDULED+ONLINE if waiting room enabled) (STATE)
        ↓
5. REST layer mints a short-lived LiveKit access token:
     - scoped to exactly this room name
     - embeds participant identity (userId) and display name
     - embeds permissions (teacher: canPublish=true, canPublishScreen=true; student: canPublish=audio/video only, canPublishScreen=false)
     - expires in minutes, not hours (e.g. 10-15 min — LiveKit tokens can be short because reconnection just re-mints, see below)
        ↓
6. Client hands this token to LiveKit SDK, which independently validates it against LiveKit's own room state
        ↓
7. Media connects — but ONLY because steps 2-4 already happened; the token is a receipt of a correct decision, not a decision itself
```

**Why this is defense in depth, not redundant**: the REST layer and the SFU layer are two *independent* systems that must both agree. Even if someone could somehow forge or steal a token (they can't, without the signing key, but hypothetically), it would still be scoped to one specific room and expire in minutes. Even if someone bypassed the REST layer entirely (they can't, without your JWT signing key), LiveKit itself won't accept a token it didn't issue. Neither system alone is "the" security boundary — together they mean there is no path to media access that skips the enrollment/state checks.

**Room IDs**: not guessable — generate as a UUID or HMAC of `(sessionId, secret)`, never a sequential/predictable value, and never expose it directly to the client until after authorization succeeds (the client receives it *as part of* the token response, not queryable independently).

**Participant identity**: always the real `userId`, never client-supplied display data taken at face value for the *identity* claim (display name can be client-provided/cosmetic, but the LiveKit participant identity used for permission checks is set server-side from the JWT-verified user).

**Token revocation / force-remove**: LiveKit supports server-side "remove participant from room" via its server API — the teacher's `POST /api/live/:sessionId/remove-participant` call triggers your backend to call LiveKit's admin API directly, which disconnects that participant's media connection immediately, independent of whether their token has technically expired yet. This is how FR-24 actually works end-to-end.

**Reconnection**: because tokens are short-lived, a client reconnecting after a network blip needs a fresh token — design the frontend to silently re-request `/api/live/:sessionId/token` on reconnect (which re-runs the full authorization chain — correctly re-validating that the student is *still* enrolled and the session is *still* live, which is actually a feature: if they were removed while disconnected, the re-request correctly fails).

**Replay attacks**: a captured token replayed later fails simply because it's expired (short TTL) or the room/session has moved on (ended). No additional nonce scheme needed at this scale.

**Unauthorized room access attempt**: fails at step 3 or 4 above — no token is ever issued, so there's nothing to "join" with. This is the strongest possible guarantee: the unauthorized path never reaches the media layer at all.

---

## 21. Socket.io Architecture

### Namespaces and rooms

Use the default namespace with **Socket.io rooms** (a Socket.io room is just a server-side tag for "which sockets should receive this broadcast" — **completely unrelated to a LiveKit video room**, despite the name collision; keep this distinction very clear in your own head and your code comments, it's a common beginner confusion). Join a socket to room `course:${courseId}` on connection (after verifying the user is a teacher/owner or an active-enrolled student of that course), and to `user:${userId}` for personal notifications.

### Authentication on socket connection
```
io.use((socket, next) => {
    token = extractFromHandshake(socket)
    verify JWT → attach socket.user
    if invalid: next(new Error('unauthorized'))  // connection rejected before any room join
})
```

### Event catalog

| Event | Direction | Payload | Auth check before emit/accept |
|---|---|---|---|
| `class:online` | server→clients in `course:X` | `{ sessionId, courseId }` | Emitted only after the REST-layer mode-change succeeds (§18) |
| `class:started` | server→clients in `course:X` | `{ sessionId }` | After `/start` REST call succeeds |
| `class:ended` | server→clients in `course:X` | `{ sessionId }` | After `/end` REST call succeeds |
| `student:joined` | server→teacher (`user:teacherId`) | `{ sessionId, studentId, name }` | Emitted from the attendance join-event handler, which itself already re-validates enrollment |
| `student:left` | server→teacher | `{ sessionId, studentId }` | From leave-event handler |
| `student:removed` | server→specific student socket | `{ sessionId, reason }` | Only emitted as a result of the teacher's authorized remove-participant call |
| `chat:message` | client→server→room | `{ sessionId, text }` | Server validates sender is authorized participant of this session before re-broadcasting; never trust/broadcast client-claimed sender identity — always attach `socket.user` server-side |
| `resource:uploaded` | server→clients in `course:X` | `{ resourceId, title }` | After REST upload succeeds |
| `announcement:new` | server→clients in `course:X` | `{ announcementId, title }` | After REST create succeeds |
| `notification:new` | server→`user:userId` | `{ notification }` | Personal channel only |

**Pattern used throughout**: sockets **never originate a state change** — every emitted event is a *reflection* of a REST-layer state change that already happened and was already authorized there. The one exception is `chat:message`, which is genuinely realtime-only (not persisted as a "resource" the REST API manages) — but even it re-validates the sender's authorization server-side on receipt, never trusting the client-side socket payload's claims about who's sending.

**Failure handling**: if a socket emit fails to reach a discononected client, that's fine — per the architecture note in §8.2, sockets are a notification bus, not the source of truth; the client's next REST fetch (e.g., on reconnect/page load) will show correct current state regardless of missed socket events.

---

## 22. Attendance System

### The algorithm

```
ON join event (from LiveKit webhook or client-reported + server-verified):
    create AttendanceSegment { classSessionId, studentId, enrollmentId, joinedAt: now(), leftAt: null }

ON leave event (disconnect, explicit leave, or LiveKit webhook participant-left):
    find the OPEN segment (leftAt: null) for this student+session
    set leftAt: now()

ON session COMPLETED (or auto-timeout):
    close any still-open segments with leftAt: session.liveRoom.endedAt (handles the "forgot to leave, tab just closed" case)

Attendance duration for (student, session) = sum(leftAt - joinedAt) across all segments
Attendance percentage = duration / (session.scheduledEnd - session.liveRoom.startedAt) × 100
```

### Why segment-summing, not a single join/leave pair, is necessary

Real network behavior — refresh, brief disconnect, phone call interruption, switching wifi — produces multiple join/leave cycles per student per class. A naive single-pair model either (a) overwrites the first join time on reconnect, silently losing the fact that they were present earlier, or (b) overwrites leave time only, undercounting a student who dropped and came right back. Summing durations across segments is the only model that's actually correct against real usage.

### Handling specific edge cases

- **Multiple tabs**: each tab opening a new socket/LiveKit connection could create overlapping segments for the same student. Recommended: enforce single-active-connection per (student, session) at the LiveKit room level (LiveKit supports this — a new connection with the same identity can be configured to kick the old one) so you don't have to reconcile overlapping segments after the fact.
- **Multiple devices**: same issue, same recommended resolution — one active presence per student per session, simplest and matches real-world "you're either in class or not."
- **Fake attendance** (student joins, immediately mutes/backgrounds tab, walks away): out of scope for a v1 heuristic beyond time-present — you could add an "active tab" heartbeat check later, but don't over-engineer this for MVP; note it as a known limitation, not a bug.
- **Teacher manual correction**: a separate `AttendanceSegment` with `source: MANUAL_CORRECTION`, `correctedBy: teacherId` — never mutate the system-recorded segments in place; add a correcting entry so the audit trail (§36) shows both the original automated record and the human override.

---

## 23. Notification System

- **In-app**: `Notification` document created (§9.9) + `notification:new` socket emit for instant delivery while online; unread badge driven by REST `GET /api/notifications?unread=true` for anyone who wasn't connected at emit time.
- **Real-time**: the socket emit above — purely a UX accelerant, not the source of truth (the DB write is).
- **Email**: fire-and-forget via Nodemailer for high-value events only (enrollment approved/rejected, class went online) — not for every chat message or minor event, to avoid notification fatigue and because email delivery is inherently best-effort/slow (§3 NFR table already sets this expectation).
- **Duplicate prevention**: notification creation happens exactly once, inside the same service call that performs the underlying state change (e.g., enrollment approval creates exactly one notification as part of that transaction/call) — not from a separate "listen for DB changes and notify" layer, which would risk double-firing on retries. If you do add retry logic to the fan-out job later, make it idempotent by checking "does a notification of this type already exist for this event" before inserting.
- **Preferences**: not in MVP — documented as a future item (§45 in Part 5).

---

## 24. Resource / Notes System

- **Upload**: teacher-only, scoped to `courseId`, file goes to object storage (Cloudinary/S3/R2 — full comparison in Part 4 §28-adjacent discussion), URL + metadata stored in `resources` collection.
- **Access control**: every download request re-checks `Enrollment.status === ACTIVE` for the requesting student in that resource's course — **never** rely on an unguessable URL alone as the access control (URLs get shared, cached, forwarded). Recommended: signed, short-lived URLs (S3/R2 presigned URLs, or Cloudinary's signed delivery) minted per-request after the enrollment check, same pattern as the LiveKit token model in §20 — you're reusing the exact same "authorize, then mint a short-lived credential" shape you already built for video, which is a good sign the pattern is sound.
- **Delete**: teacher-only, soft delete (`deletedAt` field, §9.7) so already-downloaded links don't 404 in a confusing way and audit history is preserved.
- **Post-withdrawal access**: per §5.7's policy call — new resources become inaccessible immediately on withdrawal/removal (re-checked live on every download request, so this needs no special "revoke" step, it's automatic from the enrollment-status check).

---

## 25. Validation Logic (representative set)

| Field | Type | Required | Rules |
|---|---|---|---|
| `user.email` | String | Yes | Valid email format, lowercase-normalized, max 254 chars |
| `user.password` (registration only, never stored) | String | Yes | Min 8 chars, at least one letter + one number (don't over-engineer complexity rules — length matters more than character-class gymnastics) |
| `course.title` | String | Yes | 3-150 chars, trimmed, HTML-stripped/sanitized before storage (XSS prevention, §27) |
| `classSession.scheduledStart/End` | Date | Yes | `scheduledEnd > scheduledStart`; both must be in the future at creation time |
| `enrollment` request | — | — | No body needed beyond `courseId`; server derives `studentId` from JWT, never from body (IDOR prevention) |
| `resource.file` | Upload | Yes | MIME allowlist (PDF, common image types, docx/pptx if needed), max size (e.g. 25MB), filename sanitized (strip path separators, control chars) — full detail in Part 4 §28 |
| `announcement.body` | String | Yes | Max 5000 chars, sanitized |

**General rule**: validate shape/type/length with Zod at the middleware layer (fast-fail before any DB hit), and treat **all string fields that get rendered back to other users** (course titles, chat messages, announcement bodies) as requiring output-encoding/sanitization against stored XSS — validation alone (rejecting bad input) is necessary but not sufficient; sanitize-on-render (or sanitize-on-store with a strict library like `sanitize-html`) is the second layer.

---

## 26. Error Handling

### Standard response shape

```json
// Success
{ "success": true, "data": { ... } }

// Failure
{
  "success": false,
  "message": "Human readable message",
  "code": "ENROLLMENT_ALREADY_EXISTS",
  "errors": []   // field-level validation errors, if applicable
}
```

### Status code usage

| Situation | Status | Example `code` |
|---|---|---|
| Validation failure | 400 | `VALIDATION_ERROR` |
| Not authenticated / bad token | 401 | `UNAUTHORIZED` |
| Authenticated but not allowed (ownership/membership fail) | 403 | `FORBIDDEN` |
| Resource doesn't exist | 404 | `NOT_FOUND` |
| Valid request, wrong current state (e.g. approve an already-approved enrollment) | 409 | `INVALID_STATE` |
| Duplicate/uniqueness conflict | 409 | `ALREADY_EXISTS` |
| Rate limit hit | 429 | `RATE_LIMITED` |
| Unexpected server/DB error | 500 | `INTERNAL_ERROR` (never leak stack traces or DB error internals to the client) |
| External service failure (LiveKit, email, storage) | 502/503 | `SERVICE_UNAVAILABLE` — degrade gracefully where possible (e.g., DB state change still succeeds even if email notification fails, per §18/§23) |
| WebRTC/socket-specific failure | handled client-side via connection-state events, not HTTP status — surface a reconnect UI state |

**Centralize this**: one Express error-handling middleware at the end of the chain that catches thrown errors (including Mongoose validation errors, cast errors, duplicate-key errors) and maps them to this shape — controllers/services should throw typed errors (e.g., a small `AppError(code, message, httpStatus)` class) rather than each individually constructing response JSON, so the shape stays consistent everywhere without repetition.

---

*End of Part 3. Part 4 covers: Security Architecture (OWASP-mapped), File Upload Security, API Security middleware stack, Frontend/Backend folder structures, Data Flow diagrams for key operations, core Algorithms in pseudocode, Concurrency/Race-condition catalog, and the full Edge Case checklist.*
