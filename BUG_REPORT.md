# Bug Report

Found by writing unit tests (`tests/unit/taskService.test.js`) and integration tests (`tests/integration/tasks.test.js`) that assert how the API *should* behave, then reading the failures back to the code.

- First test run: **15 failed, 38 passed** (53 tests)
- After fixing bug 1: **9 failed, 44 passed** (53 tests)
- After adding the `assign` endpoint tests: **9 failed, 54 passed** (63 tests). The 9 failures are the unfixed bugs below.

| # | Bug | Location | Status |
|---|-----|----------|--------|
| 1 | Pagination skips the first page | `taskService.js` `getPaginated` | Fixed |
| 2 | Status filter matches substrings | `taskService.js` `getByStatus` | Not fixed |
| 3 | Completing a task resets its priority | `taskService.js` `completeTask` | Not fixed |
| 4 | PUT can overwrite `id` and `createdAt` | `taskService.js` `update` | Not fixed |
| 5 | Status filter ignores pagination | `routes/tasks.js` `GET /` | Not fixed |
| 6 | Empty-string `status` passes validation | `validators.js` | Not fixed |
| 7 | Malformed JSON returns 500 instead of 400 | `app.js` error handler | Not fixed |

---

## 1. Pagination skips the first page (FIXED)

- **Where:** `src/services/taskService.js`, `getPaginated`
- **Expected:** `GET /tasks?page=1&limit=2` returns the first two tasks.
- **Actual:** It returns tasks 3 and 4. Page 2 returns only task 5, and page 3 returns `[]`. Even `page=1&limit=50` on 5 tasks returns `[]`.
- **Why it happens:** The offset was `page * limit`. The route treats `page` as 1-based (`parseInt(page) || 1`), but the offset formula is only correct for 0-based pages, so page 1 skips the first `limit` tasks and they can never be reached.
- **How I found it:** Failing tests "page 1 returns the first items", "page 2 returns the next items", "last page can be partial" and "limit larger than total returns everything on page 1" (unit), plus the two matching integration tests.
- **Fix (applied):** `const offset = (page - 1) * limit;`
- **Note:** The unit test "page past the end returns empty array" passed even with the bug, because the shifted offset also lands past the end. A passing test can hide a bug when it asserts something the bug happens to satisfy.

## 2. Status filter matches substrings (NOT FIXED)

- **Where:** `src/services/taskService.js`, `getByStatus`
- **Expected:** `GET /tasks?status=todo` returns only tasks whose status is exactly `todo`, and an unknown or partial status returns nothing.
- **Actual:** `?status=do` returns both `todo` and `done` tasks.
- **Why it happens:** The filter uses `t.status.includes(status)`, which is substring matching on a string.
- **How I found it:** Failing tests "a partial status string matches nothing" (unit) and "a partial status does not match other statuses" (integration).
- **Suggested fix:** `tasks.filter((t) => t.status === status)`. Optionally reject unknown status values with a 400.

## 3. Completing a task resets its priority (NOT FIXED)

- **Where:** `src/services/taskService.js`, `completeTask`
- **Expected:** `PATCH /tasks/:id/complete` sets `status` to `done` and stamps `completedAt`, and leaves everything else unchanged.
- **Actual:** A `high` priority task comes back as `medium`.
- **Why it happens:** `completeTask` builds the updated object with a hard-coded `priority: 'medium'`.
- **How I found it:** Failing tests "does not change the priority" (unit) and "keeps the original priority" (integration).
- **Suggested fix:** Delete the `priority: 'medium',` line.

## 4. PUT can overwrite `id` and `createdAt` (NOT FIXED)

- **Where:** `src/services/taskService.js`, `update` (called from `PUT /tasks/:id`)
- **Expected:** Immutable fields (`id`, `createdAt`) cannot be changed by a client.
- **Actual:** `PUT` with `{"id": "hacked"}` returns a task whose `id` is `"hacked"`.
- **Why it happens:** `update` does `{ ...tasks[index], ...fields }`, copying whatever the client sent over the stored task. The validator only checks `title`, `status`, `priority` and `dueDate`, so other fields pass straight through.
- **How I found it:** Failing tests "cannot overwrite id or createdAt" (unit and integration).
- **Suggested fix:** Whitelist the updatable fields (`title`, `description`, `status`, `priority`, `dueDate`), or strip `id`, `createdAt` and `completedAt` from `fields` before merging.
- **Related:** Setting `status: "done"` through PUT does not set `completedAt`, so `status` and `completedAt` can disagree. `PATCH /complete` and `PUT` behave inconsistently.

## 5. Status filter ignores pagination (NOT FIXED)

- **Where:** `src/routes/tasks.js`, `GET /`
- **Expected:** `?status=todo&page=1&limit=2` returns at most 2 matching tasks.
- **Actual:** It returns all matching tasks (3 in my test).
- **Why it happens:** The `if (status)` branch returns immediately, so the pagination branch is never reached when a status is given.
- **How I found it:** Failing test "pagination applies together with a status filter" (integration).
- **Suggested fix:** Filter first, then paginate the filtered list, for example by giving `getPaginated` an optional list to slice.

## 6. Empty-string `status` passes validation (NOT FIXED)

- **Where:** `src/utils/validators.js`, `validateCreateTask` (and `validateUpdateTask`)
- **Expected:** `POST /tasks` with `"status": ""` returns 400.
- **Actual:** It returns 201 and stores an empty status. That task is then counted in none of the buckets in `/tasks/stats`.
- **Why it happens:** The check is `body.status && !VALID_STATUSES.includes(body.status)`. An empty string is falsy, so the check is skipped, and `create` only applies the `'todo'` default when the value is `undefined`. The same pattern applies to `priority` and `dueDate`.
- **How I found it:** Failing test "rejects an empty-string status" (integration).
- **Suggested fix:** Check `body.status !== undefined` instead of relying on truthiness.

## 7. Malformed JSON returns 500 instead of 400 (NOT FIXED)

- **Where:** `src/app.js`, the error-handling middleware
- **Expected:** A request body that is not valid JSON returns 400.
- **Actual:** It returns 500 `Internal server error`.
- **Why it happens:** `express.json()` raises a parse error that carries a 400 status, but the catch-all handler ignores `err.status` and always responds 500.
- **How I found it:** Failing test "returns 400 for malformed JSON" (integration). The console showed a `SyntaxError` from `body-parser` right before the 500.
- **Suggested fix:** `res.status(err.status || 500)`, and only send the generic message for real server errors.

---

## Other observations (not tested or not bugs)

- The README documents statuses as `pending | in-progress | completed`, but the code and `ASSIGNMENT.md` use `todo | in_progress | done`.
- `findById` exists but there is no `GET /tasks/:id` route.
- Completing an already-completed task overwrites `completedAt`.
- `getAll()` copies the array but returns the same task objects, so callers could mutate the store.
- Negative or non-numeric `page` and `limit` values are not validated.