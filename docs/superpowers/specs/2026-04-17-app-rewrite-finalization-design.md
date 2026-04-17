# App Rewrite Finalization Design

## Goal

Finalize the remaining dirty worktree as one coherent application rewrite commit, without inventing new scope beyond what is already implemented and verified locally.

## Context

The repository still contains a large set of coordinated source changes after the repo-coherence cleanup commit:

- modular Express app bootstrap in `src/app.js`
- SQLite-backed persistence, migrations, and session storage
- separated actions, models, requests, middleware, and route modules
- authentication and password reset flows
- onboarding, profile, notifications, categories, tags, search, dashboard, and task/subtask flows
- Vite-powered client bundle with modular browser-side components
- Jest coverage for the current route and component surface

This body of work behaves like a single rewrite rather than unrelated scraps. Current verification already shows the suite and build passing.

## Scope

- Normalize the current mixed staged/unstaged source tree into one commit for the remaining rewrite
- Keep ignored runtime artifacts out of source control
- Re-run verification immediately before the commit
- Commit the rewrite as one feature commit

## Non-Goals

- No additional feature expansion beyond the current source tree
- No attempt to split the rewrite into multiple historical commits
- No cleanup of generated runtime files already covered by the prior coherence cleanup commit

## Approaches Considered

### 1. One Rewrite Commit

Stage the remaining source changes together, verify, and commit them once.

Pros:
- lowest risk in a dirty mixed-index tree
- matches the current shape of the work
- avoids accidental partial commits across tightly coupled modules

Cons:
- large commit

### 2. Split Into Multiple Commits

Try to separate infrastructure, backend, UI, and tests into smaller commits.

Pros:
- cleaner history on paper

Cons:
- high risk of slicing coupled changes incorrectly
- likely to leave the app broken between commits
- expensive to execute safely in the current worktree

### 3. Keep Auditing Indefinitely

Continue reviewing for hidden gaps before committing anything.

Pros:
- reduces confidence risk slightly

Cons:
- delays shipping despite passing verification
- produces little value if no failing evidence appears

## Decision

Use Approach 1. The remaining work should be finalized as one cohesive rewrite commit after fresh verification.

## Execution Plan

1. Stage the remaining tracked and untracked source files that belong to the rewrite
2. Keep ignored runtime/build outputs excluded
3. Run:
   - `npm test`
   - `npm run build`
4. If verification stays green, create one commit for the rewrite

## Risks

- The commit will be large, so commit messaging needs to be explicit
- If any currently passing behavior depends on untracked local state, verification could expose that during final staging
- Because the tree replaces older monolithic structure with modules, any partial commit would be more dangerous than a single coherent one
