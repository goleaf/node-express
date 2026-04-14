# Node + Express Task Management App

Task management app implemented with vanilla Node.js + Express and no database.

## Features

- Create task with:
  - title
  - description
  - due date
  - priority (`low`, `medium`, `high`, `urgent`)
  - category
  - tags (comma-separated input)
- Categories CRUD screen with color and icon fields
- Smart lists: All Tasks, Today, Starred, Completed, Trash
- Tag cloud with clickable filters
- Due date grouping (Overdue / Today / This Week / Later)
- Priority chips using material-style semantic token colors
- Edit task inline directly in the list or via bottom-sheet modal
- Toggle completed state with optimistic UI updates
- Star/unstar tasks
- Starred smart list
- Subtasks per task with independent completion
- Subtask progress bar shown on every task card
- Soft delete (move to trash) and restore within 30 days
- Hard delete from trash
- Duplicate tasks (including subtasks)
- Drag-and-drop reordering (task cards persist order)
- Bulk actions:
  - complete
  - mark incomplete
  - soft delete
  - set category
- Full-text search across task title and description with highlighted matches
- Advanced filtering by:
  - smart list (`all`, `today`, `starred`, `completed`, `trash`)
  - status (open / done)
  - priority
  - category
  - tag
  - due date range
- Preset management:
  - save current filter configuration with a name
  - list saved presets
  - apply preset
  - delete preset
- Sort options:
  - manual (drag and drop order)
  - due date
  - created date
  - priority
  - alphabetical
- Search and filters can be used together and are preserved through sorting/presets
- Per-task reminder picker (`datetime-local`) stored on each task
- In-app notification center with:
  - unread badge
  - due-soon, overdue, reminder and system notification types
  - mark all as read
  - mark individual notifications read/unread
  - type visibility + quiet-hours preferences
- Soft delete retention window (30 days) before hard purge
- Dashboard statistics:
  - completion rate tiles for today / this week / this month
  - tasks by priority bar chart
  - consecutive completion streak counter
  - overdue count with urgency bands
  - productivity heatmap by day of week
  - recent activity feed

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The file store lives at `data/todos.json`.

The stylesheet is a lightweight token-based theme system inspired by the Sheaf UI direction (light/dark modes and semantic color tokens).

## Endpoints

- `GET /` — main UI
- `GET /dashboard` — dashboard metrics
- `GET /trash` — trash UI (recover / hard delete)
- `GET /categories` — category management screen
- `GET /notifications` — notification center
- `GET /settings` — appearance, defaults, preferences, export, danger actions
- `GET /api/todos?includeDeleted=true|false` — list tasks (`false` default)
- `GET /api/todos?smart=all|today|starred|completed|trash` — smart list filtering
- `GET /api/todos/:id` — get task JSON
- `GET /api/notifications` — notification center JSON with visible notifications, prefs and unread count
- `POST /todos` — create task (form)
- `POST /notifications/:id/read` — mark notification read/unread
- `POST /notifications/read-all` — mark all notifications read
- `POST /notifications/preferences` — update notification preferences
- `POST /settings` — update theme, defaults, and notification settings
- `GET /settings/export?format=json|csv` — download all active tasks as JSON/CSV
- `POST /settings/account/delete` — reset all local data (delete account)
- `POST /settings/onboarding/reset` — reset onboarding state
- `POST /todos/:id/edit` — update task from UI (form)
- `POST /todos/:id/delete` — move task to trash
- `POST /todos/:id/recover` — recover trashed task
- `POST /todos/:id/hard-delete` — permanently delete task
- `POST /todos/:id/duplicate` — duplicate task
- `POST /todos/reorder` — save drag-and-drop order (`{ order: [id,...] }`)
- `POST /todos/bulk` — bulk actions with form
- `POST /categories` — create category
- `POST /categories/:id/edit` — update category
- `POST /categories/:id/delete` — delete category
- `POST /todos/:id/subtasks` — add subtask
- `POST /todos/:id/subtasks/:subtaskId/delete` — delete subtask
- `PATCH /api/todos/:id` — partial task update (`title`, `description`, `dueAt`, `priority`, `category`, `tags`, `completed`)
- `PATCH /api/todos/:id/subtasks/:subtaskId` — update subtask
- `DELETE /api/todos/:id/subtasks/:subtaskId` — delete subtask
- `DELETE /api/todos/:id` — hard delete task
- `POST /presets` — save current filter set as preset
- `POST /presets/:id/delete` — remove preset

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## API

- `GET /api/todos` — list todos
- `GET /api/todos/:id` — get one todo
- `PATCH /api/todos/:id` — partial JSON update (including `starred`, `categoryId`)
- `DELETE /api/todos/:id` — hard delete via API
- `PATCH /api/todos/:id/subtasks/:subtaskId` — update subtask
- `DELETE /api/todos/:id/subtasks/:subtaskId` — delete subtask
