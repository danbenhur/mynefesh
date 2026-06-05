# Phase 4 — Umbrella Detail Redesign Spec

**Date:** 2026-06-05  
**Status:** Approved — ready for implementation  
**Companion:** CLAUDE.md (technical reference), STATUS.md (strategic brief)

---

## Context

Phases 1–3 of the dashboard migration shipped the new Sage design language to HomeScreen (hero chart, gallery cards) and ChatScreen. Phase 4 brings the same visual language to the UmbrellaDetail drill-down — the most complex screen in the app.

The UmbrellaDetail subcomponent split is **already on master** (commit `9b6f3a2`). The orchestrator (`UmbrellaDetail.tsx`) is ~552 lines; the five subcomponents live in `client/src/components/umbrella/`. Phase 4 is purely a redesign of those six files — no server routes, schema, or API contracts change.

---

## Files in Scope

| File | Role |
|---|---|
| `client/src/components/UmbrellaDetail.tsx` | Orchestrator: header, trend card, modals |
| `client/src/components/umbrella/SubAreasSection.tsx` | Child umbrella list + create form |
| `client/src/components/umbrella/QuestionsSection.tsx` | Question list + per-question trends (integrated) |
| `client/src/components/umbrella/QuestionForm.tsx` | Question editor form (token update only) |
| `client/src/components/umbrella/ResolutionsSection.tsx` | Resolutions CRUD + bottom sheets |
| `client/src/components/dashboard/dashboard.css` | Extended with `.mn-umbrella-*` and `.mn-sheet-*` classes |

**Not touched:** all server code, `lib/theme.ts`, `Sparkline`, `Ring`, `ComboChart`, `Icon` components, `shared.ts`.

---

## Token Migration

All `T.*` references in the six files above are replaced with `C.*` from `dashboardTheme.ts`.

| Old `T.*` | New `C.*` | Notes |
|---|---|---|
| `T.bg` | `C.warmBg` | Page background |
| `T.bgCard` | `C.card` | White card surface |
| `T.sage` | `C.bar` | Sage green primary |
| `T.sageLight` | `C.faint` (neutral) or `C.bar` at low opacity (sage tints) | See note below |
| `T.sageMid` | `C.border` | Borders and dividers |
| `T.charcoal` | `C.ink` | Primary text |
| `T.charcoalLight` / `T.charcoalMid` | `C.muted` | Secondary text — if two adjacent elements both map to `C.muted` and lose hierarchy, introduce a one-off opacity adjustment inline |
| `T.red` | `C.low` | Destructive / low health |
| `T.amber` | `C.mid` | Streak / warning |
| `T.blue` | `C.line` | Duration chips, ask-Nefesh link |
| `T.blueLight` | `C.faint` | Light tint backgrounds |

**`T.sageLight` drift note:** `C.faint` is a neutral ink tint (`rgba(44,44,42,0.05)`), not a sage tint. If a use-site specifically needs a sage-colored light background (e.g., a chip that should feel branded), use `C.bar + '14'` (8% opacity hex) instead of `C.faint`. Use `C.faint` for true neutral lights only.

**CSS strategy:** All new layout rules go into `dashboard.css` as `.mn-umbrella-*` or `.mn-sheet-*` classes. Inline `style={}` props are kept only for values computed at runtime (gradient tints from `umbrellaColor()`, progress bar `width: pct%`, health-signal colors).

**CSS import:** `import '../components/dashboard/dashboard.css'` in `UmbrellaDetail.tsx` only. Vite deduplicates; subcomponents do not re-import.

---

## Section 1 — Page Shell

```css
/* Added to dashboard.css under the Phase 4 section header comment */

.mn-umbrella-page {
  min-height: 100%;
  background: #F5F1E8;           /* C.warmBg */
  padding-bottom: 100px;        /* clears BottomNav */
}

.mn-umbrella-content {
  padding: 16px 16px 0;
}
```

Root JSX:
```jsx
<div dir="rtl" className="mn-umbrella-page">
  <header className="mn-umbrella-header" style={{ background: headerBg }}>...</header>
  <div className="mn-umbrella-content">
    {/* trend card, sub-areas, questions, resolutions */}
  </div>
  {toast && <div className="mn-umbrella-toast">{toast}</div>}
  <button className="mn-umbrella-fab" onClick={() => navigate('chat')}>...</button>
  {/* bottom sheets: kebab, delete, move, edit */}
</div>
```

**FAB** (`mn-umbrella-fab`): token-only update, `T.sage → C.bar`, `T.blue → C.line`. `right: 20px; bottom: 100px` unchanged — `position: fixed` is viewport-physical, not RTL-aware.

**Toast** (`mn-umbrella-toast`): `background: C.ink` (was `T.charcoal`). Position/timing logic unchanged.

**Header is not sticky.** The delta label on the trend card provides lightweight status off-header; a sticky header decision is deferred.

---

## Section 2 — Header (`UmbrellaDetail.tsx`)

### Background tint

```ts
const headerBg = `linear-gradient(180deg, ${color}14 0%, ${C.surface} 100%)`
// '14' hex ≈ 8% opacity. If any umbrella color tips "too themed", try '0F' (6%).
// Guard: if !umbrella?.name, render background: C.surface with no gradient.
```

### DOM structure

```jsx
<header className="mn-umbrella-header" style={{ background: headerBg }}>
  <div className="mn-umbrella-nav-row">
    <button className="mn-umbrella-ghost-btn" onClick={goBack}>
      <Icon name="back" size={16} style={{ transform: 'scaleX(-1)' }} /> חזור
    </button>
    {!showEditSheet && (
      <button className="mn-umbrella-ghost-btn" onClick={() => setShowKebab(true)}>
        <Icon name="kebab" size={22} strokeWidth={2.5} />
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
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        <Ring score={umbrella.computedHealthScore ?? 0} size={60} stroke={5} color={color} animate={false} />
        <span className="mn-umbrella-ring-score" style={{ color }}>
          {umbrella.computedHealthScore ?? '—'}
        </span>
      </div>
      <p className="mn-umbrella-ring-label">שבועיים אחרונים</p>
    </div>
  </div>
</header>
```

### CSS

```css
/* ===== Phase 4 — Umbrella detail ===== */

.mn-umbrella-header {
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 20px 20px;
  border-bottom: 1px solid rgba(44,44,42,0.08);
  /* no box-shadow — gradient wash is the depth cue */
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
  transition: opacity 0.2s;     /* crossfade after rename save */
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
  transition: opacity 0.2s;     /* crossfade after rename save */
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
```

### State change: rename/icon → bottom sheet

`editingHeader` boolean is replaced by `showEditSheet`. State `headerNameInput` and `headerIconInput` initialize from current umbrella values when the sheet opens. Kebab actions "שינוי שם" and "שינוי אייקון" both open the same sheet.

**Edit sheet** uses shared `.mn-sheet mn-sheet-short` classes. See Section 7 (Shared Sheet CSS). Content: emoji picker grid (6-col, 36×36px buttons, `C.faint` default bg, `C.bar` selected bg + ring) + name text input. Action row: ביטול (ghost) + שמור (primary, disabled until value changes). Crossfade on save: `opacity` transitions on `.mn-umbrella-icon-circle` and `.mn-umbrella-name` while `loadUmbrellas()` resolves.

### Kebab / delete / move sheets — token update only

- Sheet bg: `C.surface` (#FBF8F1)
- Drag handle: `C.border`
- Normal items: `C.ink`; destructive: `C.low`
- Move selected state: `C.bar` at 15% opacity bg + `C.bar` text
- Move confirm button: `C.bar` fill
- All cancel buttons: `C.faint` fill + `C.muted` text

These three sheets also adopt the shared `.mn-sheet-backdrop` / `.mn-sheet` wrapper classes.

---

## Section 3 — Trend Card (`UmbrellaDetail.tsx`)

Extends `.mn-hero-card`. Second class `.mn-umbrella-trend-card` overrides the hero-card's 16px side margins (the content wrapper already provides 16px padding).

### Delta computation

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
// Called as: const trendDelta = useMemo(() => computeTrendDelta(umbrellaTrend), [umbrellaTrend])
```

### DOM structure

```jsx
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
      <Sparkline data={umbrellaTrend.map(p => p.score)} color={color} width={358} height={64} />
    ) : (
      <div className="mn-umbrella-trend-empty">
        <svg width="100%" height={64} style={{ position: 'absolute', inset: 0, opacity: 0.15 }} preserveAspectRatio="none">
          <path d="M 0 32 Q 90 44 180 32 Q 270 20 358 32" stroke={C.border} strokeWidth={1.5} fill="none" strokeDasharray="5 5" />
        </svg>
        <p className="mn-umbrella-trend-empty-text">אין נתונים עדיין — ענה על הראיון היומי לבנות מגמה</p>
      </div>
    )}
  </div>
</div>
```

### CSS

```css
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

.mn-umbrella-trend-delta {
  font-size: 12px;
  font-weight: 600;
}
.mn-umbrella-trend-delta.up   { color: #6FA06B; }   /* C.good */
.mn-umbrella-trend-delta.down { color: #CC8A6E; }   /* C.low */
.mn-umbrella-trend-delta.flat { color: rgba(44,44,42,0.52); }  /* C.muted */

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
```

---

## Section 4 — Sub-areas (`SubAreasSection.tsx`)

### Shared section header pattern (used by all three subsections)

```css
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

/* .mn-gallery-count reused from HomeScreen — no duplication */

.mn-umbrella-add-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #9CAF88;               /* C.bar */
  font-family: inherit;
  padding: 2px 0;
  margin-right: auto;           /* visual left in RTL */
}
```

### Sub-area cards

**Empty state rule:** if `children.length === 0 && !showCreateChild`, render only the section header row — no italic placeholder text.

**Card element is `<button>` (not `<div onClick>`)** to avoid the div-as-button anti-pattern. Style reset: `width: 100%; text-align: right; cursor: pointer; background: none; padding: 0; border: none; font-family: inherit`.

**Priority color map** — defined locally in `SubAreasSection.tsx`, not imported from `shared.ts`:
```ts
const PRIORITY_MAP: Record<string, string> = {
  high:   C.low,   // #CC8A6E
  medium: C.mid,   // #EF9F27
  low:    C.bar,   // #9CAF88
}
```

**`formatRelativeHe`**: use the existing helper from `shared.ts` or HomeScreen — do not re-implement.

### Card DOM

```jsx
<button className="mn-umbrella-subarea-card" onClick={() => navigate('umbrella', { umbrellaId: child.id })}>
  <div className="mn-umbrella-subarea-main">
    <div className="mn-umbrella-subarea-icon"
         style={{ background: childColor + '14', borderColor: childColor + '28' }}>
      {child.icon || '🌿'}
    </div>
    <div className="mn-umbrella-subarea-text">
      <p className="mn-umbrella-subarea-name">{child.name}</p>
      <p className="mn-umbrella-subarea-activity">פעילות: {lastActivity(child)}</p>
    </div>
    <div className="mn-umbrella-subarea-right">
      <span className="mn-umbrella-subarea-score"
            style={{ color: child.computedHealthScore !== null ? childColor : C.muted }}>
        {child.computedHealthScore ?? '—'}
      </span>
      {sparkData.length > 0 &&
        <Sparkline data={sparkData} color={childColor} width={52} height={20} />
      }
    </div>
  </div>
  {topTask && (
    <div className="mn-umbrella-task-preview">
      <span className="mn-umbrella-priority-dot" style={{ background: PRIORITY_MAP[topTask.priority] ?? C.muted }} />
      <span className="mn-umbrella-task-title">{topTask.title}</span>
      <button className="mn-umbrella-ask-nefesh"
              onClick={e => { e.stopPropagation(); navigate('chat') }}>
        שאל את Nefesh ←
      </button>
    </div>
  )}
</button>
```

### CSS

```css
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
  width: 38px; height: 38px; border-radius: 12px; border: 1px solid;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}

.mn-umbrella-subarea-text { flex: 1; min-width: 0; }

.mn-umbrella-subarea-name {
  font-size: 14px; font-weight: 700; color: #2C2C2A;
  margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.mn-umbrella-subarea-activity { font-size: 11px; color: rgba(44,44,42,0.52); }

.mn-umbrella-subarea-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }

.mn-umbrella-subarea-score { font-size: 18px; font-weight: 700; line-height: 1; }

.mn-umbrella-task-preview {
  display: flex; align-items: center; gap: 6px; padding: 8px 14px;
  border-top: 1px solid rgba(44,44,42,0.05);
}

.mn-umbrella-priority-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

.mn-umbrella-task-title {
  font-size: 12px; color: #2C2C2A; flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.mn-umbrella-ask-nefesh {
  background: none; border: none; cursor: pointer;
  font-size: 11px; font-weight: 700; color: #6B8E99; font-family: inherit; flex-shrink: 0; padding: 0;
}

.mn-umbrella-create-form {
  background: #FFFFFF; border: 1px solid rgba(44,44,42,0.08); border-radius: 14px; padding: 14px; margin-top: 4px;
}
```

---

## Section 5 — Questions (`QuestionsSection.tsx` + `QuestionForm.tsx`)

### Structural change

**Deleted:** the `regularQs`/`multiQs` filter variables and the entire "per-question trends" JSX block (~85 lines). The separate trends sub-section is gone.

**Added:** inline `renderQRight` helper (module-level function, not inside component) + `qMenuId: string | null` state for the question kebab dropdown.

### `renderQRight` (module-level)

```ts
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
  const sparkData = pts.filter(p => p.value !== null).map(p => Math.round((p.value ?? 0) * 100))
  if (!latest)
    return <div className="mn-umbrella-q-spark-empty"><span className="mn-umbrella-q-no-data">אין תשובות עדיין</span></div>
  const latestNode = (() => {
    if (latest.answerBoolean) {
      const map = { yes: { sym: '✓', col: C.good }, no: { sym: '✗', col: C.low }, partial: { sym: '◐', col: C.mid } }
      const m = map[latest.answerBoolean as keyof typeof map]
      return m ? <span style={{ color: m.col }}>{m.sym}</span> : null
    }
    if (latest.answerScale !== null) return `${latest.answerScale}/${q.scaleMax ?? 5}`
    if (latest.value !== null) return `${Math.round(latest.value * 100)}%`
    return '—'
  })()
  return (
    <div className="mn-umbrella-q-spark-wrap">
      {sparkData.length > 0 && <Sparkline data={sparkData} color={color} width={52} height={22} />}
      <span className="mn-umbrella-q-latest" style={{ color }}>{latestNode}</span>
    </div>
  )
}
```

### Card DOM (display state)

```jsx
<div className="mn-umbrella-q-card" style={{ opacity: q.enabled ? 1 : 0.5 }}>
  <div className="mn-umbrella-q-main">
    <div className="mn-umbrella-q-text-col">
      <p className="mn-umbrella-q-text">{q.text}</p>
      <div className="mn-umbrella-q-pills">
        <span className="mn-umbrella-q-pill">{cadenceLabel(q)}</span>
        {q.answerType !== 'text' && <span className="mn-umbrella-q-pill">{typeAbbrev(q)}</span>}
      </div>
    </div>
    <div className="mn-umbrella-q-right-col">
      {renderQRight(q, questionTrends, multiTrends, color)}
    </div>
    <div className="mn-umbrella-q-kebab-wrap" ref={menuRef}>
      <button className="mn-umbrella-q-kebab"
              onClick={() => setQMenuId(id => id === q.id ? null : q.id)}>⋮</button>
      {qMenuId === q.id && (
        <div className="mn-umbrella-q-menu">
          <button className="mn-umbrella-q-menu-item" onClick={() => startEdit(q)}>עריכה</button>
          <button className="mn-umbrella-q-menu-item danger" onClick={() => setConfirmDeleteId(q.id)}>מחיקה</button>
        </div>
      )}
    </div>
  </div>
</div>
```

**Kebab dropdown close-on-click-outside:** `useEffect` with `document.addEventListener('mousedown', handler)`. Handler checks `!menuRef.current?.contains(event.target)`.

**Dropdown positioning note:** verify `inset-inline-end: 0` (vs `left: 0`) for correct RTL placement — the dropdown must extend *inward* (toward the center of the card), not off the visual right screen edge.

### `QuestionForm.tsx` — token update only

Root element adds `className="mn-umbrella-q-card mn-umbrella-q-edit-card"` so the form inherits card shape. All `T.*` → `C.*` per the mapping table. Focus ring on inputs: `outline: 1.5px solid #9CAF88; outline-offset: 1px`. Cadence-pill color coding removed; all pills use uniform `C.faint`/`C.muted` styling (CADENCE_COLOR import dropped from this file).

### CSS

```css
.mn-umbrella-q-card {
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.08);
  border-radius: 14px;
  overflow: visible;            /* allow kebab dropdown to escape */
  position: relative;
}

.mn-umbrella-q-main { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; }

.mn-umbrella-q-text-col { flex: 1; min-width: 0; }

.mn-umbrella-q-text { font-size: 13px; color: #2C2C2A; line-height: 1.45; margin-bottom: 6px; font-weight: 400; }

.mn-umbrella-q-pills { display: flex; flex-wrap: wrap; gap: 4px; }

.mn-umbrella-q-pill {
  display: inline-block; padding: 2px 8px; border-radius: 20px;
  background: rgba(44,44,42,0.05); color: rgba(44,44,42,0.52);
  font-size: 10px; font-weight: 600;
}

.mn-umbrella-q-right-col { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 60px; }

.mn-umbrella-q-spark-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; }

.mn-umbrella-q-latest { font-size: 12px; font-weight: 700; text-align: center; }

.mn-umbrella-q-spark-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 22px; }

.mn-umbrella-q-no-data { font-size: 10px; color: rgba(44,44,42,0.38); font-style: italic; white-space: nowrap; }

.mn-umbrella-q-text-answer { font-size: 11px; color: rgba(44,44,42,0.52); text-align: center; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mn-umbrella-q-chips { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }

.mn-umbrella-q-chip { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: rgba(44,44,42,0.05); color: rgba(44,44,42,0.52); white-space: nowrap; max-width: 80px; overflow: hidden; text-overflow: ellipsis; }

.mn-umbrella-q-kebab-wrap { position: relative; flex-shrink: 0; }

.mn-umbrella-q-kebab { background: none; border: none; cursor: pointer; padding: 4px 6px; font-size: 18px; color: rgba(44,44,42,0.38); line-height: 1; border-radius: 6px; transition: background 0.12s; }
.mn-umbrella-q-kebab:hover { background: rgba(44,44,42,0.06); }

.mn-umbrella-q-menu {
  position: absolute;
  top: calc(100% + 4px);
  inset-inline-end: 0;          /* RTL-safe: aligns with kebab button, extends inward */
  background: #FFFFFF;
  border: 1px solid rgba(44,44,42,0.12);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(44,44,42,0.12);
  z-index: 20;
  min-width: 100px;
  overflow: hidden;
}

.mn-umbrella-q-menu-item { width: 100%; background: none; border: none; cursor: pointer; padding: 10px 14px; font-family: inherit; font-size: 13px; text-align: right; color: #2C2C2A; display: block; }
.mn-umbrella-q-menu-item:hover { background: rgba(44,44,42,0.04); }
.mn-umbrella-q-menu-item.danger { color: #CC8A6E; }

.mn-umbrella-q-add-btn {
  width: 100%; background: transparent;
  border: 1.5px dashed rgba(44,44,42,0.14);
  border-radius: 14px; padding: 10px 16px;
  color: rgba(44,44,42,0.52); font-size: 13px;
  cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: border-color 0.15s, color 0.15s;
}
.mn-umbrella-q-add-btn:hover { border-color: #9CAF88; color: #9CAF88; }
```

**Button text:** `+ הוספת שאלה` (not "הוסף שאלה").

**Confirm-delete card:** inline replacement, token update only. `C.low + '26'` border, `C.low` fill on confirm button. Not a bottom sheet — lower stakes than umbrella deletion; affordance should stay close to where the user tapped.

---

## Section 6 — Resolutions (`ResolutionsSection.tsx`)

### 6a — Active resolution cards

Card element is `<button>` (not `<div onClick>`). Style reset applied.

**`questionText`:** join against `questions` prop by `r.questionId` if not already on the `ApiResolution` object. No new API call.

**`pctColor`:** `pct >= 70 ? C.good : pct >= 40 ? C.mid : C.low`

```jsx
<button className="mn-umbrella-resolution-card" onClick={() => setDetailResolution(r)}>
  <p className="mn-umbrella-resolution-title">{r.title}</p>
  <p className="mn-umbrella-resolution-question">{questionText}</p>
  <div className="mn-umbrella-resolution-bar-row">
    <span className="mn-umbrella-resolution-pct-pill">{pct}%</span>
    <div className="mn-umbrella-resolution-bar-track">
      <div className="mn-umbrella-resolution-bar-fill" style={{ width: `${pct}%`, background: pctColor }} />
    </div>
  </div>
  <div className="mn-umbrella-resolution-stats">
    <span className="mn-umbrella-resolution-stat">{p.successfulDays}/{p.elapsedDays} ימים</span>
    {streak > 0 && <span className="mn-umbrella-resolution-stat streak">🔥 {streak}</span>}
    {r.successThreshold !== null && <span className="mn-umbrella-resolution-stat threshold">≥{r.successThreshold}</span>}
    <span className="mn-umbrella-resolution-stat remaining">{remainingLabel}</span>
  </div>
</button>
```

**CSS:**
```css
.mn-umbrella-resolution-card {
  width: 100%; background: #FFFFFF; border: 1px solid rgba(44,44,42,0.08);
  border-radius: 14px; padding: 14px 16px; margin-bottom: 8px;
  cursor: pointer; text-align: right; font-family: inherit; transition: box-shadow 0.15s;
}
.mn-umbrella-resolution-card:hover { box-shadow: 0 2px 10px rgba(44,44,42,0.08); }

.mn-umbrella-resolution-title { font-size: 14px; font-weight: 700; color: #2C2C2A; margin-bottom: 3px; line-height: 1.3; }

.mn-umbrella-resolution-question { font-size: 11px; color: rgba(44,44,42,0.52); margin-bottom: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mn-umbrella-resolution-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }

.mn-umbrella-resolution-pct-pill { font-size: 11px; font-weight: 700; color: #2C2C2A; background: rgba(156,175,136,0.12); padding: 2px 7px; border-radius: 20px; flex-shrink: 0; }

.mn-umbrella-resolution-bar-track { flex: 1; height: 8px; background: rgba(44,44,42,0.07); border-radius: 4px; overflow: hidden; }

.mn-umbrella-resolution-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }

.mn-umbrella-resolution-stats { display: flex; align-items: center; gap: 10px; }

.mn-umbrella-resolution-stat { font-size: 11px; color: rgba(44,44,42,0.52); }
.mn-umbrella-resolution-stat.streak { color: #EF9F27; font-weight: 600; }
.mn-umbrella-resolution-stat.threshold { color: rgba(44,44,42,0.42); font-size: 10px; }
.mn-umbrella-resolution-stat.remaining { margin-right: auto; }
```

### 6b — Creation form → bottom sheet

`showAddResolution` controls the sheet (no naming change). Inline form JSX removed. Sheet uses shared `.mn-sheet mn-sheet-tall` classes.

- Toggle buttons (existing vs new question): `C.faint` default → `C.bar` active
- Duration chips: `C.faint` default → `C.line` active (blue-grey, not sage — distinguishes "which mode" vs "which value")
- Save button: `C.bar` fill; disabled state: `C.faint` bg + `C.muted` text
- Cancel: ghost button via `.mn-sheet-btn-ghost`
- Safe-area bottom padding on action row (handled by `.mn-sheet-action-row`)

### 6c — Past resolutions (token update only)

- Toggle header: `C.muted` text, `.mn-gallery-count` for badge
- Row bg: `C.card`, `C.border`, 12px radius, `opacity: 0.75`
- Status badge: "הושלמה" → `C.bar + '22'` bg, `C.bar` text; "ננטשה" → `C.faint` bg, `C.muted` text
- Final score: `C.ink` bold, no color coding

### 6d — Detail bottom sheet (token update + enhancements)

Uses `.mn-sheet mn-sheet-tall` classes. Enhancements:
- Linked question text shown below resolution title in `C.muted` (join against `questions` prop)
- Large pct% in `pctColor` (semantic here — reviewing full progress — unlike the card's neutral pill)
- Stats mini-cards bg: `C.warmBg`; current streak: `C.mid`; longest: `C.line`; total: `C.ink`
- Abandon button: ghost-destructive — `C.low` border + `C.low` text, not fill
- Abandon confirm: inline within same sheet (no nested sheet)

---

## Section 7 — Shared Sheet CSS (used across UmbrellaDetail + ResolutionsSection)

```css
/* ─── Shared bottom sheet ───────────────────────────────────────────────────── */

.mn-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(44,44,42,0.5); z-index: 200;
  display: flex; align-items: flex-end;
}

.mn-sheet {
  width: 100%; max-width: 430px; margin: 0 auto;
  background: #FBF8F1;           /* C.surface */
  border-radius: 20px 20px 0 0;
  display: flex; flex-direction: column;
}

.mn-sheet-short { max-height: 48vh; }
.mn-sheet-tall  { max-height: 78vh; }

.mn-sheet-drag-handle { width: 40px; height: 4px; border-radius: 2px; background: rgba(44,44,42,0.14); margin: 10px auto 6px; flex-shrink: 0; }

.mn-sheet-titlebar { display: flex; align-items: center; justify-content: space-between; padding: 4px 20px 12px; flex-shrink: 0; }

.mn-sheet-title { font-size: 16px; font-weight: 700; color: #2C2C2A; }

.mn-sheet-close-btn { background: none; border: none; cursor: pointer; font-size: 18px; color: rgba(44,44,42,0.52); padding: 4px; line-height: 1; border-radius: 6px; }
.mn-sheet-close-btn:hover { background: rgba(44,44,42,0.06); }
.mn-sheet-close-btn:focus-visible { outline: 1.5px solid #9CAF88; outline-offset: 2px; }

.mn-sheet-body { flex: 1; overflow-y: auto; padding: 0 20px 16px; }

.mn-sheet-field-label { display: block; font-size: 11px; font-weight: 700; color: rgba(44,44,42,0.52); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; margin-top: 14px; }

.mn-sheet-input { width: 100%; background: #FFFFFF; border: 1px solid rgba(44,44,42,0.10); border-radius: 10px; padding: 9px 12px; font-size: 13px; color: #2C2C2A; font-family: inherit; outline: none; box-sizing: border-box; direction: rtl; }
.mn-sheet-input:focus-visible { outline: 1.5px solid #9CAF88; outline-offset: 1px; }

.mn-sheet-toggle-row { display: flex; gap: 8px; margin-bottom: 4px; }

.mn-sheet-toggle { flex: 1; padding: 7px 0; border-radius: 10px; border: none; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; background: rgba(44,44,42,0.05); color: rgba(44,44,42,0.52); transition: background 0.15s, color 0.15s; }
.mn-sheet-toggle.active { background: #9CAF88; color: #ffffff; }

.mn-sheet-chips-row { display: flex; gap: 6px; flex-wrap: wrap; }

.mn-sheet-chip { padding: 5px 12px; border-radius: 20px; border: none; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; background: rgba(44,44,42,0.05); color: rgba(44,44,42,0.52); transition: background 0.15s, color 0.15s; }
.mn-sheet-chip.active { background: #6B8E99; color: #ffffff; }

.mn-sheet-date-range { font-size: 12px; color: rgba(44,44,42,0.52); margin-top: 10px; }

.mn-sheet-action-row { display: flex; gap: 8px; padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 20px); flex-shrink: 0; border-top: 1px solid rgba(44,44,42,0.08); }

.mn-sheet-btn-primary { flex: 1; background: #9CAF88; color: #ffffff; border-radius: 12px; border: none; padding: 12px 0; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
.mn-sheet-btn-primary:disabled { background: rgba(44,44,42,0.07); color: rgba(44,44,42,0.32); cursor: default; }

.mn-sheet-btn-ghost { flex: 1; background: none; color: rgba(44,44,42,0.52); border-radius: 12px; border: 1px solid rgba(44,44,42,0.10); padding: 12px 0; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
```

---

## Behavior Changes Summary

| Change | Was | Is now | Approved? |
|---|---|---|---|
| Rename/icon edit | Inline header morph | Bottom sheet (`.mn-sheet-short`) | Yes |
| Resolution creation | Inline section expansion | Bottom sheet (`.mn-sheet-tall`) | Yes |
| Question edit/delete | Text buttons on each card | Kebab (⋮) → inline dropdown | Yes |
| Sub-area card element | `<div onClick>` | `<button>` | Yes (a11y) |
| Resolution card element | `<div onClick>` | `<button>` | Yes (a11y) |
| Per-question trends section | Separate sub-section below questions | Integrated into each question card | Yes |
| Sub-area empty state | Italic placeholder text | No empty text (header + affordance only) | Yes |
| Cadence pill colors | Color-coded by cadence | Uniform `C.faint`/`C.muted` | Yes |

---

## What Does Not Change

- Server routes, API contracts, database schema
- Interview composer, scheduler, analytics layer, resolutions backend
- `Sparkline`, `Ring`, `ComboChart`, `Icon` component implementations
- `shared.ts` (constants and helpers)
- `lib/theme.ts` (old T.* theme, kept for other components)
- Any screen other than UmbrellaDetail and its subcomponents
