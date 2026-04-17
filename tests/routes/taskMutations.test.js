import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app.js';
import db from '../../src/config/database.js';
import CreateTaskAction from '../../src/actions/tasks/CreateTaskAction.js';

const createTaskAction = new CreateTaskAction();

const resetDatabase = () => {
  db.exec(`
    DELETE FROM sessions;
    DELETE FROM user_events;
    DELETE FROM notifications;
    DELETE FROM attachments;
    DELETE FROM password_resets;
    DELETE FROM task_tags;
    DELETE FROM task_categories;
    DELETE FROM subtasks;
    DELETE FROM tasks;
    DELETE FROM tags;
    DELETE FROM categories;
    DELETE FROM users;
    DELETE FROM login_attempts;
  `);
};

const extractCsrfToken = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  const csrfCookie = cookies.find((cookie) => cookie.startsWith('csrf_token='));

  if (!csrfCookie) {
    throw new Error('Expected csrf_token cookie to be set.');
  }

  return decodeURIComponent(csrfCookie.split(';')[0].slice('csrf_token='.length));
};

const createUser = ({ onboardingCompleted = 1, name = 'Task Route User' } = {}) => {
  const password = 'password123';
  const result = db.prepare(`
    INSERT INTO users (
      name,
      email,
      password_hash,
      theme_preference,
      onboarding_completed,
      default_priority,
      default_view
    ) VALUES (
      @name,
      @email,
      @password_hash,
      @theme_preference,
      @onboarding_completed,
      @default_priority,
      @default_view
    )
  `).run({
    name,
    email: `task-routes-${Date.now()}-${Math.random()}@example.com`,
    password_hash: bcrypt.hashSync(password, 4),
    theme_preference: 'system',
    onboarding_completed: onboardingCompleted,
    default_priority: 'medium',
    default_view: 'list',
  });

  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(Number(result.lastInsertRowid));

  return {
    id: Number(user.id),
    email: user.email,
    password,
  };
};

const loginAs = async (agent, credentials) => {
  const loginPage = await agent.get('/auth/login');
  const csrfToken = extractCsrfToken(loginPage);

  const response = await agent.post('/auth/login').send({
    _csrf: csrfToken,
    email: credentials.email,
    password: credentials.password,
  });

  expect(response.status).toBe(302);

  return csrfToken;
};

describe('task mutation routes', () => {
  beforeEach(() => {
    resetDatabase();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a task through POST /tasks', async () => {
    const agent = request.agent(app);
    const user = createUser();
    const csrfToken = await loginAs(agent, user);

    const response = await agent.post('/tasks').set('Accept', 'application/json').send({
      _csrf: csrfToken,
      title: 'Route-created task',
      description: 'Created through the route boundary',
      priority: 'high',
      status: 'pending',
      due_date: '2030-01-15',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Task created',
      },
      task: {
        title: 'Route-created task',
        description: 'Created through the route boundary',
        priority: 'high',
        status: 'pending',
        user_id: user.id,
      },
    });

    const storedTask = db.prepare('SELECT title, user_id FROM tasks WHERE id = ?').get(response.body.task.id);
    expect(storedTask).toMatchObject({
      title: 'Route-created task',
      user_id: user.id,
    });
  });

  it('completes, soft deletes, and restores a task through the api routes', async () => {
    const agent = request.agent(app);
    const user = createUser();
    const csrfToken = await loginAs(agent, user);
    const task = createTaskAction.execute(user.id, {
      title: 'Lifecycle task',
      priority: 'medium',
      status: 'pending',
    });

    const completeResponse = await agent
      .patch(`/api/tasks/${task.id}/complete`)
      .set('Accept', 'application/json')
      .send({ _csrf: csrfToken });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body).toMatchObject({
      toast: {
        type: 'success',
        message: 'Task completed',
      },
      task: {
        status: 'completed',
      },
    });
    expect(completeResponse.body.task.completed_at).not.toBeNull();

    const deleteResponse = await agent
      .delete(`/api/tasks/${task.id}`)
      .set('Accept', 'application/json')
      .send({ _csrf: csrfToken });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Task deleted',
      },
    });

    const deletedTask = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(task.id);
    expect(deletedTask.deleted_at).not.toBeNull();

    const restoreResponse = await agent
      .post(`/api/tasks/${task.id}/restore`)
      .set('Accept', 'application/json')
      .send({ _csrf: csrfToken });

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body).toMatchObject({
      toast: {
        type: 'success',
        message: 'Task restored',
      },
      task: {
        id: task.id,
      },
    });

    const restoredTask = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(task.id);
    expect(restoredTask.deleted_at).toBeNull();
  });

  it('returns only matching tasks for the signed-in user from the search api', async () => {
    const agent = request.agent(app);
    const user = createUser({ name: 'Search User' });
    const otherUser = createUser({ name: 'Other Search User' });
    await loginAs(agent, user);

    createTaskAction.execute(user.id, {
      title: 'Alpha roadmap',
      description: 'Find me',
      priority: 'urgent',
      status: 'pending',
    });

    createTaskAction.execute(user.id, {
      title: 'Bravo cleanup',
      description: 'Ignore me',
      priority: 'low',
      status: 'pending',
    });

    createTaskAction.execute(otherUser.id, {
      title: 'Alpha competitor',
      description: 'Must not leak',
      priority: 'high',
      status: 'pending',
    });

    const response = await agent
      .get('/api/tasks/search')
      .set('Accept', 'application/json')
      .query({ query: 'Alpha' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.tasks).toHaveLength(1);
    expect(response.body.tasks[0]).toMatchObject({
      title: 'Alpha roadmap',
      user_id: user.id,
    });
  });

  it('rejects cross-user task mutations', async () => {
    const agent = request.agent(app);
    const user = createUser({ name: 'Primary Owner' });
    const otherUser = createUser({ name: 'Foreign Owner' });
    const csrfToken = await loginAs(agent, user);
    const foreignTask = createTaskAction.execute(otherUser.id, {
      title: 'Foreign task',
      priority: 'medium',
      status: 'pending',
    });

    const response = await agent
      .delete(`/api/tasks/${foreignTask.id}`)
      .set('Accept', 'application/json')
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(422);
    expect(response.body.errors.id).toBe('Task does not exist or is not accessible.');
  });
});
