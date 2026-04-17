# Node + Express Task Management App

SQLite-backed task management app built with Express, EJS, and a Vite-powered client bundle.

## Current Feature Set

- Email/password authentication with registration, logout, and password reset flows
- Guided onboarding for first-time users
- Dashboard with task summary metrics, category breakdown, daily completions, and due-today tasks
- Task CRUD with priority, status, due date, reminder timestamp, categories, and tags
- Subtasks with create, edit, toggle, reorder, and delete flows
- Bulk task actions for complete, delete, and restore
- Full-page search with status, priority, category, tag, and date-range filters
- Categories and tags management
- Notification feed with unread counts, mark-all-read, and server-sent event streaming
- Profile management with avatar upload, password updates, and preference updates
- Automatic SQLite schema bootstrap and migrations on app startup

## Scripts

```bash
npm install
npm run dev
```

Development mode starts:

- the Express app on `http://localhost:3000`
- the Vite dev server on `http://localhost:5173`

Additional commands:

```bash
npm test
npm run build
npm start
```

Use `npm run build` before `npm start` for a production-style run.

## Persistence

- Application data lives in SQLite at `database/todo.sqlite`
- Schema bootstrap happens from `src/db/schema.sql`
- Migrations run automatically from `src/db/migrations/`
- Session data is stored in SQLite through the custom `BetterSqliteSessionStore`

The SQLite database file and Vite build output are local runtime artifacts and are intentionally ignored by git.

## Environment Notes

- `SESSION_SECRET` overrides the development session secret
- `DATABASE_PATH` overrides the default SQLite path
- `VITE_DEV_SERVER_ORIGIN` overrides the default dev asset origin
- If `SMTP_HOST` is unset, password reset emails use Nodemailer's JSON transport

## Route Surface

Main UI routes:

- `GET /` redirects to `/dashboard`
- `GET /dashboard`
- `GET /tasks`
- `GET /tasks/new`
- `GET /tasks/:id`
- `GET /tasks/:id/edit`
- `GET /search`
- `GET /categories`
- `GET /profile`
- `GET /auth/login`
- `GET /auth/register`
- `GET /auth/forgot-password`
- `GET /auth/reset-password`
- `GET /onboarding`

JSON and action routes:

- `/api/tasks`
- `/subtasks`
- `/categories`
- `/tags`
- `/notifications`
- `/profile/preferences`

See `src/routes/` for the full route definitions and supported HTTP methods.

## Repository Hygiene

This repository no longer uses the legacy JSON file store. If you have stale local artifacts from older runs, remove them and restart the app:

```bash
rm -f data/todos.json
rm -f database/*.sqlite*
rm -rf public/dist .playwright-mcp
```
