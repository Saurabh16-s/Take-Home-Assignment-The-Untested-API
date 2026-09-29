# Submission Note

Branch: https://github.com/Saurabh16-s/Take-Home-Assignment-The-Untested-API/tree/solution

## What's included

- **Tests:** `tests/unit/taskService.test.js` and `tests/integration/tasks.test.js` (behavior of the original API), plus `tests/integration/assign.test.js` (new endpoint).
- **Bug report:** `BUG_REPORT.md` lists 7 bugs with location, root cause, how each was found, and a suggested fix.
- **Fix:** pagination offset in `getPaginated` (`page * limit` changed to `(page - 1) * limit`).
- **New endpoint:** `PATCH /tasks/:id/assign`.
- **Coverage:** see the summary at the bottom.

The test suite currently has 9 failing tests on purpose. They assert the correct behavior for the 6 bugs I found but did not fix, so they act as regression tests: each will pass once its bug is fixed.

## `assign` design decisions

- **404 before 400.** The route looks up the task first, so an unknown ID returns 404 regardless of the body. Otherwise a client could get a misleading validation error for a task that doesn't exist.
- **Validation.** `assignee` must be a string, and empty or whitespace-only values return 400. The name is trimmed before storing, so `"  Priya  "` is saved as `"Priya"`. A rejected request leaves the task unchanged (there is a test for this).
- **Reassignment overwrites.** Assigning an already-assigned task replaces the previous assignee and returns 200. I chose this because assignment is a simple field update and it makes the endpoint idempotent. The alternative, returning 409 Conflict, would protect against accidentally overwriting someone else's assignment, and I'd want to confirm which behavior the product wants.
- **Completed tasks can be assigned.** Assigning doesn't change the task's status, and reassigning finished work (for record keeping) seems harmless. This is also a product question.
- **Not done:** no maximum length on `assignee`, and `create()` doesn't add `assignee: null` to new tasks, so the field only appears after the first assignment.

## What I'd test next

- Validation of `page` and `limit` (negative, zero, non-numeric, very large values).
- `PUT` with partial bodies and with `status` changes, checking that `status` and `completedAt` stay consistent.
- Completing an already-completed task (currently overwrites `completedAt`).
- `GET /tasks/stats` with a large mix of statuses and due dates, including dates exactly at "now".
- Concurrency and ordering: the store is in-memory and shared, so I'd check that returned objects can't be mutated by callers.

## What surprised me

- The pagination bug had a test that passed by accident: "page past the end returns empty array" was green even with the bug, because the shifted offset also landed past the end. A green test doesn't guarantee the code is right.
- `completeTask` silently resets `priority` to `medium`, which has nothing to do with completing a task.
- The README says statuses are `pending | in-progress | completed`, but the code and `ASSIGNMENT.md` use `todo | in_progress | done`.
- `findById` exists in the service, but there is no `GET /tasks/:id` route.

## Questions I'd ask before shipping

1. Which status names are correct, and should the README be updated to match the code?
2. Should reassignment be allowed silently, or should it require confirmation (409)?
3. Should completed tasks be editable, and should moving a task out of `done` clear `completedAt`?
4. Is `assignee` a free-text name, or should it reference a real user ID later?
5. Do clients need `page` and `limit` limits, and should responses include the total count for pagination?
6. Should `PUT` be a true full replace, or a partial update?

## Coverage summary

```
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   97.41 |    91.76 |   96.66 |   97.87 |                   
 src             |   84.61 |       75 |      50 |   84.61 |                   
  app.js         |   84.61 |       75 |      50 |   84.61 | 17-18             
 src/routes      |     100 |    91.66 |     100 |     100 |                   
  tasks.js       |     100 |    91.66 |     100 |     100 | 20-21             
 src/services    |   98.38 |    89.47 |     100 |     100 |                   
  taskService.js |   98.38 |    89.47 |     100 |     100 | 21,80             
 src/utils       |   96.29 |    94.73 |     100 |   96.29 |                   
  validators.js  |   96.29 |    94.73 |     100 |   96.29 | 31                
-----------------|---------|----------|---------|---------|-------------------
Tests: 9 failed, 54 passed, 63 total
```