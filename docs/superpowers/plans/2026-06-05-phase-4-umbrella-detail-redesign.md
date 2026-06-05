# Phase 4 — Umbrella Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate UmbrellaDetail and its five subcomponents from the old `T.*` design tokens to the new Sage design language (`C.*` tokens + `.mn-umbrella-*` / `.mn-sheet-*` CSS classes), while integrating per-question sparklines, moving two forms to bottom sheets, and preserving every existing behavior.

**Architecture:** CSS foundations land first in a single Task 1 commit — all new classes in `dashboard.css` — so subsequent file tasks can consume a stable class library without conflicts. The five file tasks (Tasks 2–6) are serial in a single worktree; they have no inter-dependencies but share the same files-on-disk. A code review fires after Task 1 and again after Task 6.

**Tech Stack:** React 19 + TypeScript, Vite 8, `client/src/lib/dashboardTheme.ts` (`C.*` tokens), `client/src/components/dashboard/dashboard.css` (`.mn-*` classes), existing `Sparkline` + `Ring` + `Icon` components (unchanged).

---

## Design reference

Spec: `docs/superpowers/specs/2026-06-05-phase-4-umbrella-detail-redesign.md`  
Token map, CSS listings, DOM structures, and behavior-change table are all in that file. This plan cites spec sections where useful; when the spec and plan conflict, flag it rather than guessing.

---

## Parallelization, worktree, and TDD decisions

**Worktree:** Single worktree for the whole phase. Tasks 2–6 have no inter-dependencies (each file receives data as props; no file imports another), so parallelism is *theoretically* possible with separate worktrees — but dashboard.css is shared, and merging 4 worktrees back produces coordination overhead that isn't worth the time savings on a sequential spec. Single worktree, serial execution.

**Parallelism option (if desired):** Tasks 2–6 can each get their own worktree if Dan explicitly wants it after reading the plan. Task 1 (CSS) must still be serial and land first; the parallel file tasks would each branch from that commit. Not recommended for this phase.

**TDD:** `client/` has no test framework (no Vitest, no `@testing-library/react`). Adding one would violate the "no new dependencies" constraint. The safety net is therefore:
- TypeScript compiler (`tsc -b`) — catches type errors at every task
- Build verification (`npm run build` from `client/`) — the build runs `tsc -b` + Vite bundler; a clean build is the primary correctness gate
- Manual verification checklist at Task 7 — covers every behavior that must be preserved

The one pure function worth testing without a framework is `computeTrendDelta` (module-level, no React, no DOM). Task 2 includes a manual inline check via `console.assert` that is removed before the final commit.

**Code review checkpoints:**
1. After **Task 1** (CSS) — verify class library completeness before any file work starts
2. After **Task 6** (all files complete) — full implementation review before finishing

---

## File map

| File | Task | Change type |
|---|---|---|
| `client/src/components/dashboard/dashboard.css` | 1 | Add ~180 lines of `.mn-umbrella-*` + `.mn-sheet-*` classes |
| `client/src/components/UmbrellaDetail.tsx` | 2 | Major rewrite: new page shell, header, trend card, all bottom sheets |
| `client/src/components/umbrella/SubAreasSection.tsx` | 3 | Elevated cards, task-preview redesign, token swap |
| `client/src/components/umbrella/QuestionsSection.tsx` | 4 | Integrate sparklines, add question kebab, delete separate trends section |
| `client/src/components/umbrella/QuestionForm.tsx` | 5 | Token swap + card classNames only |
| `client/src/components/umbrella/ResolutionsSection.tsx` | 6 | Active cards redesign, creation → bottom sheet, detail sheet redesign |

---

## Task 1: CSS Foundations

**Files:**
- Modify: `client/src/components/dashboard/dashboard.css`

This is the foundational task. All `.mn-umbrella-*` and `.mn-sheet-*` classes must exist before any file task begins. The file tasks read these classes; they do not write CSS.

- [ ] **Step 1.1: Open `client/src/components/dashboard/dashboard.css` and append the Phase 4 block**

Append the following at the end of the file (after the existing `.mn-chat-*` rules):

```css
/* ===== Phase 4 — Umbrella detail ===== */

/* ─── Page shell ─────────────────────────────────────────────────────────── */

.mn-umbrella-page {
  min-height: 100%;
  background: #F5F1E8;
  padding-bottom: 100px;
}

.mn-umbrella-content {
  padding: 16px 16px 0;
}

.mn-umbrella-fab {
  position: fixed;
  right: 20px;
  bottom: 100px;
  width: 52px;
  height: 52px;
  border-radius: 18px;
  border: none;
  background: linear-gradient(135deg, #9CAF88 0%, #6B8E99 100%);
  box-shadow: 0 4px 16px rgba(107,142,153,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: sparkle 2.5s ease-in-out infinite;
}

.mn-umbrella-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: #2C2C2A;
  color: #ffffff;
  border-radius: 20px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  z-index: 100;
  animation: nudge-float 0.3s ease both;
  white-space: nowrap;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */

.mn-umbrella-header {
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 20px 20px;
  border-bottom: 1px solid rgba(44,44,42,0.08);
}

.mn-umbrella-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.mn-umbrella-ghost-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(44,44,42,0.52);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 4px;
  font-family: inherit;
  line-height: 1;
  border-radius: 6px;
}

.mn-umbrella-ghost-btn:focus-visible {
  outline: 1.5px solid #9CAF88;
  outline-offset: 2px;
}

.mn-umbrella-identity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mn-umbrella-icon-name {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.mn-umbrella-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #FFFFFF;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.mn-umbrella-name-block {
  flex: 1;
  min-width: 0;
}

.mn-umbrella-name {
  font-size: 22px;
  font-weight: 700;
  color: #2C2C2A;
  line-height: 1.2;
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.mn-umbrella-health-label {
  font-size: 11px;
  color: rgba(44,44,42,0.52);
  font-weight: 500;
}

.mn-umbrella-ring-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mn-umbrella-ring-score {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.mn-umbrella-ring-label {
  font-size: 10px;
  color: rgba(44,44,42,0.52);
  text-align: center;
  white-space: nowrap;
}

/* ─── Trend card ──────────────────────────────────────────────────────────── */

.mn-umbrella-trend-card {
  margin-left: 0;
  margin-right: 0;
}

.mn-umbrella-trend-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.mn-umbrella-trend-delta { font-size: 12px; font-weight: 600; }
.mn-umbrella-trend-delta.up   { color: #6FA06B; }
.mn-umbrella-trend-delta.down { color: #CC8A6E; }
.mn-umbrella-trend-delta.flat { color: rgba(44,44,42,0.52); }

.mn-umbrella-trend-empty {
  position: relative;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mn-umbrella-trend-empty-text {
  font-size: 12px;
  color: rgba(44,44,42,0.42);
  font-style: italic;
  text-align: center;
  position: relative;
  z-index: 1;
  padding: 0 16px;
}

/* ─── Shared section structure ────────────────────────────────────────────── */

.mn-umbrella-section { margin-bottom: 20px; }

.mn-umbrella-section-header-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.mn-umbrella-section-eyebrow {
  font-size: 12px;
  font-weight: 600;
  color: rgba(44,44,42,0.52);
  letter-spacing: 0.02em;
}

.mn-umbrella-add-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #9CAF88;
  font-family: inherit;
  padding: 2px 0;
  margin-right: auto;
}

/* ─── Sub-area cards ──────────────────────────────────────────────────────── */

.mn-umbrella-subareas-list { display: flex; flex-direction: column; gap: 8px; }

.mn-umbrella-subarea-card {
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.08);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  width: 100%;
  text-align: right;
  font-family: inherit;
  transition: box-shadow 0.15s;
}
.mn-umbrella-subarea-card:hover { box-shadow: 0 2px 10px rgba(44,44,42,0.08); }

.mn-umbrella-subarea-main { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }

.mn-umbrella-subarea-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.mn-umbrella-subarea-text { flex: 1; min-width: 0; }

.mn-umbrella-subarea-name {
  font-size: 14px;
  font-weight: 700;
  color: #2C2C2A;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mn-umbrella-subarea-activity { font-size: 11px; color: rgba(44,44,42,0.52); }

.mn-umbrella-subarea-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.mn-umbrella-subarea-score { font-size: 18px; font-weight: 700; line-height: 1; }

.mn-umbrella-task-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-top: 1px solid rgba(44,44,42,0.05);
}

.mn-umbrella-priority-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

.mn-umbrella-task-title {
  font-size: 12px;
  color: #2C2C2A;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mn-umbrella-ask-nefesh {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  color: #6B8E99;
  font-family: inherit;
  flex-shrink: 0;
  padding: 0;
}

.mn-umbrella-create-form {
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.08);
  border-radius: 14px;
  padding: 14px;
  margin-top: 4px;
}

/* ─── Question cards ──────────────────────────────────────────────────────── */

.mn-umbrella-q-card {
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.08);
  border-radius: 14px;
  overflow: visible;
  position: relative;
}

.mn-umbrella-q-main { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; }

.mn-umbrella-q-text-col { flex: 1; min-width: 0; }

.mn-umbrella-q-text {
  font-size: 13px;
  color: #2C2C2A;
  line-height: 1.45;
  margin-bottom: 6px;
  font-weight: 400;
}

.mn-umbrella-q-pills { display: flex; flex-wrap: wrap; gap: 4px; }

.mn-umbrella-q-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(44,44,42,0.05);
  color: rgba(44,44,42,0.52);
  font-size: 10px;
  font-weight: 600;
}

.mn-umbrella-q-right-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  min-width: 60px;
}

.mn-umbrella-q-spark-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; }

.mn-umbrella-q-latest { font-size: 12px; font-weight: 700; text-align: center; }

.mn-umbrella-q-spark-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 22px;
}

.mn-umbrella-q-no-data { font-size: 10px; color: rgba(44,44,42,0.38); font-style: italic; white-space: nowrap; }

.mn-umbrella-q-text-answer {
  font-size: 11px;
  color: rgba(44,44,42,0.52);
  text-align: center;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mn-umbrella-q-chips { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }

.mn-umbrella-q-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(44,44,42,0.05);
  color: rgba(44,44,42,0.52);
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mn-umbrella-q-kebab-wrap { position: relative; flex-shrink: 0; }

.mn-umbrella-q-kebab {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  font-size: 18px;
  color: rgba(44,44,42,0.38);
  line-height: 1;
  border-radius: 6px;
  transition: background 0.12s;
}
.mn-umbrella-q-kebab:hover { background: rgba(44,44,42,0.06); }

.mn-umbrella-q-menu {
  position: absolute;
  top: calc(100% + 4px);
  inset-inline-end: 0;
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.12);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(44,44,42,0.12);
  z-index: 20;
  min-width: 100px;
  overflow: hidden;
}

.mn-umbrella-q-menu-item {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 14px;
  font-family: inherit;
  font-size: 13px;
  text-align: right;
  color: #2C2C2A;
  display: block;
}
.mn-umbrella-q-menu-item:hover { background: rgba(44,44,42,0.04); }
.mn-umbrella-q-menu-item.danger { color: #CC8A6E; }

.mn-umbrella-q-add-btn {
  width: 100%;
  background: transparent;
  border: 1.5px dashed rgba(44,44,42,0.14);
  border-radius: 14px;
  padding: 10px 16px;
  color: rgba(44,44,42,0.52);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: border-color 0.15s, color 0.15s;
}
.mn-umbrella-q-add-btn:hover { border-color: #9CAF88; color: #9CAF88; }

/* ─── Resolution cards ────────────────────────────────────────────────────── */

.mn-umbrella-resolution-card {
  width: 100%;
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.08);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  text-align: right;
  font-family: inherit;
  transition: box-shadow 0.15s;
}
.mn-umbrella-resolution-card:hover { box-shadow: 0 2px 10px rgba(44,44,42,0.08); }

.mn-umbrella-resolution-title { font-size: 14px; font-weight: 700; color: #2C2C2A; margin-bottom: 3px; line-height: 1.3; }

.mn-umbrella-resolution-question {
  font-size: 11px;
  color: rgba(44,44,42,0.52);
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mn-umbrella-resolution-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }

.mn-umbrella-resolution-pct-pill {
  font-size: 11px;
  font-weight: 700;
  color: #2C2C2A;
  background: rgba(156,175,136,0.12);
  padding: 2px 7px;
  border-radius: 20px;
  flex-shrink: 0;
}

.mn-umbrella-resolution-bar-track {
  flex: 1;
  height: 8px;
  background: rgba(44,44,42,0.07);
  border-radius: 4px;
  overflow: hidden;
}

.mn-umbrella-resolution-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }

.mn-umbrella-resolution-stats { display: flex; align-items: center; gap: 10px; }

.mn-umbrella-resolution-stat { font-size: 11px; color: rgba(44,44,42,0.52); }
.mn-umbrella-resolution-stat.streak { color: #EF9F27; font-weight: 600; }
.mn-umbrella-resolution-stat.threshold { color: rgba(44,44,42,0.42); font-size: 10px; }
.mn-umbrella-resolution-stat.remaining { margin-right: auto; }

/* ─── Shared bottom sheet ─────────────────────────────────────────────────── */

.mn-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(44,44,42,0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.mn-sheet {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  background: #FBF8F1;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
}

.mn-sheet-short { max-height: 48vh; }
.mn-sheet-tall  { max-height: 78vh; }

.mn-sheet-drag-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(44,44,42,0.14);
  margin: 10px auto 6px;
  flex-shrink: 0;
}

.mn-sheet-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 20px 12px;
  flex-shrink: 0;
}

.mn-sheet-title { font-size: 16px; font-weight: 700; color: #2C2C2A; }

.mn-sheet-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: rgba(44,44,42,0.52);
  padding: 4px;
  line-height: 1;
  border-radius: 6px;
}
.mn-sheet-close-btn:hover { background: rgba(44,44,42,0.06); }
.mn-sheet-close-btn:focus-visible { outline: 1.5px solid #9CAF88; outline-offset: 2px; }

.mn-sheet-body { flex: 1; overflow-y: auto; padding: 0 20px 16px; }

.mn-sheet-field-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: rgba(44,44,42,0.52);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  margin-top: 14px;
}

.mn-sheet-input {
  width: 100%;
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.10);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: #2C2C2A;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  direction: rtl;
}
.mn-sheet-input:focus-visible { outline: 1.5px solid #9CAF88; outline-offset: 1px; }

.mn-sheet-toggle-row { display: flex; gap: 8px; margin-bottom: 4px; }

.mn-sheet-toggle {
  flex: 1;
  padding: 7px 0;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  background: rgba(44,44,42,0.05);
  color: rgba(44,44,42,0.52);
  transition: background 0.15s, color 0.15s;
}
.mn-sheet-toggle.active { background: #9CAF88; color: #ffffff; }

.mn-sheet-chips-row { display: flex; gap: 6px; flex-wrap: wrap; }

.mn-sheet-chip {
  padding: 5px 12px;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  background: rgba(44,44,42,0.05);
  color: rgba(44,44,42,0.52);
  transition: background 0.15s, color 0.15s;
}
.mn-sheet-chip.active { background: #6B8E99; color: #ffffff; }

.mn-sheet-date-range { font-size: 12px; color: rgba(44,44,42,0.52); margin-top: 10px; }

.mn-sheet-action-row {
  display: flex;
  gap: 8px;
  padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 20px);
  flex-shrink: 0;
  border-top: 1px solid rgba(44,44,42,0.08);
}

.mn-sheet-btn-primary {
  flex: 1;
  background: #9CAF88;
  color: #ffffff;
  border-radius: 12px;
  border: none;
  padding: 12px 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
.mn-sheet-btn-primary:disabled { background: rgba(44,44,42,0.07); color: rgba(44,44,42,0.32); cursor: default; }

.mn-sheet-btn-ghost {
  flex: 1;
  background: none;
  color: rgba(44,44,42,0.52);
  border-radius: 12px;
  border: 1px solid rgba(44,44,42,0.10);
  padding: 12px 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
```

- [ ] **Step 1.2: Verify no existing class names were duplicated**

Run a quick grep to check for any conflicts:
```bash
grep -n "mn-umbrella\|mn-sheet" client/src/components/dashboard/dashboard.css | wc -l
```
Expected: ~180+ lines. If any class appears twice, remove the duplicate.

- [ ] **Step 1.3: Build to confirm no CSS syntax errors**

```bash
cd client && npm run build 2>&1 | tail -20
```
Expected: `✓ built in X.Xs` with no errors. If PostCSS/Vite reports a CSS parse error, fix it.

- [ ] **Step 1.4: Commit**

```bash
git add client/src/components/dashboard/dashboard.css
git commit -m "feat(ui): phase 4 — add umbrella detail CSS class library"
```

---

> **⏸ CODE REVIEW CHECKPOINT 1:** After Task 1 commits, run `/code-review` on the CSS diff before proceeding to Task 2. Verify: all class names from the spec are present, no naming inconsistencies, no accidental overwrites of existing `.mn-*` classes.

---

## Task 2: `UmbrellaDetail.tsx` — Page Shell, Header, Trend Card, All Sheets

**Files:**
- Modify: `client/src/components/UmbrellaDetail.tsx`

This is the orchestrator. It owns: the page root, the header, the trend card, the FAB, the toast, and four bottom sheets (kebab, delete-confirm, move-parent, and the new edit-umbrella sheet). The subcomponents it renders (SubAreasSection, QuestionsSection, ResolutionsSection) are unchanged in this task.

- [ ] **Step 2.1: Update imports**

Replace the imports block at the top of `UmbrellaDetail.tsx`:

```ts
import { useState, useEffect, useMemo } from 'react'
import { C } from '../lib/dashboardTheme'
import { umbrellaColor } from '../lib/theme'  // keep — used for color
import Ring from './Ring'
import Sparkline from './Sparkline'
import Icon from './Icon'
import '../components/dashboard/dashboard.css'  // Phase 4 CSS
import {
  listQuestions,
  archiveUmbrella,
  deleteUmbrella,
  getUmbrellaTrend,
  getQuestionTrend,
  getQuestionMultiTrend,
  updateUmbrella,
  listResolutions,
} from '../lib/api'
import type { ApiUmbrellaTrendPoint, ApiQuestionTrendPoint, ApiMultiTrendPoint, ApiResolution } from '../lib/api'
import { useStore } from '../store/useStore'
import type { Umbrella } from '../types/umbrella'
import type { Question } from '../types/umbrella'
import type { NavigateFn } from '../types/nav'
import { EMOJI_OPTIONS, flattenWithDepth, collectDescendantIds } from './umbrella/shared'
import { SubAreasSection } from './umbrella/SubAreasSection'
import { QuestionsSection } from './umbrella/QuestionsSection'
import { ResolutionsSection } from './umbrella/ResolutionsSection'
```

Note: `T` from `../lib/theme` is no longer imported (replaced by `C`). `umbrellaColor` is still needed for the color computation.

- [ ] **Step 2.2: Add `computeTrendDelta` above the component**

Insert after the imports, before `interface Props`:

```ts
// Returns null for sparse-cadence umbrellas (weekly/monthly/annual) where 14 daily points aren't available.
function computeTrendDelta(trend: ApiUmbrellaTrendPoint[]) {
  const pts = trend.filter(p => p.score !== null)
  if (pts.length < 14) return null
  const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted.slice(-14)
  const prev = sorted.slice(-28, -14)
  if (prev.length === 0) return null
  const avg = (arr: typeof recent) => arr.reduce((s, p) => s + (p.score ?? 0), 0) / arr.length
  const delta = Math.round(avg(recent) - avg(prev))
  if (delta > 2)  return { delta, label: `↑ +${delta} מהתקופה הקודמת`, sign: 'up' as const }
  if (delta < -2) return { delta, label: `↓ ${delta} מהתקופה הקודמת`, sign: 'down' as const }
  return { delta, label: `→ ${delta > 0 ? '+' : ''}${delta} מהתקופה הקודמת`, sign: 'flat' as const }
}
```

- [ ] **Step 2.3: Add a manual correctness check for `computeTrendDelta` (remove before final commit)**

Immediately after the function, temporarily add:

```ts
// TEMP: remove before commit
console.assert(computeTrendDelta([]) === null, 'empty → null')
console.assert(computeTrendDelta(Array.from({ length: 13 }, (_, i) => ({ date: `2026-01-${String(i+1).padStart(2,'0')}`, score: 50 }))) === null, '<14 → null')
const mockTrend = Array.from({ length: 28 }, (_, i) => ({ date: `2026-01-${String(i+1).padStart(2,'0')}`, score: i < 14 ? 60 : 70 }))
const delta = computeTrendDelta(mockTrend)
console.assert(delta?.sign === 'up', 'recent=70 prev=60 → up')
```

- [ ] **Step 2.4: Update state declarations**

Replace `editingHeader`, `headerNameInput`, `headerIconInput`, `savingHeader` with `showEditSheet`:

```ts
// Header edit state — now drives a bottom sheet
const [showEditSheet, setShowEditSheet] = useState(false)
const [headerNameInput, setHeaderNameInput] = useState('')
const [headerIconInput, setHeaderIconInput] = useState('')
const [savingHeader, setSavingHeader] = useState(false)

// Kebab / delete / move state (unchanged names)
const [showKebab, setShowKebab] = useState(false)
const [confirmDelete, setConfirmDelete] = useState(false)
const [deleting, setDeleting] = useState(false)
const [showMoveModal, setShowMoveModal] = useState(false)
const [moveTargetId, setMoveTargetId] = useState<string | null | undefined>(undefined)
const [moving, setMoving] = useState(false)

const [toast, setToast] = useState<string | null>(null)
```

- [ ] **Step 2.5: Add `trendDelta` memo**

After the existing `useEffect` hooks, add:

```ts
const trendDelta = useMemo(() => computeTrendDelta(umbrellaTrend), [umbrellaTrend])
```

- [ ] **Step 2.6: Write the new return JSX — page root + header**

Replace the entire `return (...)` with the following. Work section by section. Start with the page root and header:

```tsx
const color = umbrellaColor(umbrella.name)
const headerBg = umbrella?.name
  ? `linear-gradient(180deg, ${color}14 0%, ${C.surface} 100%)`
  : C.surface

return (
  <div dir="rtl" className="mn-umbrella-page">

    {/* ── Header ── */}
    <header className="mn-umbrella-header" style={{ background: headerBg }}>
      <div className="mn-umbrella-nav-row">
        <button className="mn-umbrella-ghost-btn" onClick={goBack}>
          <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
            <Icon name="back" size={16} color="rgba(44,44,42,0.52)" />
          </span>
          חזור
        </button>
        {!showEditSheet && (
          <button className="mn-umbrella-ghost-btn" aria-label="תפריט" onClick={() => setShowKebab(true)}>
            <Icon name="kebab" size={22} color="rgba(44,44,42,0.52)" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div className="mn-umbrella-identity-row">
        <div className="mn-umbrella-icon-name">
          <div
            className="mn-umbrella-icon-circle"
            style={{ background: color + '14', borderColor: color + '30' }}
          >
            {umbrella.icon}
          </div>
          <div className="mn-umbrella-name-block">
            <h1 className="mn-umbrella-name">{umbrella.name}</h1>
            <p className="mn-umbrella-health-label">ציון בריאות</p>
          </div>
        </div>
        <div className="mn-umbrella-ring-block">
          <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
            <Ring score={umbrella.computedHealthScore ?? 0} size={60} stroke={5} color={color} animate={false} />
            <span className="mn-umbrella-ring-score" style={{ color }}>
              {umbrella.computedHealthScore ?? '—'}
            </span>
          </div>
          <p className="mn-umbrella-ring-label">שבועיים אחרונים</p>
        </div>
      </div>
    </header>

    {/* ── Content ── */}
    <div className="mn-umbrella-content">

      {/* Trend card */}
      <div className="mn-hero-card mn-umbrella-trend-card">
        <div className="mn-umbrella-trend-header">
          <span className="mn-hero-eyebrow">מגמה — 6 שבועות</span>
          {trendDelta && (
            <span className={`mn-umbrella-trend-delta ${trendDelta.sign}`}>
              {trendDelta.label}
            </span>
          )}
        </div>
        <div className="mn-chart-wrap">
          {umbrellaTrend.length > 0 ? (
            <Sparkline
              data={umbrellaTrend.map(p => p.score)}
              color={color}
              width={358}
              height={64}
            />
          ) : (
            <div className="mn-umbrella-trend-empty">
              <svg
                width="100%"
                height={64}
                style={{ position: 'absolute', inset: 0, opacity: 0.15 }}
                preserveAspectRatio="none"
              >
                <path
                  d="M 0 32 Q 90 44 180 32 Q 270 20 358 32"
                  stroke={C.border}
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray="5 5"
                />
              </svg>
              <p className="mn-umbrella-trend-empty-text">
                אין נתונים עדיין — ענה על הראיון היומי לבנות מגמה
              </p>
            </div>
          )}
        </div>
      </div>

      <SubAreasSection umbrella={umbrella} navigate={navigate} />

      <QuestionsSection
        umbrellaId={umbrella.id}
        color={color}
        questions={questions}
        loadingQ={loadingQ}
        questionTrends={questionTrends}
        multiTrends={multiTrends}
        onQuestionsChange={setQuestions}
      />

      <ResolutionsSection
        umbrellaId={umbrella.id}
        questions={questions}
        resolutionsList={resolutionsList}
        loadingR={loadingR}
        onResolutionsListChange={setResolutionsList}
      />
    </div>

    {/* ── Toast ── */}
    {toast && <div className="mn-umbrella-toast">{toast}</div>}

    {/* ── FAB ── */}
    <button className="mn-umbrella-fab" onClick={() => navigate('chat')}>
      <Icon name="sparkle" size={22} color="#fff" strokeWidth={1.8} />
    </button>

    {/* ── Bottom sheets (see Steps 2.7–2.10) ── */}
  </div>
)
```

- [ ] **Step 2.7: Add the edit-umbrella sheet (replaces inline header edit)**

Inside the return, after the FAB button, add:

```tsx
{/* Edit umbrella sheet */}
{showEditSheet && (
  <div className="mn-sheet-backdrop" onClick={() => setShowEditSheet(false)}>
    <div className="mn-sheet mn-sheet-short" dir="rtl" onClick={e => e.stopPropagation()}>
      <div className="mn-sheet-drag-handle" />
      <div className="mn-sheet-titlebar">
        <span className="mn-sheet-title">עריכת מטרייה</span>
        <button className="mn-sheet-close-btn" onClick={() => setShowEditSheet(false)}>✕</button>
      </div>
      <div className="mn-sheet-body">
        <p className="mn-sheet-field-label">אייקון</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
          {EMOJI_OPTIONS.map(icon => (
            <button
              key={icon}
              onClick={() => setHeaderIconInput(icon)}
              style={{
                width: 36, height: 36, fontSize: 18, borderRadius: 10, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                background: headerIconInput === icon ? C.bar : C.faint,
                outline: headerIconInput === icon ? `2px solid ${C.bar}` : 'none',
                outlineOffset: 1,
              }}
            >
              {icon}
            </button>
          ))}
        </div>
        <p className="mn-sheet-field-label">שם</p>
        <input
          className="mn-sheet-input"
          value={headerNameInput}
          onChange={e => setHeaderNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveHeader(); if (e.key === 'Escape') setShowEditSheet(false) }}
          autoFocus
        />
      </div>
      <div className="mn-sheet-action-row">
        <button className="mn-sheet-btn-ghost" onClick={() => setShowEditSheet(false)}>ביטול</button>
        <button
          className="mn-sheet-btn-primary"
          onClick={handleSaveHeader}
          disabled={!headerNameInput.trim() || savingHeader ||
            (headerNameInput === umbrella.name && headerIconInput === umbrella.icon)}
        >
          {savingHeader ? 'שומר…' : 'שמור'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2.8: Add the kebab sheet (token update — same structure, new classes)**

```tsx
{/* Kebab sheet */}
{showKebab && (
  <div className="mn-sheet-backdrop" onClick={() => setShowKebab(false)}>
    <div className="mn-sheet" dir="rtl" onClick={e => e.stopPropagation()} style={{ paddingBottom: 40 }}>
      <div className="mn-sheet-drag-handle" />
      {[
        {
          emoji: '✏️', label: 'שינוי שם',
          action: () => { setHeaderNameInput(umbrella.name); setHeaderIconInput(umbrella.icon); setShowEditSheet(true); setShowKebab(false) },
        },
        {
          emoji: '🖼️', label: 'שינוי אייקון',
          action: () => { setHeaderNameInput(umbrella.name); setHeaderIconInput(umbrella.icon); setShowEditSheet(true); setShowKebab(false) },
        },
        {
          emoji: '📂', label: 'העברה תחת מטרייה אחרת',
          action: () => { setMoveTargetId(undefined); setShowMoveModal(true); setShowKebab(false) },
        },
        {
          emoji: '📦', label: 'ארכוב',
          action: () => { handleArchive(); setShowKebab(false) },
        },
        {
          emoji: '🗑️', label: 'מחיקה', danger: true,
          action: () => { setConfirmDelete(true); setShowKebab(false) },
        },
      ].map(item => (
        <button
          key={item.label}
          onClick={item.action}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
            fontFamily: 'inherit', fontSize: 15, textAlign: 'right',
            color: (item as { danger?: boolean }).danger ? C.low : C.ink,
          }}
        >
          <span style={{ fontSize: 20 }}>{item.emoji}</span>
          {item.label}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2.9: Add the delete-confirm sheet (token update)**

```tsx
{/* Delete confirmation sheet */}
{confirmDelete && (
  <div className="mn-sheet-backdrop" onClick={() => setConfirmDelete(false)}>
    <div className="mn-sheet" dir="rtl" onClick={e => e.stopPropagation()} style={{ padding: '0 0 0' }}>
      <div className="mn-sheet-drag-handle" />
      <div style={{ padding: '8px 20px 24px' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 8 }}>מחיקת מטרייה</p>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
          פעולה זו תמחק את המטרייה וכל הנתונים שלה — לא ניתן לשחזר.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDeleteUmbrella}
            disabled={deleting}
            style={{
              flex: 1, background: C.low, color: '#fff', borderRadius: 12,
              border: 'none', padding: '13px 0', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? 'מוחק…' : 'מחק לצמיתות'}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              flex: 1, background: C.faint, color: C.muted, borderRadius: 12,
              border: 'none', padding: '13px 0', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2.10: Add the move-parent sheet (token update — selected state: `C.bar` + `C.bar` text)**

```tsx
{/* Move-under-parent sheet */}
{showMoveModal && (() => {
  const descendantIds = collectDescendantIds(umbrella)
  const flat = flattenWithDepth(allUmbrellas).filter(
    ({ u }) => u.id !== umbrella.id && !descendantIds.has(u.id)
  )
  return (
    <div
      className="mn-sheet-backdrop"
      onClick={() => setShowMoveModal(false)}
    >
      <div
        className="mn-sheet mn-sheet-tall"
        dir="rtl"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 0 }}
      >
        <div className="mn-sheet-drag-handle" />
        <p style={{
          fontSize: 15, fontWeight: 700, color: C.ink,
          padding: '0 20px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          העבר מטרייה אל…
        </p>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <button
            onClick={() => setMoveTargetId(null)}
            style={{
              width: '100%', background: moveTargetId === null ? C.bar + '26' : 'transparent',
              border: 'none', cursor: 'pointer', padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'inherit', textAlign: 'right',
            }}
          >
            <span style={{ fontSize: 18 }}>🏠</span>
            <span style={{ fontSize: 14, color: moveTargetId === null ? C.bar : C.ink, fontWeight: moveTargetId === null ? 700 : 400 }}>
              ללא הורה (מטרייה ראשית)
            </span>
          </button>
          {flat.map(({ u, depth }) => (
            <button
              key={u.id}
              onClick={() => setMoveTargetId(u.id)}
              style={{
                width: '100%',
                background: moveTargetId === u.id ? C.bar + '26' : 'transparent',
                border: 'none', cursor: 'pointer',
                padding: `12px 20px 12px ${20 + depth * 18}px`,
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'inherit', textAlign: 'right',
              }}
            >
              <span style={{ fontSize: 18 }}>{u.icon || '🌿'}</span>
              <span style={{ fontSize: 14, color: moveTargetId === u.id ? C.bar : C.ink, fontWeight: moveTargetId === u.id ? 700 : 400 }}>
                {u.name}
              </span>
            </button>
          ))}
        </div>
        <div className="mn-sheet-action-row">
          <button
            onClick={handleMove}
            disabled={moveTargetId === undefined || moving}
            className="mn-sheet-btn-primary"
          >
            {moving ? 'מעביר…' : 'אישור'}
          </button>
          <button onClick={() => setShowMoveModal(false)} className="mn-sheet-btn-ghost">ביטול</button>
        </div>
      </div>
    </div>
  )
})()}
```

- [ ] **Step 2.11: Remove the temporary console.assert block from Step 2.3**

Delete the four `console.assert(...)` lines added in Step 2.3.

- [ ] **Step 2.12: Build to confirm no TypeScript errors**

```bash
cd client && npm run build 2>&1 | tail -30
```
Expected: `✓ built in X.Xs`. Fix any TypeScript errors before committing.

- [ ] **Step 2.13: Commit**

```bash
git add client/src/components/UmbrellaDetail.tsx
git commit -m "feat(ui): phase 4 — UmbrellaDetail page shell, header, trend card, sheets"
```

---

## Task 3: `SubAreasSection.tsx` — Elevated Cards, Task Preview

**Files:**
- Modify: `client/src/components/umbrella/SubAreasSection.tsx`

- [ ] **Step 3.1: Update imports**

```ts
import { useState } from 'react'
import { C, umbrellaColor } from '../../lib/dashboardTheme'  // C replaces T
import { umbrellaColor } from '../../lib/theme'               // still needed for color
import Sparkline from '../Sparkline'
import { createUmbrella } from '../../lib/api'
import { useStore } from '../../store/useStore'
import type { Umbrella } from '../../types/umbrella'
import type { NavigateFn } from '../../types/nav'
import { lastActivity, childSparkData } from './shared'  // drop PRIORITY_COLOR import
```

Wait — `umbrellaColor` comes from `../../lib/theme`, not `dashboardTheme`. Import `C` from `dashboardTheme` and keep `umbrellaColor` from `theme`:

```ts
import { useState } from 'react'
import { C } from '../../lib/dashboardTheme'
import { umbrellaColor } from '../../lib/theme'
import Sparkline from '../Sparkline'
import { createUmbrella } from '../../lib/api'
import { useStore } from '../../store/useStore'
import type { Umbrella } from '../../types/umbrella'
import type { NavigateFn } from '../../types/nav'
import { lastActivity, childSparkData } from './shared'
```

- [ ] **Step 3.2: Add local priority color map (replaces PRIORITY_COLOR from shared)**

After the imports:

```ts
const PRIORITY_MAP: Record<string, string> = {
  high:   C.low,    // #CC8A6E
  medium: C.mid,    // #EF9F27
  low:    C.bar,    // #9CAF88
}
```

- [ ] **Step 3.3: Rewrite the return JSX**

Replace the entire return block:

```tsx
return (
  <div className="mn-umbrella-section" dir="rtl">
    <div className="mn-umbrella-section-header-row">
      <span className="mn-umbrella-section-eyebrow">תתי-מטריות</span>
      {umbrella.children.length > 0 &&
        <span className="mn-gallery-count">{umbrella.children.length}</span>
      }
      {!showCreateChild && (
        <button className="mn-umbrella-add-btn" onClick={() => setShowCreateChild(true)}>
          + הוסף
        </button>
      )}
    </div>

    {umbrella.children.length > 0 && (
      <div className="mn-umbrella-subareas-list">
        {umbrella.children.map(child => {
          const childColor = umbrellaColor(child.name)
          const sparkData = childSparkData(child)
          const openTasks = child.tasks.filter(t => t.status !== 'done')
          const topTask = openTasks[0]

          return (
            <button
              key={child.id}
              className="mn-umbrella-subarea-card"
              style={{ padding: 0, border: `1px solid ${C.border}` }}
              onClick={() => navigate('umbrella', { umbrellaId: child.id })}
            >
              <div className="mn-umbrella-subarea-main">
                <div
                  className="mn-umbrella-subarea-icon"
                  style={{ background: childColor + '14', borderColor: childColor + '28' }}
                >
                  {child.icon || '🌿'}
                </div>
                <div className="mn-umbrella-subarea-text">
                  <p className="mn-umbrella-subarea-name">{child.name}</p>
                  <p className="mn-umbrella-subarea-activity">פעילות: {lastActivity(child)}</p>
                </div>
                <div className="mn-umbrella-subarea-right">
                  <span
                    className="mn-umbrella-subarea-score"
                    style={{ color: child.computedHealthScore !== null ? childColor : C.muted }}
                  >
                    {child.computedHealthScore ?? '—'}
                  </span>
                  {sparkData.length > 0 &&
                    <Sparkline data={sparkData} color={childColor} width={52} height={20} />
                  }
                </div>
              </div>

              {topTask && (
                <div className="mn-umbrella-task-preview">
                  <span
                    className="mn-umbrella-priority-dot"
                    style={{ background: PRIORITY_MAP[topTask.priority] ?? C.muted }}
                  />
                  <span className="mn-umbrella-task-title">{topTask.title}</span>
                  <button
                    className="mn-umbrella-ask-nefesh"
                    onClick={e => { e.stopPropagation(); navigate('chat') }}
                  >
                    שאל את Nefesh ←
                  </button>
                </div>
              )}
            </button>
          )
        })}
      </div>
    )}

    {/* No empty-state text — just the affordance to add is enough */}

    {showCreateChild && (
      <div className="mn-umbrella-create-form" dir="rtl">
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 12 }}>
          תת-מטרייה חדשה
        </p>
        <input
          value={childName}
          onChange={e => setChildName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateChild()}
          placeholder="שם (לדוג׳ בריאות)"
          autoFocus
          style={{
            width: '100%', background: C.warmBg, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '8px 12px', fontSize: 13, color: C.ink,
            outline: 'none', marginBottom: 12, fontFamily: 'inherit',
            boxSizing: 'border-box' as const, direction: 'rtl' as const,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 12 }}>
          {['🏠', '👨‍👩‍👧‍👦', '💰', '🧒', '✨', '💪', '📚', '🎵', '🌍', '❤️', '🕍', '💼'].map(icon => (
            <button
              key={icon}
              onClick={() => setChildIcon(icon)}
              style={{
                width: 36, height: 36, fontSize: 18, borderRadius: 10, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                background: childIcon === icon ? C.bar : C.faint,
                outline: childIcon === icon ? `2px solid ${C.bar}` : 'none',
                outlineOffset: 1,
              }}
            >
              {icon}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCreateChild}
            disabled={!childName.trim() || creatingChild}
            style={{
              flex: 1, background: C.bar, color: '#fff', borderRadius: 10, border: 'none',
              padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', opacity: !childName.trim() || creatingChild ? 0.5 : 1,
            }}
          >
            {creatingChild ? 'יוצר…' : 'צור'}
          </button>
          <button
            onClick={() => { setShowCreateChild(false); setChildName(''); setChildIcon('🏠') }}
            style={{
              flex: 1, background: C.faint, color: C.muted, borderRadius: 10,
              border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    )}
  </div>
)
```

- [ ] **Step 3.4: Build to verify no errors**

```bash
cd client && npm run build 2>&1 | tail -20
```

- [ ] **Step 3.5: Commit**

```bash
git add client/src/components/umbrella/SubAreasSection.tsx
git commit -m "feat(ui): phase 4 — SubAreasSection elevated cards"
```

---

## Task 4: `QuestionsSection.tsx` — Integrated Sparklines, Question Kebab

**Files:**
- Modify: `client/src/components/umbrella/QuestionsSection.tsx`

This task has the biggest structural change: the separate per-question trends section (~85 lines) is deleted and replaced by inline sparkline + value in each card. A question kebab dropdown replaces the inline edit/delete buttons.

- [ ] **Step 4.1: Update imports**

```ts
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { C } from '../../lib/dashboardTheme'
import { umbrellaColor } from '../../lib/theme'  // not needed here — color comes from props
import Sparkline from '../Sparkline'
import Icon from '../Icon'
import { createQuestion, updateQuestion, deleteQuestion } from '../../lib/api'
import type { ApiQuestionTrendPoint, ApiMultiTrendPoint } from '../../lib/api'
import type { Question } from '../../types/umbrella'
import {
  DEFAULT_FORM,
  type FormState,
  cadenceLabel,
  questionToForm,
  formToPayload,
} from './shared'
import { QuestionForm } from './QuestionForm'
```

Note: `CADENCE_COLOR` is no longer imported (removed — all pills are now uniform `C.faint`/`C.muted`).

- [ ] **Step 4.2: Add `typeAbbrev` helper and `renderQRight` at module level (above component)**

```ts
function typeAbbrev(q: Question): string {
  switch (q.answerType) {
    case 'scale': return `${q.scaleMin ?? 1}-${q.scaleMax ?? 5}`
    case 'boolean': return 'כן/לא'
    case 'boolean_partial': return 'כן/לא/חלקית'
    case 'multi_select': return `בחירה מרובה (${q.options?.length ?? 0})`
    default: return q.answerType
  }
}

function renderQRight(
  q: Question,
  trends: Record<string, ApiQuestionTrendPoint[]>,
  multi: Record<string, ApiMultiTrendPoint[]>,
  color: string
): ReactNode {
  if (q.answerType === 'text') {
    const latest = (trends[q.id] ?? []).at(-1)
    if (!latest?.answerText)
      return <span className="mn-umbrella-q-no-data">אין תשובות עדיין</span>
    return <span className="mn-umbrella-q-text-answer">{latest.answerText.slice(0, 24)}</span>
  }
  if (q.answerType === 'multi_select') {
    const pts = multi[q.id] ?? []
    if (pts.length === 0)
      return <span className="mn-umbrella-q-no-data">אין תשובות עדיין</span>
    const top = [...pts].sort((a, b) => b.total - a.total).slice(0, 2)
    return (
      <div className="mn-umbrella-q-chips">
        {top.map(p => <span key={p.option} className="mn-umbrella-q-chip">{p.option}</span>)}
      </div>
    )
  }
  const pts = trends[q.id] ?? []
  const latest = pts.at(-1)
  const sparkData = pts
    .filter(p => p.value !== null)
    .map(p => Math.round((p.value ?? 0) * 100))
  if (!latest)
    return (
      <div className="mn-umbrella-q-spark-empty">
        <span className="mn-umbrella-q-no-data">אין תשובות עדיין</span>
      </div>
    )
  const latestNode = (() => {
    if (latest.answerBoolean) {
      const map = {
        yes:     { sym: '✓', col: C.good },
        no:      { sym: '✗', col: C.low },
        partial: { sym: '◐', col: C.mid },
      } as const
      const m = map[latest.answerBoolean as keyof typeof map]
      return m ? <span style={{ color: m.col }}>{m.sym}</span> : null
    }
    if (latest.answerScale !== null) return `${latest.answerScale}/${q.scaleMax ?? 5}`
    if (latest.value !== null) return `${Math.round(latest.value * 100)}%`
    return '—'
  })()
  return (
    <div className="mn-umbrella-q-spark-wrap">
      {sparkData.length > 0 &&
        <Sparkline data={sparkData} color={color} width={52} height={22} />
      }
      <span className="mn-umbrella-q-latest" style={{ color }}>{latestNode}</span>
    </div>
  )
}
```

- [ ] **Step 4.3: Update component state — add `qMenuId`, add menu ref**

Inside the `QuestionsSection` component, add:
```ts
const [qMenuId, setQMenuId] = useState<string | null>(null)
const menuRef = useRef<HTMLDivElement>(null)

// Close kebab menu on outside click
useEffect(() => {
  function handleClick(e: MouseEvent) {
    if (!menuRef.current?.contains(e.target as Node)) {
      setQMenuId(null)
    }
  }
  if (qMenuId) document.addEventListener('mousedown', handleClick)
  return () => document.removeEventListener('mousedown', handleClick)
}, [qMenuId])
```

Remove the `regularQs` and `multiQs` variables (they were used only by the now-deleted separate trends section).

- [ ] **Step 4.4: Rewrite the return JSX**

Replace the entire `return (...)` with:

```tsx
return (
  <div className="mn-umbrella-section" dir="rtl">
    <div className="mn-umbrella-section-header-row">
      <span className="mn-umbrella-section-eyebrow">שאלות</span>
      {!loadingQ && questions.length > 0 &&
        <span className="mn-gallery-count">{questions.length}</span>
      }
    </div>

    {loadingQ && (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
        <div style={{
          width: 20, height: 20, border: `2px solid ${C.bar}`,
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )}

    {!loadingQ && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {questions.map(q => (
          <div key={q.id}>
            {editingId === q.id ? (
              <QuestionForm
                form={editForm}
                onChange={setEditForm}
                onSave={handleEdit}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : confirmDeleteId === q.id ? (
              <div style={{
                background: C.card, borderRadius: 14, padding: '12px 14px',
                border: `1px solid ${C.low}26`,
              }}>
                <p style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
                  למחוק את השאלה "{q.text}"?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDelete(q.id)}
                    style={{
                      flex: 1, background: C.low, color: '#fff', borderRadius: 8,
                      border: 'none', padding: '7px 0', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    מחק
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    style={{
                      flex: 1, background: C.faint, color: C.muted, borderRadius: 8,
                      border: 'none', padding: '7px 0', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <div className="mn-umbrella-q-card" style={{ opacity: q.enabled ? 1 : 0.5 }}>
                <div className="mn-umbrella-q-main">
                  <div className="mn-umbrella-q-text-col">
                    <p className="mn-umbrella-q-text">{q.text}</p>
                    <div className="mn-umbrella-q-pills">
                      <span className="mn-umbrella-q-pill">{cadenceLabel(q)}</span>
                      {q.answerType !== 'text' &&
                        <span className="mn-umbrella-q-pill">{typeAbbrev(q)}</span>
                      }
                    </div>
                  </div>
                  <div className="mn-umbrella-q-right-col">
                    {renderQRight(q, questionTrends, multiTrends, color)}
                  </div>
                  <div className="mn-umbrella-q-kebab-wrap" ref={qMenuId === q.id ? menuRef : undefined}>
                    <button
                      className="mn-umbrella-q-kebab"
                      onClick={() => setQMenuId(id => id === q.id ? null : q.id)}
                    >
                      ⋮
                    </button>
                    {qMenuId === q.id && (
                      <div className="mn-umbrella-q-menu">
                        <button
                          className="mn-umbrella-q-menu-item"
                          onClick={() => { startEdit(q); setQMenuId(null) }}
                        >
                          עריכה
                        </button>
                        <button
                          className="mn-umbrella-q-menu-item danger"
                          onClick={() => { setConfirmDeleteId(q.id); setQMenuId(null) }}
                        >
                          מחיקה
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )}

    {!loadingQ && questions.length === 0 && !showAddForm && (
      <p style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 10, textAlign: 'center' }}>
        אין שאלות עדיין. הוסף שאלות לצ׳ק-אין היומי שלך.
      </p>
    )}

    {showAddForm ? (
      <QuestionForm
        form={addForm}
        onChange={setAddForm}
        onSave={handleAdd}
        onCancel={() => { setShowAddForm(false); setAddForm(DEFAULT_FORM) }}
        saving={saving}
      />
    ) : (
      <button
        className="mn-umbrella-q-add-btn"
        onClick={() => { setShowAddForm(true); setEditingId(null) }}
      >
        <Icon name="plus" size={14} color="rgba(44,44,42,0.52)" />
        + הוספת שאלה
      </button>
    )}

    {/* Per-question trends section DELETED — sparklines now live inside each question card */}
  </div>
)
```

- [ ] **Step 4.5: Build to verify no errors**

```bash
cd client && npm run build 2>&1 | tail -20
```

- [ ] **Step 4.6: Commit**

```bash
git add client/src/components/umbrella/QuestionsSection.tsx
git commit -m "feat(ui): phase 4 — QuestionsSection integrated sparklines + kebab"
```

---

## Task 5: `QuestionForm.tsx` — Token Update + Card Class Names

**Files:**
- Modify: `client/src/components/umbrella/QuestionForm.tsx`

Token-only update. The component renders the form for adding/editing a question. No structural changes.

- [ ] **Step 5.1: Update imports — add `C`, remove `T`**

Replace the existing import that references `T` (e.g., `import { T } from '../../lib/theme'`) with:

```ts
import { C } from '../../lib/dashboardTheme'
```

Keep any other imports intact (Icon, OptionsManager, etc.).

- [ ] **Step 5.2: Find the root div of the component and add card classNames**

The component's root element (the outermost container `<div>`) should be updated to:

```tsx
<div className="mn-umbrella-q-card" style={{ padding: '12px 14px' }}>
  {/* existing content unchanged except token values */}
```

This makes the edit form match the card shape without a separate wrapper.

- [ ] **Step 5.3: Apply token substitutions throughout the file**

Apply these substitutions globally in the file (use find-and-replace, not manual edits):

| Find | Replace |
|---|---|
| `T.bgCard` | `C.card` |
| `T.bg` (when used as input bg) | `C.warmBg` |
| `T.sageMid` | `C.border` |
| `T.sage` (selected state) | `C.bar` |
| `T.sageLight` (default/cancel bg) | `C.faint` |
| `T.charcoal` | `C.ink` |
| `T.charcoalLight` | `C.muted` |
| `T.charcoalMid` | `C.muted` |
| `T.red` | `C.low` |

- [ ] **Step 5.4: Update focus rings on all inputs**

For every `<input>`, `<textarea>`, `<select>` that has an `:focus` or `outline` style, set:
```ts
// inline style on the element
onFocus={e => (e.currentTarget.style.outline = `1.5px solid ${C.bar}`)}
onBlur={e => (e.currentTarget.style.outline = 'none')}
```
Or if using a CSS-in-JS approach already, update the focus style to `outline: '1.5px solid #9CAF88'`.

- [ ] **Step 5.5: Build to verify no errors**

```bash
cd client && npm run build 2>&1 | tail -20
```

- [ ] **Step 5.6: Commit**

```bash
git add client/src/components/umbrella/QuestionForm.tsx
git commit -m "feat(ui): phase 4 — QuestionForm token update + card class"
```

---

## Task 6: `ResolutionsSection.tsx` — Cards, Creation Sheet, Detail Sheet

**Files:**
- Modify: `client/src/components/umbrella/ResolutionsSection.tsx`

- [ ] **Step 6.1: Update imports**

```ts
import { useState } from 'react'
import { C } from '../../lib/dashboardTheme'
import { createResolution, abandonResolution } from '../../lib/api'
import type { ApiResolution } from '../../lib/api'
import type { Question } from '../../types/umbrella'
import {
  DEFAULT_RESOLUTION_FORM,
  type ResolutionFormState,
  type ResolutionDuration,
  type ResolutionQSource,
  resolutionEndDate,
  resolutionQType,
  todayClientStr,
  addClientDays,
  fmtDate,
} from './shared'
```

- [ ] **Step 6.2: Add a helper to get question text for a resolution**

After imports, before the component:

```ts
function getQuestionText(r: ApiResolution, questions: Question[]): string {
  const q = questions.find(q => q.id === r.questionId)
  return q?.text ?? ''
}
```

- [ ] **Step 6.3: Rewrite the active resolution cards**

Replace the `{active.map(r => { ... })}` block with:

```tsx
{active.map(r => {
  const p = r.progress
  const pct = p?.percentage ?? 0
  const pctColor = pct >= 70 ? C.good : pct >= 40 ? C.mid : C.low
  const remaining = p?.daysRemaining ?? 0
  const streak = p?.currentStreak ?? 0
  const remainingLabel = remaining > 0 ? `נותרו ${remaining} ימים` : 'הסתיים'
  const questionText = getQuestionText(r, questions)

  return (
    <button
      key={r.id}
      className="mn-umbrella-resolution-card"
      onClick={() => { setDetailResolution(r); setConfirmAbandon(false) }}
    >
      <p className="mn-umbrella-resolution-title">{r.title}</p>
      {questionText && (
        <p className="mn-umbrella-resolution-question">{questionText}</p>
      )}
      <div className="mn-umbrella-resolution-bar-row">
        <span className="mn-umbrella-resolution-pct-pill">{pct}%</span>
        <div className="mn-umbrella-resolution-bar-track">
          <div
            className="mn-umbrella-resolution-bar-fill"
            style={{ width: `${pct}%`, background: pctColor }}
          />
        </div>
      </div>
      <div className="mn-umbrella-resolution-stats">
        <span className="mn-umbrella-resolution-stat">
          {p ? `${p.successfulDays}/${p.elapsedDays} ימים` : '—'}
        </span>
        {streak > 0 &&
          <span className="mn-umbrella-resolution-stat streak">🔥 {streak}</span>
        }
        {r.successThreshold !== null &&
          <span className="mn-umbrella-resolution-stat threshold">≥{r.successThreshold}</span>
        }
        <span className="mn-umbrella-resolution-stat remaining">{remainingLabel}</span>
      </div>
    </button>
  )
})}
```

- [ ] **Step 6.4: Replace the inline creation form with a bottom sheet**

Replace the `{showAddResolution && (<div dir="rtl" style={...}>...</div>)}` block with:

```tsx
{showAddResolution && (
  <div className="mn-sheet-backdrop" onClick={() => { setShowAddResolution(false); setResolutionForm(DEFAULT_RESOLUTION_FORM) }}>
    <div className="mn-sheet mn-sheet-tall" dir="rtl" onClick={e => e.stopPropagation()}>
      <div className="mn-sheet-drag-handle" />
      <div className="mn-sheet-titlebar">
        <span className="mn-sheet-title">החלטה חדשה</span>
        <button
          className="mn-sheet-close-btn"
          onClick={() => { setShowAddResolution(false); setResolutionForm(DEFAULT_RESOLUTION_FORM) }}
        >
          ✕
        </button>
      </div>
      <div className="mn-sheet-body">
        <p className="mn-sheet-field-label">כותרת</p>
        <input
          className="mn-sheet-input"
          value={resolutionForm.title}
          onChange={e => setResolutionForm(f => ({ ...f, title: e.target.value }))}
          placeholder="לדוג׳: ריצה יומית"
        />

        <p className="mn-sheet-field-label">שאלה</p>
        <div className="mn-sheet-toggle-row">
          {(['existing', 'new'] as ResolutionQSource[]).map(src => (
            <button
              key={src}
              className={`mn-sheet-toggle${resolutionForm.qSource === src ? ' active' : ''}`}
              onClick={() => setResolutionForm(f => ({ ...f, qSource: src }))}
            >
              {src === 'existing' ? 'שאלה קיימת' : 'שאלה חדשה'}
            </button>
          ))}
        </div>

        {resolutionForm.qSource === 'existing' && (
          questions.length === 0
            ? <p style={{ fontSize: 12, color: C.low, marginBottom: 12 }}>אין שאלות במטרייה זו — הוסף שאלה תחילה.</p>
            : <select
                value={resolutionForm.existingQId}
                onChange={e => setResolutionForm(f => ({ ...f, existingQId: e.target.value }))}
                className="mn-sheet-input"
                style={{ marginTop: 8 }}
              >
                {questions.map(q => <option key={q.id} value={q.id}>{q.text.slice(0, 60)}</option>)}
              </select>
        )}

        {resolutionForm.qSource === 'new' && (
          <div style={{ marginBottom: 12, marginTop: 8 }}>
            <input
              className="mn-sheet-input"
              value={resolutionForm.newQText}
              onChange={e => setResolutionForm(f => ({ ...f, newQText: e.target.value }))}
              placeholder="טקסט השאלה..."
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {([['boolean', 'כן/לא'], ['boolean_partial', 'כן/לא/חלקית'], ['scale', 'סולם']] as [typeof resolutionForm.newQType, string][]).map(([t, label]) => (
                <button
                  key={t}
                  className={`mn-sheet-toggle${resolutionForm.newQType === t ? ' active' : ''}`}
                  onClick={() => setResolutionForm(f => ({ ...f, newQType: t }))}
                >
                  {label}
                </button>
              ))}
            </div>
            {resolutionForm.newQType === 'scale' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>טווח:</span>
                <input type="number" value={resolutionForm.newQScaleMin}
                  onChange={e => setResolutionForm(f => ({ ...f, newQScaleMin: Number(e.target.value) }))}
                  style={{ width: 52, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 6px', fontSize: 12, textAlign: 'center', outline: 'none', fontFamily: 'inherit', color: C.ink }} />
                <span style={{ color: C.muted }}>—</span>
                <input type="number" value={resolutionForm.newQScaleMax}
                  onChange={e => setResolutionForm(f => ({ ...f, newQScaleMax: Number(e.target.value) }))}
                  style={{ width: 52, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 6px', fontSize: 12, textAlign: 'center', outline: 'none', fontFamily: 'inherit', color: C.ink }} />
              </div>
            )}
          </div>
        )}

        {needsThreshold && (
          <div style={{ marginBottom: 12 }}>
            <p className="mn-sheet-field-label">סף הצלחה (ערך מינימלי)</p>
            <input
              type="number"
              value={resolutionForm.successThreshold}
              onChange={e => setResolutionForm(f => ({ ...f, successThreshold: e.target.value }))}
              placeholder="לדוג׳: 7"
              style={{ width: 80, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '6px 10px', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
            />
          </div>
        )}

        <p className="mn-sheet-field-label">משך</p>
        <div className="mn-sheet-chips-row" style={{ marginBottom: resolutionForm.duration === 'custom' ? 10 : 14 }}>
          {([['30', '30 ימים'], ['90', '90 ימים'], ['180', '180 ימים'], ['custom', 'מותאם']] as [ResolutionDuration, string][]).map(([d, label]) => (
            <button
              key={d}
              className={`mn-sheet-chip${resolutionForm.duration === d ? ' active' : ''}`}
              onClick={() => setResolutionForm(f => ({ ...f, duration: d, customEnd: d === 'custom' ? addClientDays(today, 30) : f.customEnd }))}
            >
              {label}
            </button>
          ))}
        </div>
        {resolutionForm.duration === 'custom' && (
          <input
            type="date"
            value={resolutionForm.customEnd}
            min={addClientDays(today, 1)}
            onChange={e => setResolutionForm(f => ({ ...f, customEnd: e.target.value }))}
            className="mn-sheet-input"
            style={{ marginBottom: 14 }}
          />
        )}
        <p className="mn-sheet-date-range">{today} → {resolutionEndDate(resolutionForm)}</p>
      </div>

      <div className="mn-sheet-action-row">
        <button
          className="mn-sheet-btn-ghost"
          onClick={() => { setShowAddResolution(false); setResolutionForm(DEFAULT_RESOLUTION_FORM) }}
        >
          ביטול
        </button>
        <button
          className="mn-sheet-btn-primary"
          onClick={handleSaveResolution}
          disabled={!canSave}
        >
          {savingR ? 'שומר…' : 'שמור'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6.5: Update past resolutions section (token update)**

Replace the `{past.length > 0 && (...)}` block:

```tsx
{past.length > 0 && (
  <div style={{ marginTop: 12 }}>
    <button
      onClick={() => setPastExpanded(e => !e)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.muted, fontFamily: 'inherit', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <span style={{ display: 'inline-block', transform: pastExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>›</span>
      החלטות שהסתיימו
      <span className="mn-gallery-count" style={{ marginRight: 4 }}>{past.length}</span>
    </button>
    {pastExpanded && (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {past.map(r => (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.75 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 2 }}>{r.title}</p>
              <p style={{ fontSize: 11, color: C.muted }}>{fmtDate(String(r.startDate))} — {fmtDate(String(r.endDate))}</p>
            </div>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: r.status === 'completed' ? C.bar + '22' : C.faint,
              color: r.status === 'completed' ? C.bar : C.muted,
            }}>
              {r.status === 'completed' ? 'הושלמה' : 'ננטשה'}
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.ink, minWidth: 36, textAlign: 'center' }}>
              {r.finalScore ?? '—'}%
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6.6: Update the resolution detail bottom sheet**

Replace the `{detailResolution && (() => { ... })()}` block with the updated version that adds linked question text and uses `C.*` tokens:

```tsx
{detailResolution && (() => {
  const r = detailResolution
  const p = r.progress
  const pct = p?.percentage ?? 0
  const pctColor = pct >= 70 ? C.good : pct >= 40 ? C.mid : C.low
  const questionText = getQuestionText(r, questions)
  return (
    <div
      className="mn-sheet-backdrop"
      onClick={() => { setDetailResolution(null); setConfirmAbandon(false) }}
    >
      <div
        className="mn-sheet mn-sheet-tall"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mn-sheet-drag-handle" />
        <div className="mn-sheet-body" style={{ paddingTop: 12 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{r.title}</p>
          {questionText && (
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{questionText}</p>
          )}
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
            {fmtDate(String(r.startDate))} — {fmtDate(String(r.endDate))}
            {p && p.daysRemaining > 0 && ` • נותרו ${p.daysRemaining} ימים`}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: pctColor, lineHeight: 1 }}>{pct}%</span>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: C.faint, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', background: pctColor, borderRadius: 4, width: `${pct}%`, transition: 'width 0.4s ease' }} />
              </div>
              {p && <p style={{ fontSize: 12, color: C.muted }}>{p.successfulDays} מתוך {p.elapsedDays} ימים הצליחו</p>}
            </div>
          </div>

          {p && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, background: C.warmBg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: C.mid }}>{p.currentStreak}</p>
                <p style={{ fontSize: 11, color: C.muted }}>רצף נוכחי</p>
              </div>
              <div style={{ flex: 1, background: C.warmBg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: C.line }}>{p.longestStreak}</p>
                <p style={{ fontSize: 11, color: C.muted }}>רצף הארוך</p>
              </div>
              <div style={{ flex: 1, background: C.warmBg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{p.totalDays}</p>
                <p style={{ fontSize: 11, color: C.muted }}>סה"כ ימים</p>
              </div>
            </div>
          )}

          {!confirmAbandon ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmAbandon(true)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: `1px solid ${C.low}44`, background: 'transparent', color: C.low, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                נטוש החלטה
              </button>
              <button
                onClick={() => { setDetailResolution(null); setConfirmAbandon(false) }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: C.faint, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                סגור
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: C.ink, marginBottom: 12 }}>לנטוש את ההחלטה? הציון הנוכחי יישמר.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAbandonResolution}
                  disabled={abandoningR}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: C.low, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: abandoningR ? 0.6 : 1 }}
                >
                  {abandoningR ? 'מנטש…' : 'אישור — נטוש'}
                </button>
                <button
                  onClick={() => setConfirmAbandon(false)}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: C.faint, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})()}
```

- [ ] **Step 6.7: Update the section header**

Replace the existing `<div>` at the top of the return with:

```tsx
return (
  <div className="mn-umbrella-section" dir="rtl">
    <div className="mn-umbrella-section-header-row">
      <span className="mn-umbrella-section-eyebrow">החלטות</span>
      {active.length > 0 && <span className="mn-gallery-count">{active.length}</span>}
      {!showAddResolution && (
        <button
          className="mn-umbrella-add-btn"
          onClick={() => { setShowAddResolution(true); setResolutionForm({ ...DEFAULT_RESOLUTION_FORM, existingQId: questions[0]?.id ?? '' }) }}
        >
          + החלטה חדשה
        </button>
      )}
    </div>
    {!loadingR && active.length === 0 && !showAddResolution && (
      <p style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
        אין החלטות פעילות
      </p>
    )}
    {/* active cards, creation sheet, past list, detail sheet */}
```

- [ ] **Step 6.8: Build to verify no errors**

```bash
cd client && npm run build 2>&1 | tail -30
```

- [ ] **Step 6.9: Commit**

```bash
git add client/src/components/umbrella/ResolutionsSection.tsx
git commit -m "feat(ui): phase 4 — ResolutionsSection cards, creation sheet, detail sheet"
```

---

> **⏸ CODE REVIEW CHECKPOINT 2:** After Step 6.9, invoke `/code-review` on the full phase-4 diff (Tasks 2–6). Review for: correct token usage, behavior preservation (kebab actions, CRUD flows, sheet open/close, navigation), any missed `T.*` references, RTL correctness, accessibility (focus-visible rings, `<button>` elements for interactive cards).

---

## Task 7: Build Verification + Manual Test Checklist

**Files:** no code changes — verification only.

- [ ] **Step 7.1: Clean build**

```bash
cd client && npm run build 2>&1
```
Expected: `✓ built in X.Xs` with zero errors, zero warnings about type errors.

- [ ] **Step 7.2: Start dev server**

```bash
cd client && npm run dev
```
Open the app in a browser and navigate to UmbrellaDetail (tap any umbrella from HomeScreen).

- [ ] **Step 7.3: Run manual verification checklist**

Check each item — mark pass/fail:

**Header:**
- [ ] Color-washed gradient visible on header (subtle tint — not garish)
- [ ] Score ring (60px) shows with correct score and "שבועיים אחרונים" label below
- [ ] Back button navigates out
- [ ] Kebab button opens kebab sheet

**Kebab sheet:**
- [ ] "שינוי שם" opens the edit-umbrella sheet (NOT inline morph)
- [ ] "שינוי אייקון" opens the same edit sheet
- [ ] "העברה תחת מטרייה אחרת" opens move-parent sheet
- [ ] "ארכוב" archives and returns to previous screen
- [ ] "מחיקה" opens delete-confirm sheet → delete works → navigates away

**Edit-umbrella sheet:**
- [ ] Opens with current name + current icon pre-selected
- [ ] שמור is disabled until a value changes
- [ ] Saving updates the header icon and name (fade transition visible)
- [ ] ביטול / ✕ / backdrop dismisses without change

**Trend card:**
- [ ] 64px tall Sparkline renders if trend data exists
- [ ] Delta label appears (↑/↓/→) for umbrellas with ≥28 data points; absent for sparse ones
- [ ] Ghost SVG + italic text shown when no trend data
- [ ] Card shares `.mn-hero-card` visual language (white, 20px radius, shadow)

**Sub-areas:**
- [ ] Section header shows "תתי-מטריות" + count badge
- [ ] Each card: icon circle with color tint, name, last-activity, score, sparkline
- [ ] Task preview row appears if an open task exists; priority dot colored correctly
- [ ] "שאל את Nefesh ←" button navigates to chat (not the card)
- [ ] Tapping the card navigates into the child umbrella
- [ ] "+ הוסף" opens inline create form; create works

**Questions:**
- [ ] Section header shows "שאלות" + count badge
- [ ] Each card shows question text + cadence pill + type pill
- [ ] Right column: sparkline + latest value for boolean/scale questions; chips for multi_select; truncated text for text type; "אין תשובות עדיין" for new questions
- [ ] Kebab (⋮) opens a 2-item dropdown (עריכה / מחיקה)
- [ ] Dropdown closes when clicking anywhere outside
- [ ] עריכה enters edit mode (QuestionForm replaces card in-place)
- [ ] מחיקה shows inline confirm; delete works
- [ ] "+ הוספת שאלה" button shows dashed border; opens QuestionForm; create works
- [ ] Separate "per-question trends" section is GONE — no second list below

**Resolutions:**
- [ ] Section header shows "החלטות" + count badge
- [ ] Active card: title + linked question text + pct pill + 8px bar + stats row
- [ ] Progress bar color: green ≥70%, amber 40-69%, red <40%
- [ ] Streak 🔥 appears only when streak > 0; threshold shown if scale-type
- [ ] Tapping active card opens detail bottom sheet
- [ ] "+ החלטה חדשה" opens a bottom sheet (NOT inline expansion)
- [ ] Creation form: all fields work, שמור disabled until valid, sheet closes on save
- [ ] Past resolutions collapsible with count badge, desaturated, badge colors correct
- [ ] Detail sheet: linked question text shows, large pct in semantic color, 3 stat cards, abandon as ghost-destructive, inline confirm works

**General:**
- [ ] FAB (sparkle button) bottom-right, navigates to chat
- [ ] Toast ("המטרייה אורכבה") appears after archive, fades
- [ ] No `T.*` token references remain in any of the 6 modified files: `grep -r "T\." client/src/components/UmbrellaDetail.tsx client/src/components/umbrella/` shows only `T.` inside comment strings (not code)
- [ ] Build is clean with zero TypeScript errors

---

## Task 8: Finishing — STATUS.md, Commit, Push

**Files:**
- Modify: `STATUS.md` (repo root)
- Modify: `CLAUDE.md` (only if stack/schema/routes changed — they didn't; skip)

- [ ] **Step 8.1: Update STATUS.md**

In the **Recently shipped** section, add after the Dashboard Phase 3 entry:

```markdown
- **Dashboard Phase 4 (umbrella detail redesign):** UmbrellaDetail and its five subcomponents migrated to the Sage design language (`C.*` tokens, `.mn-umbrella-*` / `.mn-sheet-*` CSS classes). Key changes: color-washed header banner (umbrella-specific identity tint), hero-weight trend card with 6-week Sparkline + 14-day delta label, elevated sub-area cards with task-preview row, per-question sparklines integrated into each question card (separate trends section deleted), question editing via kebab dropdown, resolution creation and rename/icon edit moved to bottom sheets, active resolution cards show linked question text + 8px progress bar + threshold tag. All existing behaviors preserved. No new dependencies.
```

In the **Pending / partial** section, remove:
```
- **Dashboard Phases 4–6:** ...
```
And update it to:
```
- **Dashboard Phases 5–6:** InterviewScreen and ProfileScreen visual alignment with new design system — next after Phase 4.
```

Also update the **UmbrellaDetail.tsx refactor** entry — it was pending; it shipped in commit `9b6f3a2` and the STATUS.md description was stale. Remove it from Pending.

- [ ] **Step 8.2: Copy updated files to F:\All\**

```powershell
Copy-Item "H:\myNefesh\STATUS.md" "F:\All\STATUS.md" -Force
Copy-Item "H:\myNefesh\CLAUDE.md" "F:\All\CLAUDE.md" -Force
```

- [ ] **Step 8.3: Commit STATUS.md**

```bash
git add STATUS.md
git commit -m "docs: update STATUS.md (dashboard phase 4 shipped)"
```

- [ ] **Step 8.4: Push to master**

```bash
git push origin master
```

Expected: `master -> master` with the full phase-4 commit history.

---

## Self-Review

**Spec coverage check:**

| Spec section | Task(s) covering it |
|---|---|
| Token migration table | Tasks 2–6 (all file tasks do T.→C. swap) |
| Page shell (`.mn-umbrella-page`, `.mn-umbrella-content`) | Task 1 (CSS) + Task 2 (JSX) |
| Header: color wash, safe-area, ring, ghost buttons | Task 1 (CSS) + Task 2 (JSX) |
| Header: edit sheet (rename/icon) | Task 2 Steps 2.7 |
| Kebab/delete/move sheets: token update | Task 2 Steps 2.8–2.10 |
| Trend card: hero-weight, delta, ghost empty state | Task 1 (CSS) + Task 2 Step 2.6 |
| `computeTrendDelta` function | Task 2 Step 2.2 |
| Sub-areas: button element, PRIORITY_MAP, task preview | Task 3 |
| Sub-areas: empty-state rule (no placeholder text) | Task 3 Step 3.3 |
| Questions: `renderQRight` module-level | Task 4 Step 4.2 |
| Questions: kebab dropdown + click-outside | Task 4 Steps 4.3–4.4 |
| Questions: kill separate trends section | Task 4 Step 4.4 |
| `QuestionForm`: token update + card classNames | Task 5 |
| Resolutions: active card as `<button>`, question text, threshold | Task 6 Step 6.3 |
| Resolutions: creation → bottom sheet | Task 6 Step 6.4 |
| Resolutions: past resolutions token update | Task 6 Step 6.5 |
| Resolutions: detail sheet with question text + C.* tokens | Task 6 Step 6.6 |
| Shared `.mn-sheet-*` classes | Task 1 (CSS) |
| STATUS.md update | Task 8 |
| Push to master | Task 8 |

**No gaps found.** All spec sections covered.

**Placeholder scan:** No TBD, TODO, "similar to Task N", or vague instructions found. Every step includes actual code or exact commands.

**Type consistency check:**
- `computeTrendDelta` returns `{ delta: number, label: string, sign: 'up' | 'down' | 'flat' } | null` — used in Task 2 Step 2.6 as `trendDelta?.sign` and `trendDelta?.label` ✓
- `renderQRight` signature: `(q: Question, trends: Record<string, ApiQuestionTrendPoint[]>, multi: Record<string, ApiMultiTrendPoint[]>, color: string) => ReactNode` — called in Task 4 Step 4.4 as `renderQRight(q, questionTrends, multiTrends, color)` ✓
- `getQuestionText` signature: `(r: ApiResolution, questions: Question[]) => string` — called in Task 6 Steps 6.3 and 6.6 ✓
- `C` token usage: `C.bar`, `C.line`, `C.good`, `C.mid`, `C.low`, `C.ink`, `C.muted`, `C.faint`, `C.card`, `C.warmBg`, `C.surface`, `C.border` — all defined in `makeColors('Sage', false)` in `dashboardTheme.ts` ✓
- `PRIORITY_MAP` defined in Task 3 Step 3.2, used in Step 3.3 ✓
