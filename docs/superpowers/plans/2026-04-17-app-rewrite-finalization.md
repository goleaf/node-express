# App Rewrite Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the remaining SQLite/Vite app rewrite as one coherent commit after fresh verification.

**Architecture:** The rewrite already exists in the working tree as a coordinated replacement of the old monolithic app. The execution work is to normalize the mixed staged/unstaged tree, verify the whole application, and commit the remaining rewrite as one feature commit while keeping ignored runtime artifacts out of source control.

**Tech Stack:** Node.js, Express, better-sqlite3, EJS, Vite, Jest

---

### Task 1: Stage The Remaining Rewrite Tree

**Files:**
- Modify: `client/src/main.js`, `client/src/styles/main.css`
- Create/Modify: `client/src/components/BottomNav.js`, `client/src/components/BottomSheet.js`, `client/src/components/CategoryManager.js`, `client/src/components/EmptyState.js`, `client/src/components/Haptics.js`, `client/src/components/MultiSelect.js`, `client/src/components/NotificationBell.js`, `client/src/components/OfflineBanner.js`, `client/src/components/OnboardingFlow.js`, `client/src/components/PageTransition.js`, `client/src/components/Search.js`, `client/src/components/SwipeGesture.js`, `client/src/components/TaskDetail.js`, `client/src/components/TaskForm.js`, `client/src/components/TaskList.js`, `client/src/components/ThemeSwitcher.js`, `client/src/components/Toast.js`, `client/src/components/toastHelpers.js`
- Modify/Create: `package.json`, `package-lock.json`, `postcss.config.js`, `jest.config.js`, `tailwind.config.js`, `vite.config.js`, `public/favicon.ico`
- Create/Modify: `src/app.js`, `src/index.js`, `src/config/BetterSqliteSessionStore.js`, `src/config/database.js`, `src/config/mail.js`, `src/config/multer.js`, `src/config/session.js`
- Create/Modify: `src/db/migrate.js`, `src/db/schema.sql`, `src/db/migrations/001_initial_schema.js`, `src/db/migrations/002_add_soft_deletes.js`, `src/db/migrations/003_add_onboarding.js`, `src/db/migrations/004_add_password_resets.js`, `src/db/migrations/005_add_task_completion_timestamp.js`, `src/db/migrations/006_add_user_default_preferences.js`
- Create/Modify: `src/errors/ValidationError.js`, `src/middleware/auth.js`, `src/middleware/csrf.js`, `src/middleware/errorHandler.js`, `src/middleware/notFound.js`, `src/middleware/requestLogger.js`, `src/middleware/validateIntegerParam.js`
- Create/Modify: `src/models/CategoryModel.js`, `src/models/NotificationModel.js`, `src/models/SubtaskModel.js`, `src/models/TagModel.js`, `src/models/TaskModel.js`, `src/models/UserModel.js`, `src/models/modelHelpers.js`
- Create/Modify: `src/actions/TrackEventAction.js`, `src/actions/auth/LoginUserAction.js`, `src/actions/auth/LogoutUserAction.js`, `src/actions/auth/RegisterUserAction.js`, `src/actions/auth/ResetPasswordAction.js`, `src/actions/auth/SendPasswordResetAction.js`, `src/actions/categories/CreateCategoryAction.js`, `src/actions/categories/DeleteCategoryAction.js`, `src/actions/categories/UpdateCategoryAction.js`, `src/actions/notifications/CreateNotificationAction.js`, `src/actions/notifications/notificationStreams.js`, `src/actions/onboarding/CompleteOnboardingAction.js`, `src/actions/profile/DeleteAccountAction.js`, `src/actions/profile/UpdatePasswordAction.js`, `src/actions/profile/UpdatePreferencesAction.js`, `src/actions/profile/UpdateProfileAction.js`, `src/actions/subtasks/CreateSubtaskAction.js`, `src/actions/subtasks/DeleteSubtaskAction.js`, `src/actions/subtasks/ReorderSubtasksAction.js`, `src/actions/subtasks/ToggleSubtaskAction.js`, `src/actions/subtasks/UpdateSubtaskAction.js`, `src/actions/tags/CreateTagAction.js`, `src/actions/tags/DeleteTagAction.js`, `src/actions/tags/UpdateTagAction.js`, `src/actions/tasks/BulkTaskAction.js`, `src/actions/tasks/CancelTaskReminderAction.js`, `src/actions/tasks/CompleteTaskAction.js`, `src/actions/tasks/CreateTaskAction.js`, `src/actions/tasks/DeleteTaskAction.js`, `src/actions/tasks/GetTaskStatisticsAction.js`, `src/actions/tasks/ReorderTasksAction.js`, `src/actions/tasks/RestoreTaskAction.js`, `src/actions/tasks/SearchTasksAction.js`, `src/actions/tasks/SetTaskReminderAction.js`, `src/actions/tasks/UpdateTaskAction.js`, `src/actions/tasks/taskReminderRegistry.js`
- Create/Modify: `src/requests/auth/validateForgotPassword.js`, `src/requests/auth/validateLogin.js`, `src/requests/auth/validateRegister.js`, `src/requests/auth/validateResetPassword.js`, `src/requests/categories/validateCreateCategory.js`, `src/requests/categories/validateDeleteCategory.js`, `src/requests/categories/validateUpdateCategory.js`, `src/requests/handleValidationErrors.js`, `src/requests/profile/validateUpdatePassword.js`, `src/requests/profile/validateUpdatePreferences.js`, `src/requests/profile/validateUpdateProfile.js`, `src/requests/subtasks/validateCreateSubtask.js`, `src/requests/subtasks/validateReorderSubtasks.js`, `src/requests/subtasks/validateUpdateSubtask.js`, `src/requests/tags/validateCreateTag.js`, `src/requests/tags/validateUpdateTag.js`, `src/requests/tasks/taskValidationHelpers.js`, `src/requests/tasks/validateBulkAction.js`, `src/requests/tasks/validateCreateTask.js`, `src/requests/tasks/validateReorderTasks.js`, `src/requests/tasks/validateSearchTasks.js`, `src/requests/tasks/validateUpdateTask.js`
- Create/Modify/Delete: `src/routes/apiTasks.js`, `src/routes/auth.js`, `src/routes/categories.js`, `src/routes/createPlaceholderRouter.js`, `src/routes/dashboard.js`, `src/routes/notifications.js`, `src/routes/onboarding.js`, `src/routes/profile.js`, `src/routes/search.js`, `src/routes/subtasks.js`, `src/routes/tags.js`, `src/routes/tasks.js`
- Create/Modify/Delete: `src/views/auth/forgot-password.ejs`, `src/views/auth/login.ejs`, `src/views/auth/logout.ejs`, `src/views/auth/register.ejs`, `src/views/auth/reset-password.ejs`, `src/views/categories/index.ejs`, `src/views/dashboard/index.ejs`, `src/views/errors/403.ejs`, `src/views/errors/404.ejs`, `src/views/errors/error.ejs`, `src/views/layouts/mobile.ejs`, `src/views/onboarding/step1.ejs`, `src/views/onboarding/step2.ejs`, `src/views/onboarding/step3.ejs`, `src/views/pages/placeholder.ejs`, `src/views/partials/bottom-nav.ejs`, `src/views/partials/empty-notifications.ejs`, `src/views/partials/empty-search.ejs`, `src/views/partials/empty-tasks.ejs`, `src/views/partials/fab.ejs`, `src/views/partials/theme-bootstrap.ejs`, `src/views/partials/toast-container.ejs`, `src/views/partials/top-app-bar.ejs`, `src/views/profile/index.ejs`, `src/views/search/index.ejs`, `src/views/tasks/form.ejs`, `src/views/tasks/index.ejs`, `src/views/tasks/show.ejs`
- Test: `tests/actions/CreateTaskAction.test.js`, `tests/components/TaskList.test.js`, `tests/config/BetterSqliteSessionStore.test.js`, `tests/middleware/auth.test.js`, `tests/requests/validateCreateTask.test.js`, `tests/routes/auth.test.js`, `tests/routes/listsAndProfile.test.js`, `tests/routes/onboarding.test.js`, `tests/routes/protectedApp.test.js`, `tests/routes/security.test.js`, `tests/routes/taskMutations.test.js`, `tests/setupEnv.js`, `tests/utils/viteAssets.test.js`, `tests/views/errorViews.test.js`

- [ ] **Step 1: Refresh the view of the remaining rewrite**

Run:

```bash
git status --short
```

Expected: many remaining source changes under `client/`, `src/`, `tests/`, and package config files, with ignored runtime artifacts absent from the normal status output.

- [ ] **Step 2: Stage the full remaining rewrite tree**

Run:

```bash
git add client src tests package.json package-lock.json postcss.config.js jest.config.js tailwind.config.js vite.config.js public/favicon.ico
```

Expected: the rewrite files move to staged state, while ignored runtime outputs such as `public/dist/` remain excluded.

- [ ] **Step 3: Confirm the staged tree contains the rewrite**

Run:

```bash
git diff --cached --stat
```

Expected: staged diff shows the modular app rewrite across routes, actions, models, requests, client components, config, and tests.

### Task 2: Verify The Full Rewrite

**Files:**
- Verify only: entire staged rewrite from Task 1

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS with `13 passed, 13 total` test suites and `36 passed, 36 total` tests.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds and writes `public/dist/manifest.json` plus hashed asset files.

- [ ] **Step 3: Confirm generated outputs stay ignored**

Run:

```bash
git status --short --ignored public/dist database .playwright-mcp prod-asset-requests.txt prod-clean-requests.txt
```

Expected: `public/dist/` appears as ignored with `!! public/dist/` and no runtime database files are staged.

### Task 3: Commit The Rewrite

**Files:**
- Commit: all staged rewrite files from Task 1

- [ ] **Step 1: Review the staged filenames once before commit**

Run:

```bash
git diff --cached --name-status
```

Expected: only the intended rewrite files are staged, with no ignored runtime artifacts included.

- [ ] **Step 2: Create the rewrite commit**

Run:

```bash
git commit -m "feat: replace monolith with sqlite task app"
```

Expected: git writes one feature commit covering the remaining rewrite.

- [ ] **Step 3: Verify post-commit status**

Run:

```bash
git status --short
```

Expected: the rewrite files are no longer pending, and only any truly unrelated leftovers remain.
