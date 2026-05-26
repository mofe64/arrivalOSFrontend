# ArrivalOS Frontend — UI / UX Deep-Dive Review

> Audit target: `arrivalOSFrontend/frontend` (React 19 + Vite + TanStack Router + TanStack Query). 31 source files, ~3,450 LOC.
> Reviewer focus per request: trip creation, trip management, concierge creation, concierge trip updates, admin actions on trips.
> Method: read of every route + component + API surface, cross-referenced against six provided screenshots (admin dashboard, trips list, concierges, invitations, notifications, trip detail).

> **Status (update):** Sprint-1 P0 frontend work has shipped. See [§14 Patch Log](#14-patch-log--what-shipped) at the bottom for what changed, what file, and what is still open.

---

## 1. Objective

Identify everywhere the product currently feels generic, AI-templated, visually inconsistent, or operationally awkward — and produce a prioritized remediation plan so ArrivalOS reads as a purpose-built ops console rather than a brochure.

## 2. Approach

Three lenses applied in order:

1. **Visual / brand audit** against the screenshots — typography, hierarchy, color, density.
2. **AI-slop pattern audit** — repeated templates, marketing-speak, vestigial decoration, redundant copy.
3. **Workflow audit** of the four major flows (trip create → manage, concierge create → field updates, admin destructive actions). Each step examined for: required field clarity, confirmation discipline, error handling, recoverability, mobile fitness, accessibility, and round-trip cost.

Findings are graded:

- **P0** — ship-blocker, safety, data integrity, or "looks broken"
- **P1** — meaningful UX friction or visible polish problem
- **P2** — cleanup / consistency

File pointers use `path:line` so each item is one click from action.

---

## 3. Top-Line Verdict

The product is functionally complete for an MVP, but visually it reads as **"AI-templated luxury SaaS"** rather than an ops console. Three forces are at war on every screen:

| Force | Where it lives | Effect |
|---|---|---|
| **Editorial luxury** | `Cormorant Garamond` serif, large display sizes, "eyebrow" labels | Slows scan, dominates space |
| **Marketing tone** | "Trusted arrival command", "Source of truth", "Field operator records" | Buries the verb |
| **Ops density needs** | Tables, status pills, forms, queues | Squeezed into 600px center column |

The first two are crushing the third. Ops people glance at this dashboard while a flight is landing — they do not need a magazine cover. Everything in §6 and §7 below traces back to this central tension.

The codebase itself is **clean, small, and well-typed**. There is no React performance fire to fight, no state-management chaos, no bundle bloat. The work is almost entirely:

- pruning visual noise,
- adding confirmation/recovery affordances on destructive actions,
- collapsing the eight-different-heading-systems into one type scale,
- fixing a few real bugs (cancel-trip with no confirm, status-pill data-tone falling through to default, AccessToken in URL query string).

---

## 4. Top Five Things To Fix First (P0)

1. ~~**Cancel Trip has no confirmation and ships a hardcoded note.**~~ ✅ **Shipped.** Replaced inline danger button with a native `<dialog>` that requires typing the flight number and a free-text reason before enabling the confirm button. See `AdminTripDetail.tsx:411-510` and `.confirm-dialog` styles in `index.css`.
2. ~~**Concierge access token is in the URL query string.**~~ ✅ **Shipped (partial mitigation).** Token is now read preferentially from URL fragment `#token=`; legacy `?token=` queries are promoted to the fragment in-place via `history.replaceState` on first load. Admin-issued copyable links are rewritten through `toFragmentLink()` before display/copy. See `src/api/accessToken.ts`, `ConciergeTripPage.tsx:215-224`, and `AdminTripDetail.tsx:282-289`. ⚠ **Backend follow-up still required**: long-term, the token should be POST-redeemed for a short-lived `HttpOnly` cookie. The fragment mitigation is a partial step — it stops the token reaching server logs and referrers but it still lives in `window.location`.
3. ~~**Status pill tones silently fall through to default blue.**~~ ✅ **Shipped.** Every `TripStatus` is now mapped to one of five tones (`scheduled / active / watch / complete / danger`) by a single `statusTone()` function in `format.ts:57-77`. Five CSS rules added (`index.css:317-336`); every consumer (`AdminDashboard.tsx:90`, `AdminTrips.tsx:103`, `AdminPrincipals.tsx:53`, `AdminNotifications.tsx:58`) now calls it. Also added a colored-dot glyph (`::before`) so status is encoded non-color — addresses §8 accessibility miss.
4. **`withFixtureFallback` swallows backend errors in dev.** *(Unchanged — frontend-only fix queued for Sprint 2 with a demo-data banner.)* `api/fallback.ts:11` still returns canned data for any non-401/403 error.
5. **Auth tokens stored in plain `localStorage`.** *(Backend-required — deferred.)* `auth/session.ts:36`. Mitigation needs an `HttpOnly` refresh-cookie endpoint on the backend; cannot be remediated client-only without losing refresh functionality.

Additional sub-P0 work that shipped alongside:
- **Offline queue no longer re-enqueues 4xx errors** *(TM/CT-5)* — see `ConciergeTripPage.tsx:80-91, 105-118`.
- **Trip-create wizard now validates per step and blocks out-of-order navigation** *(TC-2/TC-8)* — see `AdminTripCreate.tsx:42-67, 86-101`.
- **CSS `--brand-gold` typo fixed** *(TM-14)* — `index.css:602`.
- **Dashboard "Last event" column uses `eventLabel()`** *(AA-1)* — `AdminDashboard.tsx:91`.

Remaining open work after this patch: §4.4 demo-data banner, §4.5 cookie-backed auth, plus all Sprint-2 and Sprint-3 items.

---

## 5. Visual Audit (against the six screenshots)

### 5.1 Type system: there isn't one

The CSS has **eight** distinct heading rules with overlapping `clamp()` ranges:

| Class | Selector lines | Range |
|---|---|---|
| `.section-header h1` | `index.css:273` | `clamp(38px, 4vw, 56px)` |
| `.admin-workspace > .section-header h1` | `index.css:274-277` | `clamp(34px, 3.2vw, 46px)` |
| `.status-band h1` | `index.css:326` | `clamp(38px, 5vw, 68px)` |
| `.dashboard-header h1` | `index.css:235` | `clamp(34px, 4vw, 54px)` |
| `.brand-lockup h1` | `index.css:90` | `clamp(32px, 4vw, 48px)` |
| `.mission-copy h2` | `index.css:92` | `clamp(42px, 7vw, 88px)` |
| `.principal-trip-card h2` | `index.css:766` | `clamp(32px, 6vw, 48px)` |
| `.meeting-point h2` | `index.css:770` | `clamp(34px, 6vw, 54px)` |

All use the same serif (`Cormorant Garamond`). At a 1280px viewport the first two render at 51 / 41 px — large enough to dominate, close enough to look like a mistake. **P1.**

**Fix.** Adopt a five-step type scale (e.g. `--text-3xl 32`, `--text-2xl 26`, `--text-xl 20`, `--text-lg 17`, `--text-base 15`) and delete every `clamp()` heading. Reserve the serif for one place only — the brand lockup. Everything else stays in Inter.

### 5.2 The eyebrow + giant H1 + paragraph + chip-strip template

Open the screenshots side-by-side and the same composition repeats on every page:

```
EYEBROW (uppercase, tracked)
Cormorant H1 (42–68px)
Inter body paragraph (60ch)
[chip] [chip] [chip]
```

It appears on the dashboard hero (`AdminDashboard.tsx:37-53`), trip status band (`ArrivalComponents.tsx:26-52`), section headers (`Primitives.tsx:59-77`), trip cards (`PrincipalTrips.tsx:42-46`), and every `panel-heading`. **This is the single strongest "AI tell" in the UI.** A human-led design would vary by page weight: a list page does not need a status-band hero, and the dashboard does not need both a hero AND a metric row AND a `command-state` chip strip telling you the same numbers (screenshot 1).

**Fix.** Collapse to two compositions:
- **List/index pages**: small `H2 + subtitle` row, no hero, action button right-aligned.
- **Detail pages**: status band only on trip detail (where state is the primary headline). Nothing else gets a hero.

Delete the `command-state` chip strip on the dashboard — the metric cards directly underneath already say "3 need attention" and "Email failures 1".

### 5.3 Brand hierarchy is inverted

`AdminShell.tsx:31-36` renders:

```
ARRIVALOS  ← tiny uppercase eyebrow
Admin      ← huge serif H2-equivalent (28px bold)
```

A first-time viewer reads the product name as "Admin". The actual brand "ArrivalOS" is the tiny line above it. The same is true in screenshot 3 ("ARRIVALOS / Admin" in the top-left logo block).

**Fix.** Move "Admin" to a small tag pill next to the wordmark: `[ArrivalOS] Admin`. Or drop the word "Admin" — the sidebar already conveys it.

### 5.4 Status band swallows the fold on trip detail

Screenshot 6 shows `Flight landed` rendering at ~52px serif on a navy gradient slab consuming the top 200px of the viewport. Below that sits a 470px-tall timeline panel and only THEN the admin action card — which is the actual reason an ops user opened this page. **P1.**

**Fix.** Halve the band height. Move the metadata (`Principal / Flight / Airport / Last updated`) onto a single line of caps text, not a two-column dl with chips. The current state should be a 20px label, not a 52px headline.

### 5.5 Concierge directory looks broken

Screenshot 3, top right: there is a near-invisible label "Active records" or similar (greyed almost to transparent) on the right edge of the "Concierge list" header. Source: `AdminConcierges.tsx:67` — `{conciergesQuery.isFetching ? 'Syncing' : 'Live records'}` rendered with no styling, picking up the panel's pale color. Reads as a rendering bug. **P1.**

**Fix.** Wrap in `<span className="panel-meta">` with explicit color: `var(--muted)`, font-weight 800. Or remove — "Live records" adds nothing.

### 5.6 Disabled-button affordance is invisible

The "Create concierge" and "Send invitation" buttons (screenshots 3, 4) render in the same `--action-blue` background as enabled buttons but at 55% opacity. On a white panel the difference is too subtle — looks like a light-blue brand button, not a "fill required fields first" hint. **P1.**

**Fix.** Switch disabled state to a flat neutral fill (`background: var(--surface); color: var(--muted); border-color: var(--line)`). And label why it is disabled: "Fill name, phone, and public ID to enable".

### 5.7 The decorative noise

- **Graph-paper background** on `.admin-shell`, `.login-screen`, `.concierge-shell` (`index.css:50-55, 174-178, 776-781`). Repeats a 44px grid that adds nothing functional and shows through every panel gap. Reads as "design system demo".
- **`metric-card::after` blue dot** (`index.css:261`). A 9px disc in the corner of every metric card with no label. Looks like a notification badge that never resolves.
- **Gold underline** `box-shadow: inset 0 -4px 0 var(--active-gold)` on `.status-band[data-tone='active']` (`index.css:325`). Visible in screenshot 1 only if you squint.
- **Multi-line drop shadow** `0 18px 50px ...` applied to every panel (`--shadow` in `index.css:16`). At 50px blur the shadow extends well past panel boundaries and creates a soft, "every card floats" feel that flattens hierarchy.

Pick one decoration per page. Right now everything is decorated, so nothing is.

### 5.8 Color story for trip status

`statusTone()` in `format.ts:57-63` returns five tones (`danger / complete / scheduled / active / watch`). The CSS only styles `watch` and `complete`. The dashboard table sets `data-tone={trip.status.toLowerCase()}` which can produce `flight_landed`, `client_met` etc. — none of which are styled.

**Net effect:** in real use almost every status pill is the default blue, defeating glanceability.

**Fix.** Map every `TripStatus` to one of four tones (`scheduled / active / warning / complete / danger`) in `format.ts`, and have every consumer call `statusTone(trip.status)` — never the raw `.toLowerCase()`.

### 5.9 Phone numbers, IDs, dates

- Phones display as `07516395337` (screenshot 6) — no formatting. `+44 7700 900123` from fixtures shows formatting drift between manual and fixture data.
- Trip IDs surface as `d8f4dd37` (first 8 UUID chars, `AdminTrips.tsx:72`) in the user-facing "TRIP" column. UUID slices are not human identifiers — they are debug breadcrumbs.
- Dates use `Intl.DateTimeFormat` with the browser default locale (`format.ts:38`). Ops in Lagos see different times than ops in London if they don't share locale. Lock to airport timezone or display both.

**Fix.** Generate a human trip code on the backend (e.g. `BA075-MMA-0528-01`) and surface that as the user-facing identifier. Format phones with `libphonenumber-js` (3kb, tree-shakes well).

### 5.10 Dashboard action buttons stack vertically

Screenshot 1, top right: "New trip / Add principal / Invite account" stacked in a narrow column on a 1920px screen. `AdminDashboard.tsx:48-52` uses `.dashboard-actions { display: grid; gap: 10px; min-width: 180px }` — `grid` without explicit columns defaults to one. Wasted horizontal real estate, and three buttons stacked creates an "important options" vibe for actions where only one is the primary CTA.

**Fix.** Promote "New trip" to the only primary button. Demote the other two to a `…` overflow menu, or move "Add principal" and "Invite account" off the dashboard entirely (they have dedicated nav pages).

---

## 6. AI-Slop Patterns (code-level)

These are the patterns that read most strongly as "generated, then never edited." Each maps to a specific cleanup.

### 6.1 The terminology zoo

The same thing has 3+ names across the UI:

| Concept | Names used |
|---|---|
| Concierge | "Concierge", "Field operator", "Operator record", "GGS-…" |
| Watcher | "Watcher", "Email recipient", "Notification recipient", "Email watcher" |
| Trip | "Trip", "Arrival", "Arrival workflow", "Arrival timeline", "Trip-scoped" |
| Admin | "Admin", "Ops", "Gbèjà ops", "Command" |

The screenshots show "Field operator records" as the page title for concierges (screenshot 3), "Concierge list" as the panel heading, and "CONCIERGE" as the eyebrow on each item — three terms on the same page. **P1.**

**Fix.** Adopt one term per concept in a glossary doc, then global-replace. Suggested:

- Concierge (drop "field operator", "operator record")
- Watcher (drop "email recipient", "notification recipient" in admin contexts; keep "Email recipient" on the principal-facing card where the principal needs the plain word)
- Trip (drop "arrival workflow", "arrival timeline register")
- Ops (drop "command", "Gbèjà ops" in UI chrome; keep "Gbèjà" for the brand)

### 6.2 Marketing voice on operational chrome

Examples currently in copy (`grep -n "eyebrow"`):

- `"Trusted arrival command"` — login (`AuthPages.tsx:33`)
- `"Continue securely"` — login button (`AuthPages.tsx:71`)
- `"Source of truth"` — timeline panel eyebrow (`AdminTripDetail.tsx:95`)
- `"Customer-safe updates"` — principal timeline chip (`PrincipalTripDetail.tsx:66`)
- `"Trusted updates"` — concierge timeline chip (`ConciergeTripPage.tsx:196`)
- `"Live board"` — dashboard chip (`AdminDashboard.tsx:44`)
- `"Trip-scoped access link"` — three places

Ops users read this every day. After day two, "Source of truth" is decorative weight. **P2.**

**Fix.** Strip every chip / eyebrow whose only job is to reassure. Keep eyebrows when they categorize (e.g. `OPS DASHBOARD`, `INVITATIONS`).

### 6.3 Repeated subheading templates

Every section in `AdminTripDetail` uses this six-line block (`AdminTripDetail.tsx:311-356`):

```tsx
<div className="subsection-heading">
  <div>
    <p className="eyebrow">Principal record</p>
    <h3>People on this trip</h3>
  </div>
  <span>{principals.length} listed</span>
</div>
```

The eyebrow is decorative and the heading already conveys the section. The pattern repeats 3× in the admin actions card and gives the whole panel a "documentation page" feel rather than an "act now" feel.

**Fix.** Reduce to a single `<h3>` per section, optional right-side count badge.

### 6.4 The clamp() epidemic

22 separate `clamp()` calls in `index.css`. At common breakpoints (1024 / 1280 / 1440 / 1920) most produce non-multiple-of-2 sizes (e.g. 47.6px). Visual rhythm depends on consistent step values; `clamp()` over 30px ranges destroys that.

**Fix.** Replace with a 4-step responsive scale via container queries or explicit media-query overrides — not per-element clamps.

### 6.5 `eyebrow` used 30+ times

Every page leads with a tiny uppercase tracked label above the headline. It is fine once. After the 30th appearance it becomes the visual signature of the app — and the signature is "AI-templated dashboard".

`grep -rn 'className="eyebrow"' src | wc -l` → **31**.

**Fix.** Allow the eyebrow only on the page-level hero. Strip from every panel, card, table, sidebar item.

### 6.6 Duplicated information across cards

Dashboard screenshot 1 shows the number "3" three times in close proximity:
- `3 need attention` chip (top hero)
- `Active trips 3` metric card
- `Needs attention 3` metric card

`Email failures: 1` appears in the chip AND the metric. The dashboard is repeating itself to fill space.

**Fix.** Pick one. Recommend: drop the chip strip entirely, keep the metrics.

---

## 7. Workflow Audit

### 7.1 Trip creation (`AdminTripCreate.tsx`, 159 LOC)

| # | Finding | Severity | Fix |
|---|---|---|---|
| TC-1 | 4-step wizard with no progress indicator. Step buttons say "details / principals / recipients / operations" — capitalized via CSS but never numbered. User cannot tell if they are 1 of 4 or 4 of 4. | P1 | Number the steps; add a progress bar. |
| TC-2 | ✅ **Shipped.** Required fields (`flightNumber`, `arrivalAirport`) now validated per step. Continue button disabled when invalid; inline error renders above the form. `AdminTripCreate.tsx:42-67, 87-102`. | ~~P0~~ | done |
| TC-3 | Only **one principal** supported at create. Detail page supports many. Asymmetric. | P1 | Either drop add-principal from detail and force re-edit at create, or allow multiple at create. |
| TC-4 | Default checkpoints as a single `<textarea>` of newline-separated names (`AdminTripCreate.tsx:130`). No reorder, no add/remove UI, no validation. A trailing blank line silently becomes a checkpoint. | P1 | Replace with a sortable chip-input. |
| TC-5 | Only **one watcher** supported at create (`AdminTripCreate.tsx:110-111`). Detail page allows many. | P1 | Allow `add another` on the create step. |
| TC-6 | `datetime-local` with no timezone surface. Lagos ops typing "19:08" do not know if the system stores LOS local or browser local. The code (`AdminTripCreate.tsx:47`) calls `new Date(scheduledArrivalAt).toISOString()` — uses browser locale. | P1 | Show timezone next to the field; offer "airport local" toggle. |
| TC-7 | No save-as-draft. Refresh wipes 4 steps of input. | P2 | Persist form state to `sessionStorage` per step. |
| TC-8 | ✅ **Shipped.** Wizard nav now disables steps past the "farthest reachable" step computed from per-step validity. `AdminTripCreate.tsx:91-105`. | ~~P0~~ | done |
| TC-9 | On success → `navigate({ to: '/admin/trips/$tripId' })` (`AdminTripCreate.tsx:57`). No toast confirms "Trip BA075 created". | P2 | Show inline success on detail page first load. |
| TC-10 | "Back" on step 1 calls `previousStep('details')` which returns `'details'` (`AdminTripCreate.tsx:155-159`) — same step. Button does nothing. | P2 | Disable Back on first step, or replace with "Cancel" → navigate to trips list. |

### 7.2 Trip management (`AdminTripDetail.tsx`, 478 LOC — the biggest screen)

This is the page in screenshot 6. It is the operational heart of the product.

| # | Finding | Severity | Fix |
|---|---|---|---|
| TM-1 | ✅ **Shipped.** Cancel button now opens a native `<dialog>` requiring (a) typed flight number, (b) free-text reason. Reason text is what's sent to `cancelTrip()`. `AdminTripDetail.tsx:411-510`, `.confirm-dialog` styles in `index.css`. | ~~P0~~ | done |
| TM-2 | Three independent forms in one card (timeline event, add principal, add watcher) with no visual separation beyond a thin border. User cannot scan the panel for "what action am I about to take". | P1 | Make each section a separate `<details>` accordion, or split into three cards. |
| TM-3 | Concierge assignment is two-step: select → "Assign" → then "Issue access link" becomes enabled. The button-state derivation (`canAssignConcierge`, `canIssueAccessLink` at `AdminTripDetail.tsx:243-244`) is non-obvious. | P1 | Combine into one button: "Assign and issue link" when both are valid. |
| TM-4 | No way to **edit flight details** (terminal, meeting point, scheduled time) after create. Real ops correct these constantly. | P0 | Add inline-edit on the `InfoPanel` rows. |
| TM-5 | No way to **remove a watcher** or **remove a principal** once added. Add-only UX. | P1 | Add a delete icon per row in the right-rail lists. |
| TM-6 | "Copy link" button (`AdminTripDetail.tsx:404`) calls `navigator.clipboard.writeText` but no toast confirms copy. User has no feedback. | P2 | Inline "Copied" affordance for 2s. |
| TM-7 | Access link expiry hardcoded to 12 hours in the API layer (`arrivalos.ts:130`). No UI to extend, no UI to revoke. | P1 | Surface "Expires in 12h" + Revoke button + Extend dropdown. |
| TM-8 | Timeline event submission has **no optimistic update**. User waits for full round-trip + refetch. On 3G airport WiFi this is multi-second. | P1 | Optimistic insert into timeline, rollback on error. |
| TM-9 | Email notification attempts panel shows status only — no "Retry" for failures, no "View email body". | P1 | Add Retry on failed rows, and a "Preview last sent" modal. |
| TM-10 | Heading hierarchy in admin actions card: H2 ("Next operational move") + three H3 subsections, all rendered in the same Cormorant Garamond. The visual weight implies they are siblings. | P1 | H2 stays serif, H3 becomes Inter 18px semibold. |
| TM-11 | "Notification recipients" panel (right rail) and "Email watcher" admin action (center) live in different places but show the same data. | P2 | Put the add-form inline above the list on the right rail. |
| TM-12 | `addEvent.error`, `assignError`, `issueAccessLinkError`, `cancelError`, `addWatcherError`, `addPrincipalError`, plus `tripQuery.error` — seven separate `<ApiErrorMessage />` slots, each a full-width red panel when triggered. A single field-level error can dump three of these. | P1 | One toast/snackbar bus per page; remove inline panels except for query failure. |
| TM-13 | The fixture fallback `{ ...fixtureAdminTripDetail, id: tripId }` (line 26) means a non-existent trip ID shows the demo trip with the wrong header. Confusing in dev. | P1 | Distinct "trip not found" screen. |
| TM-14 | ✅ **Shipped.** Fixed undefined `--brand-gold` → `--active-gold`. `index.css:602`. | ~~P0~~ | done |

### 7.3 Concierge creation (`AdminConcierges.tsx`, 103 LOC)

Page in screenshot 3.

| # | Finding | Severity | Fix |
|---|---|---|---|
| CC-1 | `photoUrl` is a freetext input (`AdminConcierges.tsx:56`). No file upload, no preview, no validation that the URL is reachable. | P1 | Drag-drop upload + 5-second preview before save. |
| CC-2 | Public ID is freetext with placeholder `GGS-NAME`. No derivation from full name, no collision check, no format mask. Easy to type `GGS-femi` twice. | P1 | Auto-derive `GGS-{FIRSTNAME}` on name change, allow override, validate uniqueness on blur. |
| CC-3 | Phone field accepts any string — no formatting, no country code, no validation. | P1 | `libphonenumber-js` mask with country selector. |
| CC-4 | No edit / deactivate UI for an existing concierge. Create-only. | P0 | Click row to edit; toggle active state. |
| CC-5 | No search / filter on directory. At 50+ concierges this becomes unusable. | P1 | Search input above the list (mirror the Trips page filter). |
| CC-6 | Create-success path silently clears the form. No "Tunde added" toast. | P2 | Confirmation toast + scroll new row into view. |
| CC-7 | The page title is "Field operator records" but the create panel is labeled "Create concierge" and the directory panel is "Operator records" — three terms across one screen. | P1 | See §6.1. |

### 7.4 Concierge trip updates (`ConciergeTripPage.tsx`, 201 LOC)

This is the field-side page — the concierge opens it on a phone at the airport.

| # | Finding | Severity | Fix |
|---|---|---|---|
| CT-1 | ✅ **Shipped (partial).** Token now read from `#token=`; legacy `?token=` promoted to fragment via `history.replaceState`. Admin-generated copyable links rewritten via `toFragmentLink()` before display/copy. See `src/api/accessToken.ts`, `ConciergeTripPage.tsx:215-224`, `AdminTripDetail.tsx:282-289`. ⚠ Backend follow-up: POST-redeem for short-lived `HttpOnly` cookie remains the long-term fix. | ~~P0~~ → P1 (backend) | done (FE) |
| CT-2 | Single "Next action" button drives the whole flow (`ConciergeTripPage.tsx:172-186`). No way to **undo** an erroneous transition (e.g. tapped "Client met" before client appeared). | P1 | Allow concierge to file a "correction" event; admin reviews and reverts. |
| CT-3 | "Field note" textarea persists across transitions (`ConciergeTripPage.tsx:30`). User can type a note for one event then forget; next button-press attaches it to the next event. Cross-contamination of notes. | P1 | Clear note on success (already done) **and** show the note attaching to a labeled action ("This note will be attached to: Flight landed"). |
| CT-4 | `navigator.onLine` is the only connectivity signal (`ConciergeTripPage.tsx:51, 161`). On mobile this only reports interface status, not real connectivity. Concierge sees "Online" while requests time out. | P1 | Heartbeat ping every 20s; show "checking…" or "limited connectivity" state. |
| CT-5 | ✅ **Shipped.** `onError` now short-circuits on `ApiError` 4xx (`ConciergeTripPage.tsx:80-91`). `syncQueued` also catches per-action errors and discards on 4xx instead of throwing out of the loop (`ConciergeTripPage.tsx:105-118`). New `isClientError()` helper at file bottom. | ~~P0~~ | done |
| CT-6 | No call/SMS shortcut to the principal. Principal phone is buried in the identity block but not actionable. | P1 | Render the principal's phone as `tel:` and `sms:` icon-buttons in the focus panel. |
| CT-7 | Checkpoints panel is read-only — strict linear flow only. If immigration is unusually slow, concierge cannot mark Customs started early or skip a checkpoint. | P1 | Allow start/skip per-checkpoint with a confirmation. |
| CT-8 | No preview of what the principal sees. Concierge cannot answer "did my last update reach them?" without calling ops. | P1 | "What the principal sees" disclosure showing last-customer-safe-update. |
| CT-9 | "Sync now" button only appears when `navigator.onLine && queue.length > 0` (`ConciergeTripPage.tsx:163-165`). When offline with a queue, no manual retry — must wait for `online` event. | P2 | Always show, just disable when offline. |
| CT-10 | `crypto.randomUUID()` is called inline at click time (`ConciergeTripPage.tsx:181`). Fine, but the same idempotency-key is not reused on retry — if a queued action partially succeeded server-side, retry creates a duplicate. | P1 | Generate key once at enqueue, use the same key on every retry (already the case for queued actions, but the in-flight `submitEvent.mutate` path generates fresh at click, then re-enqueues with the same on error — verify). |

### 7.5 Admin actions on trips (cross-cutting)

| # | Finding | Severity | Fix |
|---|---|---|---|
| AA-1 | ✅ **Shipped.** Dashboard now calls `eventLabel(trip.lastTimelineEvent.eventType)` (`AdminDashboard.tsx:91`). | ~~P1~~ | done |
| AA-2 | "Open trips" link from dashboard goes to all trips (not active-only). Filter intent mismatch with hero label "Live board". | P2 | Pass `?filter=active` to trips page. |
| AA-3 | Trips table rows are not clickable — only the truncated UUID is a link (`AdminTrips.tsx:72`). Hover state suggests row interactivity (`tbody tr:hover` at `index.css:308`), but only one cell is actionable. | P1 | Wrap whole row in `<Link>` (or use a router `<TableRow>` component). |
| AA-4 | Notifications page has no sort, no pagination, no date filter (`AdminNotifications.tsx`). Renders the full list. | P1 | Add sort + 50-row pages. |
| AA-5 | No audit trail for cancellations beyond the timeline event (with hardcoded note). Ops cannot answer "who cancelled and why" later. | P1 | Surface actor + free-text reason on the cancelled event. |
| AA-6 | No bulk actions anywhere (assign concierge to N trips, mark N attempts retried). | P2 | Multi-select on tables. |
| AA-7 | No global search / command palette. Finding a trip by passenger name requires landing on the Trips page first. | P2 | `cmd-k` palette across trips/principals/concierges. |
| AA-8 | Dashboard `attemptsQuery` fires **one HTTP request per trip** to load notification attempts (`AdminDashboard.tsx:19-29`). At 50 active trips that is 50 concurrent calls per dashboard load. Same in `AdminNotifications.tsx:18-29`. | P0 | Add a single `/admin/notification-attempts?active=true` endpoint or batch by ID list. |

---

## 8. Accessibility

| Item | Status | Note |
|---|---|---|
| Touch targets ≥44px | ✅ | enforced on buttons/inputs |
| Color-only status | ❌ | pills depend on hue (red/amber/green) with no icon/text differentiation beyond the label |
| Destructive confirmation | ❌ | Cancel trip has no second step |
| Focus visible | ✅ | `:focus-visible` rules in place |
| `aria-live` for async state | ❌ | `LoadingState` has `role="status"` but timeline mutations don't announce |
| Skip-to-content link | ❌ | absent |
| Segmented control keyboard nav | ⚠️ | `role="radio"` set on `<button>` but no arrow-key handler (`PrincipalLinkFields.tsx:38-58`) |
| Form labels | ⚠️ | Inline-form uses placeholder + `aria-label` only; screen readers OK, sighted users lose label when typing |
| Form error summarization | ❌ | Field errors render under one toast; no per-field association |

### 8.1 The biggest acc miss: status pills

`.trip-status` carries only color and text. A red-green colorblind user (~4% of male users) reads "watch" and "active" identically. Add a leading icon or letter glyph (○ / ◐ / ●) to encode state non-color.

---

## 9. Information Architecture

Top-level admin nav (`AdminShell.tsx:7-14`) has six items: Dashboard, Trips, Principals, Concierges, Invitations, Notifications.

Observations:

1. **Dashboard and Trips overlap.** Dashboard shows the same active-arrival table that the Trips page does. The Trips page is just "this plus filters". Either drop Dashboard or repurpose it to alerts/oncall.
2. **Principals could collapse into a tab inside `People`** alongside Concierges and Invitations. Three "people-shaped" pages with no shared chrome makes wayfinding worse.
3. **Notifications is an audit log** that ops will visit ≤weekly. It is not nav-bar-worthy. Move under a `Reports` or `Diagnostics` section, or surface a "View all email attempts" link from the dashboard alert chip.

**Proposed nav:**

```
Trips          ← merge dashboard + list
People         ← tabs: Concierges | Principals | Invitations
Diagnostics    ← Notifications + audit logs
```

3 items instead of 6. Less to scan.

---

## 10. Performance & Code Quality

| Item | Detail | Action |
|---|---|---|
| `index.css` is 880 lines, all global | No component-scoped styles, ~100 selectors with overlapping shadows | Move to CSS modules or one-Tailwind-config; co-locate styles with components |
| Fan-out queries | `AdminDashboard.tsx:19-29`, `AdminNotifications.tsx:18-29` issue N requests per N trips | Single batched endpoint |
| React Query key drift | `['admin', 'concierges']` vs `['admin', 'concierges', 'trip-create']` (`AdminConcierges.tsx:13` vs `AdminTripCreate.tsx:32`) — same data, separate caches | Centralize query keys in one `queryKeys.ts` file |
| `attemptsQuery` cache key includes `trips.map(id).join(',')` | Re-orders cause cache churn | Sort IDs before join, or key by hash |
| Auth in `localStorage` | XSS-readable | At minimum move refresh to HttpOnly cookie |
| Concierge token in URL query | Leaks in logs, history, referer | URL fragment or POST-redeem to cookie |
| `withFixtureFallback` masks real errors | Returns canned data on most failures | Banner + dev-only flag |
| `--shadow` very large (50px blur) | Repaint cost on scroll | Smaller shadow, GPU-friendly |
| No code splitting | All admin/principal/concierge routes loaded at once | Lazy-load by role |
| `crypto.randomUUID` requires secure context | Concierges on `http://airport-wifi-portal/...` may fail | Polyfill or guard |

---

## 11. Prioritized Punch List

### Sprint 1 (safety / data integrity) — ✅ SHIPPED

1. ~~Cancel-trip confirmation modal with typed verification + free-text reason.~~ ✅ *(TM-1)*
2. ~~Concierge access token off the URL query string.~~ ✅ *(CT-1 — fragment mitigation; backend cookie work follows)*
3. ~~Fix `--brand-gold → --active-gold` typo silently breaking the assigned pill.~~ ✅ *(TM-14)*
4. ~~Don't re-enqueue 4xx errors in offline queue.~~ ✅ *(CT-5)*
5. ~~Status-pill `data-tone` driven by a single mapping function — no more raw enum lowercasing.~~ ✅ *(§5.8, AA-1)*
6. ~~Wizard per-step validation; block forward jump.~~ ✅ *(TC-2, TC-8)*

Backend follow-ups carried over from Sprint 1:

- `withFixtureFallback` demo-data banner *(§4.4)*
- `HttpOnly` refresh-cookie auth migration *(§4.5)*
- POST-redeem concierge token for cookie *(CT-1 long-term)*
- Batched `/admin/notification-attempts` endpoint *(AA-8)*

### Sprint 2 (UX wins)

7. Edit-in-place for flight details on trip detail. *(TM-4)*
8. Remove watcher / remove principal affordances. *(TM-5)*
9. Multiple watchers + multiple principals at create. *(TC-3, TC-5)*
10. Optimistic timeline event updates. *(TM-8)*
11. Concierge "what the principal sees" preview + tel/sms shortcuts. *(CT-6, CT-8)*
12. Toast bus replacing the seven inline `ApiErrorMessage` slots in trip detail. *(TM-12)*

### Sprint 3 (visual rebuild)

13. Adopt a 5-step type scale; delete every `clamp()` heading. *(§5.1)*
14. Strip eyebrow from every panel except the page-level hero. *(§6.5)*
15. Halve the trip-status band height; metadata in a single line. *(§5.4)*
16. Replace graph-paper backgrounds + dead pseudo-element dots. *(§5.7)*
17. Single decorative shadow at half the current blur. *(§5.7)*
18. One terminology pass: concierge / watcher / trip / ops. *(§6.1)*

### Sprint 4 (architecture)

19. Collapse nav: Trips / People / Diagnostics. *(§9)*
20. Batched notification-attempts endpoint to fix N+1 fan-out. *(AA-8)*
21. Centralized `queryKeys.ts`. *(§10)*
22. Edit/deactivate concierge, search on directory. *(CC-4, CC-5)*
23. Phone formatting, trip code formatting, timezone display. *(§5.9)*

---

## 12. Tradeoffs & Alternatives

A few choices in this plan have real tradeoffs worth surfacing before you act.

- **Drop the serif?** The Cormorant headlines are the most distinctive visual element. Dropping them entirely will read as "less designed". An alternative is to keep the serif **only** in the brand lockup and in the trip-detail status headline — one editorial moment per session, not eight per screen.
- **Toast bus vs inline errors.** Toasts hide errors when dismissed; ops users on long-running trips may miss them. The mitigation is a persistent "issues" tray. Inline panels guarantee visibility but produce the noise problem at TM-12. The proposal here is a hybrid: toast for transient action errors, inline panel for query failures.
- **Optimistic updates** make the UI feel fast but lie to the user when the network is bad. Use them only for timeline events (idempotent on the backend) — not for cancels, assignments, or invitations.
- **Token in URL fragment** stops it from leaking to server logs, but it is still in `window.location` and any `referrer`-leaking subresource. The true fix is the POST-redeem-for-cookie flow. The fragment is a fast partial mitigation.
- **Reducing the nav from 6 to 3** is good for hygiene but bad for muscle memory; existing ops users have a path memorized. Ship behind a feature flag and instrument click-throughs.

---

## 13. Key Learning Points

For the engineering team picking this up:

1. **A type scale is not optional.** When every heading has its own `clamp()` you have no scale; you have 22 sizes. Define five steps and live within them. Audit by `grep -nE 'font-size: ?clamp'` and refuse to merge anything that adds a new one.
2. **Marketing voice on operational chrome is the loudest AI tell.** Ops users do not need "Trusted arrival command" reassurance — they need a verb. When in doubt, cut the eyebrow and keep the H1.
3. **Decoration must earn its place.** A graph-paper grid + a 50px shadow + a pseudo-element status dot + a gold inset underline + a chip strip is one app trying on five outfits. Pick one decoration per page.
4. **Confirmations protect ops from themselves.** Any action that mutates with a hardcoded note (`cancelTrip('Cancelled from admin detail view')`) is a tomorrow-Monday-morning incident waiting to happen. Destructive actions get a typed confirmation and free-text reason — every time.
5. **One concept, one word.** "Concierge / field operator / operator record / GGS-…" on the same screen costs every user a half-second of reconciliation. Multiply by 200 sessions a day and your "luxury" terminology vocabulary is bleeding minutes.
6. **Fixture fallbacks are debugging lies.** `withFixtureFallback` returning canned data on real errors means "the dashboard always loads" — which means the dashboard is no longer informative about backend health. Gate to dev or banner-flag it.
7. **Tokens belong in cookies, not in `?token=` on URLs.** Anything that ends up in `window.location.search` lives in browser history, screen recordings, screenshots, ops chat, and any referer that downstream HTTP makes. The cost of fixing this is one server endpoint; the cost of *not* fixing it is a credential leak with no audit trail.
8. **Status colors are infrastructure.** If your `data-tone={status.toLowerCase()}` falls through to the default for 6 of 10 statuses, you do not have a color system — you have a blue chip with text. One centralized `statusTone()` function with mapped CSS, called from every consumer.

---

*End of original review. See §14 below for shipped-patch summary.*

---

## 14. Patch Log — What Shipped

Sprint 1 (P0) frontend remediation. All changes type-checked (`tsc --noEmit`), lint-clean (`eslint`), and pass `vite build`.

### 14.1 Files added

| File | Purpose |
|---|---|
| `src/api/accessToken.ts` | Reads concierge token from URL fragment (preferred) or legacy query (promoted to fragment via `history.replaceState`). Exports `toFragmentLink(rawUrl)` to rewrite server-issued links before display/copy. |

### 14.2 Files modified

| File | Change |
|---|---|
| `src/components/format.ts` | `statusTone()` rewritten as exhaustive `switch` mapping every `TripStatus` to one of `scheduled / active / watch / complete / danger`. Added exported `StatusTone` type. |
| `src/index.css` | Added five `.trip-status[data-tone=...]` rules + `::before` colored dot for non-color status encoding. Added `.confirm-dialog` + `.confirm-dialog-actions` styles. Reworked `.wizard-steps button` to support the step-number + label markup. Fixed `--brand-gold` → `--active-gold` typo. |
| `src/routes/admin/AdminTripDetail.tsx` | New `CancelTripDialog` component using native `<dialog>` with typed-flight-number gate and free-text reason. Added `flightNumber` + `cancelPending` props. Access link now displayed/copied via `toFragmentLink()`. |
| `src/routes/admin/AdminTripCreate.tsx` | Per-step validation (`stepErrors` map), Continue button disabled when current step invalid, wizard nav disables steps past `farthestReachable`, inline warning above the form, descriptive labels in `STEP_LABELS`, Back disabled on first step, ellipsis-corrected "Creating…". |
| `src/routes/admin/AdminDashboard.tsx` | Calls `statusTone()` instead of `trip.status.toLowerCase()`. Calls `eventLabel()` instead of raw enum mangling. |
| `src/routes/admin/AdminTrips.tsx` | `StatusPill` now takes `status: TripStatus` and computes tone via `statusTone()`. |
| `src/routes/admin/AdminPrincipals.tsx` | Active tone changed from `active` (gold) to `complete` (green) so an active principal reads as healthy, not "needs attention". |
| `src/routes/admin/AdminNotifications.tsx` | New `attemptTone()` mapping `NotificationStatus` → status-pill tone. |
| `src/routes/concierge/ConciergeTripPage.tsx` | Reads token via `useAccessToken()` hook (fragment-first, query-legacy). `onError` and `syncQueued` now drop 4xx errors instead of looping them. Added `isClientError()` helper. |

### 14.3 What changed visually

- **Status pills** now render in five intentional tones with a small colored dot leading each. Gold is reserved for `active` (current verified trip) — matching the design context's "gold = active proof" rule. Cancelled trips show as red; completed as green; created/approaching as blue; stale as amber.
- **Cancel-trip dialog** uses the brand palette (navy backdrop, ivory panel, Cormorant heading) instead of an alarmist red wash, per "calm beats dramatic".
- **Trip-create wizard tabs** show "Step 1 / Flight details", "Step 2 / Principals", etc. — number first, name second. Out-of-order tabs render as disabled pills. Errors appear in a single warning chip above the form, not as scattered toasts.
- **Concierge access link** copied or clicked from the admin trip detail now contains `#token=…` instead of `?token=…`. Existing links already pasted into ops chat continue to work via the legacy promotion logic.

### 14.4 Build / verify commands

```bash
cd arrivalOSFrontend/frontend
npx tsc --noEmit          # 0 errors
npx eslint src            # 0 errors
npx vite build            # 138ms, 26.5KB CSS, 385KB JS
npx vite --port 5180      # boots cleanly
```

### 14.5 What did NOT ship (backlog)

- **Demo-data banner** for `withFixtureFallback` (§4.4) — small frontend change, queued for next sprint to bundle with the toast bus.
- **HttpOnly cookie auth** (§4.5) — requires backend `/auth/refresh-cookie` endpoint.
- **POST-redeem concierge token → cookie** (CT-1 long-term) — requires backend endpoint to exchange URL token for a 60-min cookie.
- **Batched notification-attempts endpoint** (AA-8) — N+1 fan-out remains until backend ships a batch endpoint.
- **Everything in Sprint 2 / Sprint 3** — UX wins (edit-in-place, remove watcher, optimistic timeline) and visual rebuild (type scale, eyebrow pruning, status-band height) untouched.

### 14.6 Risk notes for the team

- **Cancel dialog uses HTML `<dialog>`** — supported in all modern browsers (Chromium ≥ 37, Safari ≥ 15.4, Firefox ≥ 98). If you must support older mobile Safari for concierges in the field, polyfill or replace with a portal. The dialog is admin-only today so this is low risk.
- **Fragment-based token reading uses `window.location.hash`** — works under `BrowserRouter` only. If you ever switch TanStack Router to `MemoryRouter` or SSR, the helper needs a guard. Today it is fine.
- **Status-tone change is visible** — anything that screenshot-diffs admin pages will flag this. Communicate the intentional tone change to QA before they file regressions.
- **`AdminTrips.StatusPill` API changed** (`label` → `status`). Internal-only component; one file callsite.

---

*Sprint 1 patch log end. See §15 below for Sprint 2.*

---

## 15. Patch Log — Sprint 2 (UX wins)

All changes type-checked (`tsc --noEmit`), lint-clean (`eslint`), pass `vite build`, dev server boots and serves transformed routes.

### 15.1 Bug fix — wizard auto-submits on step 4

**Root cause:** Continue (step 3) and Create (step 4) buttons rendered at the same DOM position inside `.wizard-actions`. A slightly-double-clicked Continue: first click advanced state to `operations`, React re-mounted the button slot as Create, the second click of the double-tap landed on the freshly-mounted Create button and fired `createTrip.mutate()` before the user touched the concierge dropdown. Sprint 1's `canSubmit` gate didn't help — by the time step 4 was reached on the happy path, all preceding steps validated as true so Create was enabled on mount.

**Companion bug:** Sprint 1 had also introduced a TDZ violation — `canSubmit` referenced `createTrip` before its `useMutation` declaration. Fixed in the rewrite by ordering mutation before derived state.

**Fix:**
- Step 4's footer now shows **Back only**. No primary action button in the footer at all.
- Create button moved into a new `<TripReviewPanel>` inside step 4 content. The panel shows a read-only summary of every input (flight, airport, scheduled, meeting point, principal, watcher count, concierge, checkpoint count) above the Create button.
- Different physical screen position → no race possible.
- Bonus UX: the review summary lets ops confirm what they're about to create — aligns with "calm beats dramatic, precise" from the design context.

Files: `src/routes/admin/AdminTripCreate.tsx` (rewritten), `src/index.css` (new `.trip-review-panel`, `.trip-review-confirm`, `.operations-step` styles).

### 15.2 Multi-watcher support at create *(TC-5)*

Trip-create step 3 now uses a repeating `<fieldset className="watcher-draft">` list. Add another / Remove per row. Empty rows are tolerated; only fully-valid rows (name + valid email) are submitted. Validation: a partially-filled row blocks the wizard with a single inline warning.

**Multi-principal at create *(TC-3)* deferred** — the existing `PrincipalLinkFields` is single-instance; supporting N principals requires a row-component refactor or N instances with per-row mode state. The admin trip detail already supports adding more principals after creation, so the workflow is: create-with-one → link more on detail. Documented in the wizard's step 2 hint copy.

Files: `src/routes/admin/AdminTripCreate.tsx`, `src/index.css` (new `.watcher-draft*` styles).

### 15.3 Toast bus *(TM-12)*

Seven inline `<ApiErrorMessage />` panels in `AdminTripDetail` collapsed into a single toast surface. Errors include the `ApiError` field-error detail and request ID. Success messages now appear too ("Watcher added", "Concierge assigned", "Trip cancelled"). Auto-dismiss 6s, click × to dismiss early.

Added:
- `src/components/toastContext.ts` — `ToastContext` + `useToast()` hook + `Toast` types (split into its own file to satisfy `react-refresh/only-export-components`).
- `src/components/Toast.tsx` — `ToastProvider` + viewport. Bottom-right stack, 4-px left-border kind indicator (blue = info, green = success, red = error), navy soft-blur backdrop animation on enter, `aria-live="polite"` region.

Wired:
- `src/App.tsx` — `<ToastProvider>` wraps the router so toasts work app-wide.
- `src/routes/admin/AdminTripDetail.tsx` — every mutation now has `onSuccess` + `onError` calling `toast.pushSuccess` / `toast.pushError`. Removed five inline `<ApiErrorMessage error={…} />` slots and the `*Error` props on `AdminActions`.

The page-level `tripQuery.error` panel was kept inline (it is a terminal render failure, not a transient action error).

### 15.4 Optimistic timeline event updates *(TM-8)*

`addEvent` mutation now uses `onMutate` to optimistically insert the new event into the trip cache before the network round-trip. `onError` restores the previous cache snapshot AND raises a toast. `onSuccess` invalidates queries to pick up the server-canonical version.

Optimistic events are rendered with `data-pending="true"` on the `<li>` — they show at 62% opacity with a grey timeline dot and a small "Saving…" tag next to the event label. No new icons; no animation beyond the existing fade pattern.

Files: `src/routes/admin/AdminTripDetail.tsx`, `src/components/ArrivalComponents.tsx`, `src/index.css` (`.timeline-item[data-pending='true']`, `.timeline-pending-tag`).

### 15.5 Concierge → principal call/SMS shortcuts *(CT-6)*

When the principal record has a phone, the concierge focus panel now shows a 2-up button row:
- **Call principal** — primary, `tel:` link with non-digit characters stripped.
- **Send SMS** — secondary, `sms:` link.

On phones <480px the row stacks to full-width single-column for one-handed use (matches the "one-handed phone use" rule in the design context's accessibility section).

Files: `src/routes/concierge/ConciergeTripPage.tsx`, `src/index.css` (`.principal-contact-row`).

### 15.6 Files added/modified in Sprint 2

| Action | File |
|---|---|
| **Added** | `src/components/Toast.tsx` |
| **Added** | `src/components/toastContext.ts` |
| **Rewritten** | `src/routes/admin/AdminTripCreate.tsx` (~330 LOC, was ~160) |
| **Modified** | `src/routes/admin/AdminTripDetail.tsx` — toast wiring, optimistic addEvent, prop cleanup |
| **Modified** | `src/routes/concierge/ConciergeTripPage.tsx` — `PrincipalContactRow` |
| **Modified** | `src/components/ArrivalComponents.tsx` — optimistic pending state on `TimelineItem` |
| **Modified** | `src/App.tsx` — `<ToastProvider>` wrap |
| **Modified** | `src/index.css` — watcher-draft, trip-review-panel, toast viewport, timeline pending, principal-contact-row |

Bundle delta: CSS 26.5 → 29.4 KB (+2.9 KB), JS 385 → 391 KB (+6 KB). All under the noise floor.

### 15.7 What did NOT ship in Sprint 2 (still backlog)

| Item | Why deferred |
|---|---|
| TC-3 — multiple principals at create | Needs PrincipalLinkFields refactor; workaround (add via detail page) exists |
| TM-4 — edit flight details inline | Backend has no PATCH endpoint |
| TM-5 — remove watcher/principal | Backend has no DELETE endpoints |
| CT-8 — "what the principal sees" preview | Needs principal-safe events filter endpoint |
| AA-8 — batched notification attempts | Backend N+1 — needs aggregated endpoint |
| §4.4 — demo-data banner | Carried from Sprint 1 backend list; small frontend item bundled with next sprint |
| §4.5 — HttpOnly cookie auth | Backend |

### 15.8 Risk notes for the team

- **TripStatusBand metadata still references the trip header**, so optimistic events do **not** advance the band's status label until the server response comes back. This is intentional: optimistic events represent intent, not state. If the backend returns a different status (e.g. duplicate detection), the band stays canonical.
- **Optimistic event IDs start with `optimistic-`** — backend must not emit IDs starting with that string. Today IDs are UUIDs so collision is impossible, but worth a sentence in API docs.
- **Toast auto-dismiss is 6s** — long enough to read 2 lines, short enough not to stack indefinitely. If ops complain, raise to 8s in `Toast.tsx`.
- **Wizard step 4 footer change is visible** — anyone trained to "click the big blue button bottom-right to create" will now find no button there; they must scroll to the Review panel. Communicate in release notes.
- **Watcher draft list always shows ≥1 row** — removing the last row recreates an empty one. Avoids the "no inputs visible" empty state.

### 15.9 Verify commands (run from `arrivalOSFrontend/frontend`)

```bash
npx tsc --noEmit          # 0 errors
npx eslint src            # 0 errors
npx vite build            # 137ms, 29.4KB CSS, 391KB JS
npx vite --port 5180      # ready in ~150ms, serves transformed routes (curl-verified)
```

### 15.10 Manual test plan for QA

1. **Wizard auto-submit regression**: open `/admin/trips/new`, fill steps 1–3 with valid data, double-click Continue on step 3. Expect: page lands on step 4 (operations) with NO trip created. Concierge dropdown is interactable. Create button lives in the bottom Review panel.
2. **Multi-watcher**: on step 3, click "Add another watcher" thrice, fill two rows, leave one empty. Click Continue → expect no validation error. Create the trip. Expect two watchers on the detail page.
3. **Toast bus**: on a trip detail, submit a timeline event without a checkpoint name (when checkpoint required) — expect a red toast. Cancel a trip — expect a green "Trip cancelled" toast.
4. **Optimistic timeline**: throttle network to "Slow 3G". Submit a timeline event. Expect the event to appear immediately at 62% opacity with "Saving…" tag, then settle to full opacity when the request resolves.
5. **Concierge call/SMS**: open a concierge link on a real phone (Android or iOS). Expect "Call principal" and "Send SMS" buttons. Tap "Call principal" — expect the dialer to open with the principal's number pre-filled.

---

*Sprint 2 patch log end. See §16 for Sprint 3.*

---

## 16. Patch Log — Sprint 3 (visual rebuild)

Visual cleanup of the design system. Build clean, lint clean, dev server boots and transforms all routes. The Cormorant + navy + scarce gold direction is preserved per the design context — Sprint 3 just stops spraying it everywhere.

### 16.1 Type scale + Cormorant restriction *(§5.1, §6.5)*

Replaced the eight overlapping `clamp()` heading rules with eight CSS-variable type tokens at fixed sizes:

| Token | px | Used for |
|---|---|---|
| `--text-display` | 36 | Page H1 (SectionHeader, status-band-style heroes) |
| `--text-3xl` | 26 | Editorial moments (login-heading, principal-trip-card flight number) |
| `--text-2xl` | 20 | Command panel headings |
| `--text-xl` | 17 | Panel headings (timeline, ops, info, detail) |
| `--text-lg` | 15 | Subsection headings, large body |
| `--text-base` | 14 | Body |
| `--text-sm` | 13 | Small body, table cells |
| `--text-xs` | 11 | Eyebrow, caps labels |

Cormorant Garamond now restricted to:
- Brand lockup (`.brand-lockup h1`)
- Login mission headline (`.mission-copy h2`)
- Login form heading (`.login-heading h2`)
- Section page H1 (`.section-header h1`)
- Trip status band H1 (`.status-band h1`)
- Principal trip card flight number (`.principal-trip-card h2`)
- Meeting point heading (`.meeting-point h2`)
- Identity card name (`.identity-card h2`)
- Principal account preview name (`.principal-account-preview strong`)
- Empty state title (`.empty-state h2`)
- Brand promise tagline on login (new `.brand-promise`)

Everything else — table headings, panel headings, command panels, subsection H3s, dialog headings, ops panel H2s, table caps — is Inter. Removed `font-family: 'Cormorant Garamond'` from `.table-heading h2 / .panel-heading h2 / .ops-panel h2 / .info-panel h2 / .detail-card h2 / .subsection-heading h3 / .command-panel-heading h2`. That's eight headings demoted to Inter without losing the editorial pages.

`clamp()` headings reduced from 22 to 2 (mission-copy and login-heading kept fluid because the login surface is genuinely marketing-scale).

### 16.2 Brand hierarchy fix *(§5.3)*

Sidebar previously read "ARRIVALOS" (tiny) above "Admin" (huge serif). Now reads "ArrivalOS" (Inter semibold) above "OPERATIONS" (caps-tracked label). Brand is the headline; the workspace label is a sublabel. Fixes the inverted hierarchy from screenshot 1.

Files: `AdminShell.tsx`, `index.css` (`.admin-brand strong` + new `.admin-brand small`).

### 16.3 Trip status band halved *(§5.4)*

Before: `clamp(38px, 5vw, 68px)` Cormorant H1 + two-column dl with chip-styled cells — band consumed ~200px on a 1080p detail view, screenshot 6.

After: 28px serif H1 (still Cormorant — this is the one ops "right-now" headline), single-row metadata strip (`grid-template-columns: repeat(4, minmax(0, 1fr))`), padding `18px 24px`. Same content, less than half the height.

The gold `box-shadow: inset 0 -4px 0` on `[data-tone='active']` removed (§5.7) — the new status-pill dot system carries tone now.

### 16.4 Decorative noise stripped *(§5.7)*

| Removed | Where |
|---|---|
| Graph-paper background on `.admin-shell` | `index.css` — 5 lines of `linear-gradient` deleted |
| Graph-paper background on `.concierge-shell` | `index.css` — same |
| Graph-paper background on `.login-screen` | `index.css` — same |
| `.metric-card::after` dead blue dot pseudo-element | `index.css` — 3 lines deleted |
| `.status-band[data-tone='active']` gold inset shadow | `index.css` — 1 line deleted |
| `.assurance-strip` "Timeline first / Email updates / Audit ready" chips on login | `AuthPages.tsx` |

Replaced the login chips with the **Gbèjà promise** — *"We don't sleep, so you can."* — set in Cormorant italic per the design context's "shared and exported artefacts" guidance. One editorial moment with brand meaning beats three generic assurance chips.

### 16.5 Single shadow tier *(§5.7)*

`--shadow` collapsed from `0 18px 50px (10% navy)` to `0 4px 12px (6% navy)`. Added `--shadow-elevated: 0 10px 28px (14%)` as a second tier used only by the confirm dialog. Cards now feel grounded instead of floating; hierarchy reads sharper.

### 16.6 Eyebrows pruned *(§6.5)*

`grep -rn 'className="eyebrow"' src` count: **31 → 6**.

Retained:
| File | Eyebrow | Why kept |
|---|---|---|
| `AdminDashboard.tsx:39` | "Operations" | Page hero |
| `AdminShell.tsx:48` | "Signed in" | Sidebar status label |
| `AuthPages.tsx:213` | `{eyebrow}` prop | Auth page mission context |
| `PrincipalTripDetail.tsx:58` | "Meeting point" | Label-and-content pattern (H2 holds the address) |
| `ConciergeTripPage.tsx:169` | "Meeting point" | Same pattern, concierge view |
| `Primitives.tsx:70` | `{eyebrow}` prop | Only renders if SectionHeader caller passes one |

Every other eyebrow — `Source of truth`, `Ops command`, `Principal record`, `Concierge assignment`, `Notification recipient`, `Concierge access link`, `Operator record`, `Directory record`, `Directory`, `Principal detail`, `Attempt register`, `Recently updated`, `Arrival` card label, `Destructive action`, `Concierge` over identity card, multiple auth subheadings — deleted.

### 16.7 Terminology pass *(§6.1)*

One word per concept. Replacements:

| Old | New |
|---|---|
| Field operator / Field operators | Concierge / Concierges |
| Operator record / Operator records | Concierge |
| Email recipient (admin contexts) | Watcher |
| Notification recipient | Watcher |
| Add email recipient (admin button) | Add watcher |
| Email notification attempts | Recent attempts |
| Customer-safe updates (timeline chip) | *(removed)* |
| Trusted updates (timeline chip) | *(removed)* |
| Source of truth | *(removed)* |
| Live board | *(removed)* |
| Arrival timeline register (Trips title) | Trips |
| Arrival command overview (Dashboard H1) | Today |
| Active arrival register (table heading) | Active trips |
| Create arrival workflow (wizard title) | Create trip |
| Field operator records (Concierges title) | Concierges |
| Create field operator (button) | Add concierge |
| Email delivery oversight (Notifications title) | Email delivery |
| Invite login-capable accounts (Invitations title) | Invitations |
| Principal management (Principals title) | Principals |
| Trusted arrival command (login eyebrow) | ArrivalOS |
| Continue securely (login button) | Sign in |
| Trip-scoped access link | Access link |
| Field operator / Operator (form labels) | Concierge |
| "Next operational move" (admin actions H2) | Next move |
| "People on this trip" (subsection) | Principals on this trip |

Principal-facing copy kept "Email recipient" only on the PrincipalTripDetail form because that's where the principal themselves adds a contact and the friendly word matters more than internal jargon.

### 16.8 Smaller paddings + tighter buttons

| Surface | Before | After |
|---|---|---|
| Primary/secondary button min-height | 44px | 42px |
| Primary/secondary button font-size | (inherited) | `--text-sm` |
| Admin nav item min-height | 44px | 40px |
| Field input gap | 8px | 6px |
| Metric card min-height | 140px | 110px |
| Metric value font-size | `clamp(34, 3.5vw, 48)` | 36px fixed |
| Avatar | 54px | 48px |
| Identity-card gap | 14px | 12px |
| Detail-layout gap | 22px | 18px |
| Status band hero padding | `clamp(20, 3vw, 30)` | 18px 24px |
| Compact-dl gap | 10px | 8px |
| Panel padding | 22px | 20px |

Net: ~8-15% vertical real estate reclaimed across every detail page. Concierge primary button on field stays 54px for one-handed phone use (per design context).

### 16.9 Files modified

| File | Change |
|---|---|
| `src/index.css` | Type scale tokens, serif restriction, status band rewrite, shadow tier collapse, decorative noise removed, button/nav/field tightening, new `.brand-promise` and `.brand-lockup small` rules |
| `src/components/ArrivalComponents.tsx` | Identity card + status band eyebrow removal, "No watchers added yet" copy |
| `src/components/Primitives.tsx` | Empty-state eyebrow removal |
| `src/routes/admin/AdminShell.tsx` | Brand hierarchy inversion fix |
| `src/routes/admin/AdminDashboard.tsx` | Hero copy slimmed, command-state chips removed, table heading eyebrow removed, "Add principal" link demoted (kept only New trip + Invite account) |
| `src/routes/admin/AdminTrips.tsx` | "Trips" title, search field copy |
| `src/routes/admin/AdminConcierges.tsx` | "Concierges" title, "Add concierge" form copy, empty-state copy |
| `src/routes/admin/AdminInvitations.tsx` | "Invitations" title, "Send invitation" copy |
| `src/routes/admin/AdminPrincipals.tsx` | "Principals" title, panel eyebrow removal |
| `src/routes/admin/AdminNotifications.tsx` | "Email delivery" title, "Recent attempts" panel copy |
| `src/routes/admin/AdminTripDetail.tsx` | 6 panel/subsection eyebrows removed, "Watchers" panel rename, copy cleanup, "Add watcher" button rename |
| `src/routes/admin/AdminTripCreate.tsx` | "Create trip" title, "Review and create" panel copy, "watcher(s)" counter in review |
| `src/routes/admin/PrincipalLinkFields.tsx` | "Directory record" eyebrow removal |
| `src/routes/principal/PrincipalTrips.tsx` | "Arrival" trip-card eyebrow removal |
| `src/routes/principal/PrincipalTripDetail.tsx` | Timeline "Customer-safe updates" chip removed |
| `src/routes/concierge/ConciergeTripPage.tsx` | Timeline "Trusted updates" chip removed, watcher count copy fixed |
| `src/routes/auth/AuthPages.tsx` | All five page eyebrows cleaned up, marketing copy slimmed, assurance-strip replaced with Gbèjà promise |

Bundle delta: CSS 29.6 → 29.8 KB (+0.2 KB — added tokens canceled by removed clamp rules and decorations), JS 391 → 388 KB (−3 KB, mostly removed copy strings).

### 16.10 Risk notes for the team

- **Every page will look noticeably different.** Headings smaller, less serif, no graph paper, no chip strips on the dashboard hero, "Today" not "Arrival command overview", "Concierge" not "Field operator". If you screenshot-diff in CI, baselines need refresh.
- **The Gbèjà promise on login is set in italic Cormorant.** If the brand book has a different treatment for the tagline, swap in `.brand-promise`.
- **`.admin-brand strong` is now Inter, not serif.** This was a deliberate brand-hierarchy correction (§5.3). Verify with brand owners — easy to revert by adding `.admin-brand strong` back into the serif rule.
- **`metric-card[data-tone='attention']` and `[data-tone='watch']` previously colored the dead pseudo-element dot.** The dot is gone; `data-tone` is no longer consumed by `.metric-card`. The Dashboard.tsx still passes `tone="attention" | "watch"` to `<Metric>` — harmless but unused. Remove if you do a code-pass later.
- **"Email recipient" still appears on the principal-facing add-watcher form.** Intentional: principals are not insiders and "watcher" is jargon. Don't global-replace this last one.
- **Auth pages now show "We don't sleep, so you can."** The design context explicitly authorizes this on shared/exported artefacts. Login screen counts.

### 16.11 Verify commands

```bash
cd arrivalOSFrontend/frontend
npx tsc --noEmit          # 0 errors
npx eslint src            # 0 errors
npm run build             # 113ms, 29.8KB CSS, 388KB JS
npx vite --port 5180      # ready in ~150ms; /src/index.css and route files transform 200 OK
```

### 16.12 Sprint 3 manual QA plan

1. **Type scale**: open the admin dashboard, trips list, trip detail, and create wizard. Headings should feel like four distinct sizes (36 page H1, 26 trip cards, 20 command panels, 17 panels). No giant `clamp()` blowouts between viewport widths.
2. **Cormorant audit**: count serif headings on a trip detail page. Should be ≤3 (the status band H1, the principal identity card name, the principal account preview if visible). Every panel heading should be Inter.
3. **Status band**: open a trip detail. Band height should be ~70px tall, not 200px. Metadata in a single row.
4. **Decoration**: grid backgrounds should be gone on admin sidebar workspace, concierge shell, and login screen. Metric cards should have no top-right dot.
5. **Sidebar brand**: "ArrivalOS" should be larger than "OPERATIONS" — not the inversion in screenshot 1.
6. **Terminology**: search the rendered admin pages for "field operator" — should be zero hits. "Source of truth", "Live board", "Trusted updates" — also zero.
7. **Login**: the Gbèjà promise should render in italic serif at the bottom of the brand panel. Assurance chips gone.
8. **Trip detail eyebrows**: scan the admin actions card. There should be NO `OPS COMMAND / PRINCIPAL RECORD / CONCIERGE ASSIGNMENT / NOTIFICATION RECIPIENT` caps eyebrows. Just H2 + H3s in Inter.

---

*Sprint 3 patch log end. See §17 for the AI-slop pattern cleanup.*

---

## 17. Patch Log — Sprint 3.5 (AI-slop pattern cleanup)

Targeted cleanup of the three §6 patterns that were still leaking after Sprint 3: the **repeated subheading template**, the **marketing voice on operational chrome**, and the **terminology drift** that survived the first pass.

### 17.1 Repeated subheading template eliminated *(§6.3)*

**Before:** `AdminTripDetail.tsx` had one `.admin-command-panel` card containing FOUR jobs glued together with a repeated `.subsection-heading` (H3 + count badge) pattern:

```
[Next move]          ← timeline event form
[Principals on this trip]   ← H3 + count, roster + add disclosure
[Concierge assigned]        ← H3 + publicId, select + 2 buttons
[Add watcher]               ← H3, inline 3-input row
```

Three H3 subsections inside one card, each duplicating data already visible in the right rail (Principals panel, Watchers panel, Concierge identity card). Classic "command center" AI template.

**After:** Mutations were **distributed to their context panels**. Each panel now owns one job:

| Panel | Owns |
|---|---|
| `ConciergeAdminPanel` (new) | Identity card + assignment select + Assign/Issue-link buttons + access-link display |
| `PrincipalsAdminPanel` (new) | Roster + "Add or link a principal" `<details>` disclosure |
| `WatchersAdminPanel` (new) | Watcher list + "Add a watcher" `<details>` disclosure |
| `AdminActions` (slimmed) | "Next move" timeline event form + Cancel-trip dialog. That's it. |

The `.admin-command-panel` card went from 4 sections to 1 form. The `.subsection-heading` pattern is now used in ONE place only (the wizard's review panel — appropriate there).

`AdminActions` shrank from ~140 lines to ~50 lines and from 8 controlled-state hooks to 3.

### 17.2 Marketing voice on operational chrome rewritten *(§6.2)*

Every remaining marketing-coded phrase replaced with operational verbs:

| Before | After | File |
|---|---|---|
| "Loading operational records" | "Loading…" | `Primitives.tsx` |
| "Last trusted update" | "Last update" | `ArrivalComponents.tsx` |
| "Add a trusted contact to receive email updates…" | "Add someone to receive email updates…" | `PrincipalTripDetail.tsx` |
| "Create the first trip or clear filters to return to the active register." | "Create the first trip or clear filters to see the full list." | `AdminTrips.tsx` |
| "Timeline updates will populate this register once notification delivery starts." | "Attempts will appear here once timeline updates start sending notifications." | `AdminNotifications.tsx` |
| "Active arrivals, stale updates, and concierge readiness in one register." | "Active arrivals, stale updates, and concierge status at a glance." | `AdminDashboard.tsx` |
| "Open arrival workflows" (metric detail) | "In progress" | `AdminDashboard.tsx` |
| "Optional operational note" | "Optional note" | `ConciergeTripPage.tsx` |
| "Ops note" (field label) | "Note (optional)" | `AdminTripDetail.tsx` |
| "Operational mutations are disabled" | "Edits are disabled" | `AdminTripDetail.tsx` |
| "Timeline event" / "Submit timeline event" | "Event" / "Submit event" | `AdminTripDetail.tsx` |
| "trusted identity" / "trip history tied to one trusted identity" | "ties this trip to the principal's portal so they see updates and history" | `AdminTripCreate.tsx` |
| "No principal has been added to this trip." | "No principal yet — add one below." | `AdminTripDetail.tsx` |
| "Open the trip-scoped link issued by Gbèjà ops." | "Open the access link sent to you by Gbèjà ops." | `ConciergeTripPage.tsx` |

Rule applied: every word does a job, or it's cut.

### 17.3 Terminology drift closed *(§6.1)*

Final cleanup of stragglers that survived Sprint 3:

| Before | After |
|---|---|
| "Additional principal" / "Manual trip record" (roster small text) | "Additional" / "Manual entry" |
| "Trip created and notification recipients confirmed." (fixture) | "Trip created and watchers confirmed." |
| "Inactive concierges cannot be assigned to live trips." | "Inactive concierges can't be assigned." |
| "Assign this concierge before issuing the access link." | "Assign first, then issue the link." |
| "Cancelling the access link" (cancel dialog) | unchanged — actually accurate |
| Plus removed all "(suggested: X)" parenthetical and replaced with em-dash form: "Event — suggested: Concierge in position" | for the event-type dropdown label |

### 17.4 CSS orphans pruned

Removing the centralized AdminActions left 7 CSS classes with no consumer. Deleted from `index.css`:

- `.admin-command-panel`
- `.command-panel-heading` + its `h2` + `> span` selectors
- `.principal-command-section`
- `.concierge-command-section`
- `.watcher-command-section`
- `.timeline-action-form`
- `.concierge-assignment-grid`
- `.concierge-selection-preview` (and its 4 child selectors)

Renamed `.admin-command-panel` rule → `.admin-actions` and slimmed it.

Bundle delta: CSS **29.8 → 28.2 KB** (−1.6 KB, −5.4%), JS **388 → 387 KB**.

### 17.5 Files added / modified

| Action | File |
|---|---|
| **Modified** | `src/routes/admin/AdminTripDetail.tsx` — AdminActions slimmed; added `ConciergeAdminPanel`, `PrincipalsAdminPanel`, `WatchersAdminPanel`; removed `ConciergeSelectionPreview` and `PrincipalIdentityBlock` import (unused); right-rail rewired to use the new admin panels |
| Modified | `src/components/Primitives.tsx` — LoadingState default label |
| Modified | `src/components/ArrivalComponents.tsx` — "Last update" |
| Modified | `src/routes/principal/PrincipalTripDetail.tsx` — watcher form copy |
| Modified | `src/routes/admin/AdminTrips.tsx` — empty state copy |
| Modified | `src/routes/admin/AdminNotifications.tsx` — empty state copy |
| Modified | `src/routes/admin/AdminDashboard.tsx` — hero subtitle + metric detail |
| Modified | `src/routes/admin/AdminTripCreate.tsx` — principals step hint copy |
| Modified | `src/routes/concierge/ConciergeTripPage.tsx` — note placeholder + missing-token copy |
| Modified | `src/data/fixtures.ts` — sample timeline note |
| Modified | `src/index.css` — 8 orphaned class rules removed, `.admin-actions` + `.subsection-heading` reworked |

### 17.6 Verify

```bash
cd arrivalOSFrontend/frontend
npx tsc --noEmit          # 0 errors
npx eslint src            # 0 errors
npm run build             # 121ms, 28.2KB CSS, 387KB JS
npx vite --port 5180      # ready in ~150ms; trip detail + index.css transform 200 OK
```

### 17.7 Risk notes

- **`AdminActions` no longer accepts `addPrincipal`, `addWatcher`, `assignConcierge`, `issueAccessLink`, `availablePrincipals`, `principalDirectoryError`, `principalDirectoryLoading`, `conciergeId`, `concierges`, `principals`, `accessLink` props.** All deleted. If a downstream caller exists (unlikely — this component is local to the file), update accordingly.
- **`ConciergeSelectionPreview` and the `PrincipalIdentityBlock` import in this file are gone.** `PrincipalIdentityBlock` still lives in `ArrivalComponents` and is exported — other roles may still use it (concierge view does). Unchanged elsewhere.
- **Right-rail height grew.** Concierge panel is now identity card + assignment + access link in one card — taller than before. Principals and Watchers panels each hold a `<details>` disclosure, collapsed by default. Total rail height is approximately the same as before because the centralized AdminActions card shrank by an equivalent amount in the bottom row.
- **Bottom-row middle column (Checkpoints | AdminActions | Email attempts) feels less dense.** AdminActions is now ~150px shorter. If you want to rebalance, consider a 2-column bottom row with Email attempts moved into the right rail, or keep as-is for "calm beats dramatic".
- **Watchers are now added via a `<details>` disclosure** instead of an always-visible inline form. Saves real estate but costs one click. Open the disclosure to see the form.

### 17.8 What this accomplished

| §6 issue | Before Sprint 3.5 | After |
|---|---|---|
| Repeated subheading template | 3 `.subsection-heading` blocks in one card | 1 use (wizard review panel — appropriate) |
| Marketing voice on chrome | 14 phrases ("trusted", "operational", "register", "workflow", "oversight"…) | All rewritten to operational verbs |
| Terminology drift | "Additional principal / Manual trip record / trip-scoped" still leaking | All concierge / watcher / trip / ops normalized |
| CSS orphans | 7 unused classes | 0 |

Combined with Sprint 3's type-scale + eyebrow pruning + decorative-noise cleanup, the visual signature of "AI-templated luxury SaaS dashboard" should be substantially gone. The remaining work is **architectural** (per IA §9), **backend-blocked** (§4.4, §4.5, TM-4, TM-5, AA-8, CT-8), or **further density tuning** that's better done with real ops feedback than a priori.

---

*Sprint 3.5 patch log end. The four §6 AI-slop patterns — terminology zoo, marketing voice, repeated subheading template, eyebrow saturation — are now closed. The remaining §6 item, §6.4 clamp() epidemic, was closed in Sprint 3. The §6.6 duplicated dashboard information was closed in Sprint 3 (chip strip removed).*
