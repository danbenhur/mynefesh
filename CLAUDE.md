# MyNefesh — CLAUDE.md

> This file is the authoritative briefing for every Claude Code session.
> Read it fully before touching any code.

---

## Vision

MyNefesh is a personal life-management system — a 24/7 loyal AI secretary that knows Dan deeply, tracks every area of his life, and proactively surfaces what matters before he has to ask.

The core promise: **a clear, real-time picture of where Dan stands across every life domain, with visible, granular improvement over time.**

This is not a todo app. It is not a journal. It is an intelligent, proactive life companion built around Dan's personal structure of life ("Umbrellas").

---

## The User

**Dan** — one user, deeply personal. This is not a generic SaaS tool.
- Married, 11 children, lives in Kfar Chabad, Israel
- Front-end developer (React/TypeScript), musician, Chassidus teacher
- Overloaded with obligations, dreams, relationships, and responsibilities across many life domains
- Needs proactive intelligence, not reactive lookup

---

## Core Concept: Umbrellas

Life is organized into **Umbrellas** — areas of Dan's life. Umbrellas are hierarchical (parent → child).

Top-level umbrellas (current):
- 👨‍👩‍👧‍👦 **People** (relationships — wife, kids, friends, community)
- 💰 **Money** (income, expenses, investments, projects)
- 🧒 **Kids** (each child can be a sub-umbrella)
- 🕍 **Spirituality** (Chassidus, davening, learning, mission)
- 💪 **Health** (exercise, bloodwork, nutrition, sleep)

Each umbrella has:
- A status / health score
- Associated tasks, reminders, notes
- History and trend data
- Sub-umbrellas (recursive)

---

## Product Behavior

### Proactive Intelligence
MyNefesh does NOT wait to be asked. It pushes:
- Time-sensitive reminders ("Your wife's birthday is in 4 weeks — let's plan something")
- Relationship prompts ("Your son had a test — ask him how it went")
- Action nudges ("City bills are due — should I handle it?")
- Health triggers ("You haven't done your annual blood test — let's schedule it")

### Daily Interview
MyNefesh periodically interviews Dan to stay current:
- Asks structured questions per umbrella
- Updates its knowledge base from his answers
- Generates insights and flags gaps

### Dashboard
- Overview of all umbrellas with health indicators
- Stats, graphs, trend lines per umbrella
- Quick-access chat interface

### Chat Interface
- Dan can initiate any conversation
- MyNefesh can push prompts when the app is opened
- Push notifications for time-sensitive items

---

## Data Model (Conceptual)

```
Umbrella
  ├── id, name, icon, parentId
  ├── healthScore (0–100)
  ├── notes[]
  ├── tasks[]
  ├── reminders[]
  ├── children: Umbrella[]
  └── history: HealthSnapshot[]

Person (sub-type of Umbrella item)
  ├── name, relationship, birthday
  ├── lastContact
  ├── notes[]
  └── upcomingEvents[]

Task
  ├── title, umbrellaId
  ├── dueDate, priority
  └── status

Reminder
  ├── message, triggerDate
  ├── umbrellaId
  └── isRecurring
```

---

## Stack (TBD — to be decided with Dan)

Stack is not yet locked. When deciding, prefer:
- React + TypeScript (Dan's expertise)
- Mobile-first (Dan uses phone heavily)
- Local-first storage where possible (Dan wants data on his PC)
- AI integration via Anthropic API (Claude as the intelligence layer)
- Simple, fast, no unnecessary complexity

Do NOT introduce new tech without discussing with Dan first.

---

## Architecture Principles

1. **Local-first** — Dan's data stays on his machine. No cloud dependency unless explicitly chosen.
2. **AI-native** — Claude is the brain. Not a bolt-on feature.
3. **Single user** — no auth complexity, no multi-tenancy.
4. **Proactive > reactive** — the system should push, not wait.
5. **Simplicity over cleverness** — readable code, minimal abstractions.

---

## Working Style — Dan's Rules

- Dan is a React/TypeScript developer — use patterns he already knows
- Speed over perfection — ship working things, iterate
- Ask before making architectural decisions
- Keep components small and focused
- No unnecessary libraries — justify every dependency
- Comments in English
- When stuck, explain the problem clearly and offer 2–3 options with tradeoffs

---

## Current State

🔴 **Not started** — project folder does not exist yet.

Next step: scaffold the project, decide stack, build the first screen (Dashboard with Umbrellas overview).

---

## Active Sprint

- [ ] Decide stack (React Native vs web app vs Electron)
- [ ] Scaffold project
- [ ] Build Umbrella data model
- [ ] Build Dashboard screen (umbrella cards with health scores)
- [ ] Build basic Chat interface

---

## Notes for Claude

- Always refer to the user as **Dan**
- This is a deeply personal product — treat it with care
- When adding features, ask: "does this make Dan's life simpler or more complex?"
- The north star: Dan opens MyNefesh and immediately feels clarity and calm
