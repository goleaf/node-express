# Repo Coherence Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the repository with the current SQLite-based Express app and remove stale runtime/build artifacts from source control.

**Architecture:** Keep application behavior intact and focus on repository hygiene. Update documentation to match the real route surface, add ignore rules for generated/runtime files, and remove legacy/generated files from the tracked tree.

**Tech Stack:** Node.js, Express, better-sqlite3, EJS, Vite, Jest

---

### Task 1: Document The Real App

**Files:**
- Modify: `README.md`

- [ ] Replace the legacy JSON-store README content with an accurate summary of the current app surface.
- [ ] Document development, test, build, and production-start commands.
- [ ] Document SQLite storage and the current route families only.

### Task 2: Ignore Local Runtime And Build Outputs

**Files:**
- Modify: `.gitignore`

- [ ] Add ignore rules for SQLite runtime files, Vite build output, Playwright artifacts, and local verification logs.
- [ ] Remove the obsolete `data/todos.json` ignore entry because the legacy JSON store is no longer part of the app contract.

### Task 3: Remove Tracked Generated And Legacy Files

**Files:**
- Remove from repo/index: `public/dist/**`
- Remove from repo/index: `database/*.sqlite*`
- Remove from workspace: `data/todos.json`, `.playwright-mcp/`, `prod-asset-requests.txt`, `prod-clean-requests.txt`

- [ ] Untrack generated Vite assets from git.
- [ ] Untrack runtime SQLite database files from git.
- [ ] Delete stale local artifacts that should not live in the repository.

### Task 4: Verify No Behavioral Regression

**Files:**
- Verify only

- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Confirm generated outputs stay ignored after verification.
