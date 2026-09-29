const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

const createTask = (body) => request(app).post('/tasks').send(body);

describe('POST /tasks', () => {
  test('creates a task and returns 201', async () => {
    const res = await createTask({ title: 'Write tests', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write tests',
      priority: 'high',
      status: 'todo',
      completedAt: null,
    });
    expect(res.body.id).toBeDefined();
  });

  test('rejects a missing title', async () => {
    const res = await createTask({ priority: 'high' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects an empty or whitespace title', async () => {
    expect((await createTask({ title: '' })).status).toBe(400);
    expect((await createTask({ title: '   ' })).status).toBe(400);
  });

  test('rejects a non-string title', async () => {
    expect((await createTask({ title: 123 })).status).toBe(400);
  });

  test('rejects an invalid status', async () => {
    expect((await createTask({ title: 'A', status: 'pending' })).status).toBe(400);
  });

  test('rejects an empty-string status', async () => {
    expect((await createTask({ title: 'A', status: '' })).status).toBe(400);
  });

  test('rejects an invalid priority', async () => {
    expect((await createTask({ title: 'A', priority: 'urgent' })).status).toBe(400);
  });

  test('rejects an invalid dueDate', async () => {
    expect((await createTask({ title: 'A', dueDate: 'not-a-date' })).status).toBe(400);
  });

  test('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks', () => {
  test('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tasks', async () => {
    await createTask({ title: 'A' });
    await createTask({ title: 'B' });

    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  test('filters by exact status', async () => {
    await createTask({ title: 'A', status: 'todo' });
    await createTask({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.title)).toEqual(['A']);
  });

  test('a partial status does not match other statuses', async () => {
    await createTask({ title: 'A', status: 'todo' });
    await createTask({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=do');
    expect(res.body).toEqual([]);
  });

  test('page 1 starts at the first task', async () => {
    for (const title of ['a', 'b', 'c', 'd', 'e']) {
      await createTask({ title });
    }

    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.title)).toEqual(['a', 'b']);
  });

  test('page 2 returns the next slice', async () => {
    for (const title of ['a', 'b', 'c', 'd', 'e']) {
      await createTask({ title });
    }

    const res = await request(app).get('/tasks?page=2&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['c', 'd']);
  });

  test('pagination applies together with a status filter', async () => {
    for (const title of ['a', 'b', 'c']) {
      await createTask({ title, status: 'todo' });
    }
    await createTask({ title: 'd', status: 'done' });

    const res = await request(app).get('/tasks?status=todo&page=1&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['a', 'b']);
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts by status and overdue count', async () => {
    await createTask({ title: 'A', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    await createTask({ title: 'B', status: 'in_progress' });
    await createTask({ title: 'C', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });

  test('is not swallowed by the /:id routes', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toHaveProperty('overdue');
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const { body: task } = await createTask({ title: 'Old' });

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ title: 'New', priority: 'low' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, title: 'New', priority: 'low' });
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid input', async () => {
    const { body: task } = await createTask({ title: 'A' });

    expect((await request(app).put(`/tasks/${task.id}`).send({ title: '' })).status).toBe(400);
    expect((await request(app).put(`/tasks/${task.id}`).send({ status: 'bad' })).status).toBe(400);
    expect((await request(app).put(`/tasks/${task.id}`).send({ priority: 'bad' })).status).toBe(400);
  });

  test('cannot overwrite id or createdAt', async () => {
    const { body: task } = await createTask({ title: 'A' });

    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ id: 'hacked', createdAt: '1999-01-01T00:00:00.000Z' });

    expect(res.body.id).toBe(task.id);
    expect(res.body.createdAt).toBe(task.createdAt);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes a task and returns 204', async () => {
    const { body: task } = await createTask({ title: 'A' });

    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/tasks');
    expect(list.body).toEqual([]);
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/nope');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks the task done and sets completedAt', async () => {
    const { body: task } = await createTask({ title: 'A' });

    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(Number.isNaN(Date.parse(res.body.completedAt))).toBe(false);
  });

  test('keeps the original priority', async () => {
    const { body: task } = await createTask({ title: 'A', priority: 'high' });

    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });
});