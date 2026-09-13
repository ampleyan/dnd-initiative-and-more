# Dashboard UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard a focused DM session command center that surfaces the next useful action immediately while preserving existing navigation and data behavior.

**Architecture:** Keep the change in the existing frontend dashboard seam. Refactor `DashboardView` into small presentational sections only if needed for clarity, derive all labels and actions from its existing props, and reuse the existing `setActiveTab`, encounter-loading, creator, campaign, and changelog callbacks. No API, database, or route changes are required.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react, Vitest, Testing Library.

**Spec:** Approved dashboard redesign described in the conversation on 2026-09-13: session command center, two-column desktop layout, tablet stacking, contextual empty states, session-specific status, compact campaign/activity/party sections, non-blocking changelog access, and consistent version display.

## Global Constraints

- Preserve existing dashboard actions and callback ownership.
- Do not add backend endpoints, migrations, dependencies, or speculative dashboard features.
- Keep the dark theme and improve hierarchy through layout, spacing, contrast, and typography.
- Preserve accessible names, keyboard activation, visible focus, and touch-friendly controls.
- Do not inspect, edit, or commit runtime data such as databases, uploads, credentials, or `.env`.
- Do not add inline code comments.
- Run `npm run lint`, focused frontend tests, `npm test`, and `npm run build` before completion.

---

### Task 1: Establish dashboard behavior tests

**Files:**
- Create: `src/__tests__/DashboardView.test.tsx`
- Reference: `src/components/DashboardView.tsx`

**Interfaces:**
- Consumes the existing `DashboardViewProps` contract.
- Produces regression coverage for active, prepared, and empty dashboard states that later layout work must preserve.

- [ ] **Step 1: Write failing tests**

  Add a minimal render helper with the existing required props and tests for:

  - an active encounter showing the encounter name, round, and a primary action that routes to Encounters;
  - no active encounter with a saved or upcoming encounter showing the contextual resume/next action;
  - no campaign, players, and encounters showing the guided empty-state actions;
  - existing campaign, recent encounter, and player actions remaining reachable by accessible names.

- [ ] **Step 2: Run the focused test**

  Run: `npm test -- --run src/__tests__/DashboardView.test.tsx --project frontend`

  Expected: the new assertions fail where the current dashboard copy or structure does not yet satisfy the approved behavior.

- [ ] **Step 3: Commit the test baseline**

  Run: `git add src/__tests__/DashboardView.test.tsx; git commit -m "test: define dashboard session command center behavior"`

---

### Task 2: Reorganize the dashboard hierarchy

**Files:**
- Modify: `src/components/DashboardView.tsx`

**Interfaces:**
- Consumes the unchanged props and callbacks from `DashboardViewProps`.
- Produces the same navigation and mutation callbacks with a new visual order.

- [ ] **Step 1: Re-read the current component before editing**

  Inspect `src/components/DashboardView.tsx` top-to-bottom and preserve the current derived values and handlers unless a value becomes unused after the layout change.

- [ ] **Step 2: Implement the approved hierarchy**

  Reorder the existing sections so the first viewport contains:

  1. a compact header/context row;
  2. Tonight’s session with a state-specific primary CTA;
  3. session-specific status instead of the six raw library counters;
  4. the quick actions for Resume, New Encounter, and Campaign Board.

  Use a two-column grid for campaign/activity and party/supporting content at desktop widths, and collapse to one column at tablet widths. Keep all existing actions wired to their current callbacks.

- [ ] **Step 3: Implement state-specific actions and empty states**

  For an active encounter, make the primary action return to Encounters. With no active encounter, provide a clear next action for the upcoming/latest encounter and a secondary preparation action when appropriate. For an empty campaign/party/encounter state, present the existing campaign, import, and encounter-creator actions as a guided setup card.

- [ ] **Step 4: Replace secondary content without duplicating data**

  Replace the raw stats row with derived session status using existing values: active encounter state, next encounter, party size, and last session. Replace the large campaign description display with a short operational summary while retaining the existing “Open Lore” action. Keep recent encounters and players compact.

- [ ] **Step 5: Run focused tests**

  Run: `npm test -- --run src/__tests__/DashboardView.test.tsx --project frontend`

  Expected: PASS.

---

### Task 3: Make dashboard release and onboarding access non-blocking

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx` only if the existing header seam is required by the dashboard layout
- Modify: `src/components/Sidebar.tsx` only if the displayed version or changelog access is owned there

**Interfaces:**
- Consumes the existing `showWhatsNew`, `setShowWhatsNew`, and version values.
- Produces a discoverable dashboard “What’s new” control without changing modal content or navigation behavior.

- [ ] **Step 1: Re-read the owning version and changelog code**

  Inspect the version source and the `WhatsNewModal` open/close flow in `src/App.tsx`, `src/components/Sidebar.tsx`, and `src/components/TopBar.tsx`. Confirm the actual version value before changing display text.

- [ ] **Step 2: Remove only the blocking dashboard behavior**

  Keep the existing once-per-version changelog persistence and modal implementation, but expose its open action from the dashboard/header. Do not add a second changelog state or duplicate release-note content.

- [ ] **Step 3: Correct the version display at its source**

  Ensure the sidebar and any visible release-note heading use the package/application version already used by the app. Do not hardcode a second version string.

- [ ] **Step 4: Run focused tests**

  Run: `npm test -- --run src/__tests__/AppShell.test.tsx --project frontend`

  Expected: PASS.

---

### Task 4: Verify the complete dashboard pass

**Files:**
- Modify only files identified by Tasks 1–3 if verification exposes a direct regression.

**Interfaces:**
- No new interfaces; this task verifies the existing public behavior and visual states.

- [ ] **Step 1: Re-read every modified file**

  Confirm no unused imports, props, derived values, or dead callbacks remain after the reorganization.

- [ ] **Step 2: Run type-checking**

  Run: `npm run lint`

  Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run the full test suite**

  Run: `npm test`

  Expected: PASS for frontend and backend projects.

- [ ] **Step 4: Build the production bundle**

  Run: `npm run build`

  Expected: PASS with a generated production bundle.

- [ ] **Step 5: Perform a fresh-eyes browser check**

  Open `/dashboard` at desktop and tablet-sized viewports. Verify the next action is obvious, no content is inaccessible behind overflow, keyboard focus is visible, empty states provide useful actions, and the changelog no longer blocks normal dashboard use.

- [ ] **Step 6: Commit the completed dashboard pass**

  Run: `git add src/components/DashboardView.tsx src/components/App.tsx src/components/TopBar.tsx src/components/Sidebar.tsx src/__tests__/DashboardView.test.tsx; git commit -m "feat: refresh dashboard session workflow"`

