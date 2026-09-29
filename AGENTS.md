<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- Data access runs through the browser Supabase client with RLS (no server functions): every table is user-scoped by `auth.uid()`, so the client is already the safe path.
- Signed-in pages live under `src/routes/_authenticated/`; `/` and `/auth` are public.
- Role templates, timezone list and date helpers live in `src/lib/nextaction.ts` so onboarding and settings stay in sync.
- Never create or alter database tables in this project; the schema is owned by the user.
