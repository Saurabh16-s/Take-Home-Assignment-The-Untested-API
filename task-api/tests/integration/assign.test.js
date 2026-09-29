const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

const createTask = (body = { title: 'A' }) => request(app).post('/tasks').send(body);
const assign = (id, body) => request(app).patch(`/tasks/${id}/assign`).send(body);

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a name and returns the updated task', async () => {
    const { body: task } = await createTask();
    const res = await assign(task.id, { assignee: 'Priya' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Priya');
    expect(res.body.id).toBe(task.id);
  });

  test('trims whitespace from the name', async () => {
    const { body: task } = await createTask();
    const res = await assign(task.id, { assignee: '  Priya  ' });
    expect(res.body.assignee).toBe('Priya');
  });

  test('persists the assignee', async () => {
    const { body: task } = await createTask();
    await assign(task.id, { assignee: 'Priya' });

    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBe('Priya');
  });

  test('returns 404 for an unknown task', async () => {
    const res = await assign('nope', { assignee: 'Priya' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for a missing assignee', async () => {
    const { body: task } = await createTask();
    expect((await assign(task.id, {})).status).toBe(400);
  });

  test('returns 400 for an empty or whitespace assignee', async () => {
    const { body: task } = await createTask();
    expect((await assign(task.id, { assignee: '' })).status).toBe(400);
    expect((await assign(task.id, { assignee: '   ' })).status).toBe(400);
  });

  test('returns 400 for a non-string assignee', async () => {
    const { body: task } = await createTask();
    expect((await assign(task.id, { assignee: 123 })).status).toBe(400);
  });

  test('a rejected request does not change the task', async () => {
    const { body: task } = await createTask();
    await assign(task.id, { assignee: 'Priya' });
    await assign(task.id, { assignee: '' });

    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBe('Priya');
  });

  test('reassigning replaces the previous assignee', async () => {
    const { body: task } = await createTask();
    await assign(task.id, { assignee: 'Priya' });
    const res = await assign(task.id, { assignee: 'Rahul' });
    expect(res.body.assignee).toBe('Rahul');
  });

  test('a completed task can still be assigned', async () => {
    const { body: task } = await createTask();
    await request(app).patch(`/tasks/${task.id}/complete`);
    const res = await assign(task.id, { assignee: 'Priya' });
    expect(res.status).toBe(200);
  });
});