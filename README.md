# Next Action Steps

Build a multi-user web app called "Next Action", connected to my existing Supabase project. Do NOT create or change tables. Use Supabase Auth with email + password; each user sees only their own data. Onboarding wizard (when the user has no user_settings row): 1) consent checkbox, save consent_given_at; 2) role template: Job seeker (Applications & recruiter actions / Skills & portfolio, 70/30, career and income), Freelancer/Agency (Client delivery / Business building, 80/20, revenue and client deadlines), Student/Learner (Assignments & exams / Deep learning & projects, 60/40, grades and skill growth), Founder/Creator (Revenue-critical / Product & growth, 60/40, revenue and traction), Custom; 3) edit labels, split, value_label, priority_notes, coaching_tone, reply_language, timezone; 4) add 3–5 projects. Save a user_settings row. Settings page: edit every user_settings field; a "Delete all my data" button with confirmation. Today page: active project cards sorted by deadline (name, goal, days left in red if ≤ 2, category badge, value, blocker, next likely action, last worked) and a bar showing the user's own split and category names.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nextaction-app.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/20bace35-2d94-49b7-9f01-bf95e4a58037).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
