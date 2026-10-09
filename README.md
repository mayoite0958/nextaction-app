# Next Action – AI execution coach

> **© 2026 Kushagra Kala. All rights reserved.**
> This repository is shared publicly for review as part of the **100xEngineers Cohort 7 capstone**. No licence is granted: you may not copy, modify, distribute, or use this code or these workflows, in whole or in part, without the author's written permission.

**Stop deciding, start doing.** Next Action is an AI coach for people juggling several projects. It looks at your projects, deadlines, progress, and the time and energy you have right now, and gives you **one clear next step with the reason**. When you start, everything you need is already there: where you stopped last time, and the videos, posts and links you saved that help with exactly this step.

| | |
|---|---|
| 🌐 **Live app** | https://nextaction-app.lovable.app |
| 📝 **Case study** | https://medium.com/@mayoite0958/stop-deciding-start-doing-an-ai-that-picks-your-next-task-6d6ba5c208e6 |
| 🎬 **Demo video** | _add link_ |

---

## Why it exists

People running 3–7 projects lose more time **deciding** and **restarting** than working:

- The first minutes of every session go to "what should I do now?", and the easy task usually wins.
- Coming back after a few days means rebuilding where you stopped.
- The tutorial that solves today's blocker is buried in hundreds of saved reels and bookmarks.

Next Action takes the daily decision off your plate and hands you what you need to act on it.

## Key features

- **Next action in seconds:** time + energy aware; weighs deadlines, progress, importance and balance across life areas; always explains *why*.
- **Recap cards:** return to any project and see where you stopped, plus a 2-minute first step.
- **Saved help at the right moment:** a *Handy for this task* panel shows the 2–3 saved resources that fit the current step; tapping *I'm stuck* searches again.
- **One-tap capture:** save from Instagram, YouTube, LinkedIn or the web via the iPhone share sheet, the Android share menu or a browser bookmark; AI classifies each item and files it under the right project.
- **Low-friction tracking:** one-tap session endings, focus check-ins, detours, and voice notes.
- **WhatsApp coach:** `PLAN` returns today's focus; send a note after a session, and the AI drafts the update for you to confirm with `YES`.
- **AI weekly review:** wins, stuck points, patterns and suggested priority changes.
- **Privacy by design:** per-user data isolation, consent at sign-up, and "delete all my data".

## Architecture
iPhone share sheet ─┐
Android share menu ─┤
Laptop bookmark ────┼──▶ n8n workflows ──prompts──▶ Google Gemini (AI)
WhatsApp bot ───────┤ │
Web app (Lovable) ──┘ ▼ queries
└──────────────▶ Supabase (Postgres + Auth + row-level security)


- **AI runs only inside n8n**, so API keys never reach the browser.
- **Rules shortlist, the AI decides, the human approves:** projects are scored by clear rules (deadlines, category balance, progress, staleness), Gemini picks the step, and nothing in a project changes until the user confirms.

## Tech stack

| Layer | Tool |
|---|---|
| Web app | Lovable (React, TanStack Start, Tailwind), installable on Android with a share target |
| Database & auth | Supabase (Postgres, Auth, row-level security) |
| Automation | n8n Cloud |
| AI | Google Gemini Flash (with retries and a fallback model); Lovable AI Gateway for the weekly review |
| Capture | iOS Shortcut, Android Web Share Target, browser bookmarklet |
| Messaging | Meta WhatsApp Cloud API |

## Repository structure
├── src/ Web app source (pages, components, Supabase client, n8n calls)
├── public/ Static assets and PWA files
├── supabase/ Supabase project config
└── n8n-workflows/ Exported n8n workflows (credentials not included)

## n8n workflows

| Workflow | What it does |
|---|---|
| `recommend` | Ranks projects and asks Gemini for the next step, task and matching resources |
| `end-session` | Updates project memory, notes and follow-up tasks after a session |
| `plan-project` | Generates a done definition, milestones and first tasks from a description |
| `add-resource` | Classifies a link saved in the web app and links it to a project |
| `share-capture` | Saves links shared from iPhone, Android or the laptop bookmark using a private per-user key |
| `match-resources` | Finds the saved resources most useful for the current task, or for what you're stuck on |
| `whatsapp-in` | WhatsApp bot: `PLAN`, progress note → AI draft → `YES` to save |

Credentials (Supabase, Gemini, WhatsApp) are **not** included in the exported workflows.

## Status and roadmap

**Status:** working pilot (capstone). WhatsApp runs on Meta's test number for invited testers.

**Next:** verified WhatsApp business number with a daily morning plan, calendar sync for deadlines and free time, an "autopilot" desktop companion that drafts updates for one-tap approval, and semantic search across large resource libraries.

## Author

**Kushagra Kala**: product, design, AI workflows and integrations.
Built for the **100xEngineers Cohort 7** capstone. #0to100xEngineer

---

**© 2026 Kushagra Kala. All rights reserved.** Viewing this repository does not grant any right to copy, modify, distribute, or use its contents. For permission requests, contact the author.
