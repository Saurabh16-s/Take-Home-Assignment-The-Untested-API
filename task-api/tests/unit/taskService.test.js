const taskService = require('../../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  test('applies defaults for optional fields', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
    });
    expect(typeof task.id).toBe('string');
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
  });

  test('keeps provided fields', () => {
    const task = taskService.create({
      title: 'A',
      description: 'desc',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2030-01-01T00:00:00.000Z',
    });

    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe('2030-01-01T00:00:00.000Z');
  });

  test('generates a unique id per task', () => {
    const a = taskService.create({ title: 'A' });
    const b = taskService.create({ title: 'B' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('getAll / findById', () => {
  test('getAll returns every task', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  test('getAll returns a new array (pushing to it does not change the store)', () => {
    taskService.create({ title: 'A' });
    const list = taskService.getAll();
    list.push({ id: 'fake' });
    expect(taskService.getAll()).toHaveLength(1);
  });

  test('findById returns the task, or undefined when missing', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.findById(task.id)).toEqual(task);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  test('returns only tasks with that exact status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });
    taskService.create({ title: 'C', status: 'in_progress' });

    const todo = taskService.getByStatus('todo');
    expect(todo.map((t) => t.title)).toEqual(['A']);
  });

  test('a partial status string matches nothing (no substring matching)', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });

    expect(taskService.getByStatus('do')).toEqual([]);
  });

  test('returns empty array when nothing matches', () => {
    taskService.create({ title: 'A', status: 'todo' });
    expect(taskService.getByStatus('done')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    ['a', 'b', 'c', 'd', 'e'].forEach((title) => taskService.create({ title }));
  });

  test('page 1 returns the first items', () => {
    const result = taskService.getPaginated(1, 2);
    expect(result.map((t) => t.title)).toEqual(['a', 'b']);
  });

  test('page 2 returns the next items', () => {
    const result = taskService.getPaginated(2, 2);
    expect(result.map((t) => t.title)).toEqual(['c', 'd']);
  });

  test('last page can be partial', () => {
    const result = taskService.getPaginated(3, 2);
    expect(result.map((t) => t.title)).toEqual(['e']);
  });

  test('page past the end returns empty array', () => {
    expect(taskService.getPaginated(10, 2)).toEqual([]);
  });

  test('limit larger than total returns everything on page 1', () => {
    expect(taskService.getPaginated(1, 50)).toHaveLength(5);
  });
});

describe('getStats', () => {
  test('returns zeros when there are no tasks', () => {
    expect(taskService.getStats()).toEqual({
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    });
  });

  test('counts tasks by status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'todo' });
    taskService.create({ title: 'C', status: 'in_progress' });
    taskService.create({ title: 'D', status: 'done' });

    expect(taskService.getStats()).toMatchObject({
      todo: 2,
      in_progress: 1,
      done: 1,
    });
  });

  test('counts overdue tasks, but not done ones or future ones', () => {
    taskService.create({ title: 'past todo', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({
      title: 'past done',
      status: 'done',
      dueDate: '2000-01-01T00:00:00.000Z',
    });
    taskService.create({ title: 'future', dueDate: '2999-01-01T00:00:00.000Z' });
    taskService.create({ title: 'no due date' });

    expect(taskService.getStats().overdue).toBe(1);
  });
});

describe('update', () => {
  test('merges the given fields into the task', () => {
    const task = taskService.create({ title: 'Old' });
    const updated = taskService.update(task.id, { title: 'New', priority: 'high' });

    expect(updated.title).toBe('New');
    expect(updated.priority).toBe('high');
    expect(taskService.findById(task.id).title).toBe('New');
  });

  test('returns null for an unknown id', () => {
    expect(taskService.update('nope', { title: 'X' })).toBeNull();
  });

  test('cannot overwrite id or createdAt', () => {
    const task = taskService.create({ title: 'A' });
    const updated = taskService.update(task.id, {
      id: 'hacked',
      createdAt: '1999-01-01T00:00:00.000Z',
    });

    expect(updated.id).toBe(task.id);
    expect(updated.createdAt).toBe(task.createdAt);
  });
});

describe('remove', () => {
  test('removes an existing task and returns true', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  test('returns false for an unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status to done and stamps completedAt', () => {
    const task = taskService.create({ title: 'A' });
    const done = taskService.completeTask(task.id);

    expect(done.status).toBe('done');
    expect(Number.isNaN(Date.parse(done.completedAt))).toBe(false);
  });

  test('does not change the priority', () => {
    const task = taskService.create({ title: 'A', priority: 'high' });
    const done = taskService.completeTask(task.id);

    expect(done.priority).toBe('high');
  });

  test('persists the change in the store', () => {
    const task = taskService.create({ title: 'A' });
    taskService.completeTask(task.id);

    expect(taskService.findById(task.id).status).toBe('done');
  });

  test('returns null for an unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });
});