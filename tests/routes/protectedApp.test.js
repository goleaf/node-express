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

const createUser = ({ onboardingCompleted = 1, name = 'Protected User' } = {}) => {
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
    email: `protected-${Date.now()}-${Math.random()}@example.com`,
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

describe('protected app routes', () => {
  beforeEach(() => {
    resetDatabase();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redirects unauthenticated HTML requests to login and rejects unauthenticated API requests', async () => {
    const htmlResponse = await request(app).get('/dashboard');
    expect(htmlResponse.status).toBe(302);
    expect(htmlResponse.headers.location).toBe('/auth/login');

    const apiResponse = await request(app).get('/api/tasks').set('Accept', 'application/json');
    expect(apiResponse.status).toBe(401);
    expect(apiResponse.body).toEqual({
      error: 'Authentication is required.',
    });
  });

  it('renders the authenticated shell routes successfully for a completed user', async () => {
    const agent = request.agent(app);
    const user = createUser();
    await loginAs(agent, user);

    const routes = [
      ['/dashboard', 'Dashboard'],
      ['/tasks', 'Tasks'],
      ['/tasks/new', 'New task'],
      ['/search', 'Search'],
      ['/categories', 'Lists'],
      ['/profile', 'Profile'],
      ['/tags', '/categories?tab=tags'],
    ];

    for (const [route, expected] of routes) {
      const response = await agent.get(route);

      if (route === '/tags') {
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(expected);
        continue;
      }

      expect(response.status).toBe(200);
      expect(response.text).toContain(expected);
    }
  });

  it('renders loading skeletons on the tasks screen before client hydration', async () => {
    const agent = request.agent(app);
    const user = createUser();
    await loginAs(agent, user);

    const response = await agent.get('/tasks');

    expect(response.status).toBe(200);
    expect(response.text).toContain('data-task-list-loading="true"');
    expect(response.text).toContain('data-task-skeleton');
  });

  it('returns only the signed-in users tasks from the api', async () => {
    const agent = request.agent(app);
    const primaryUser = createUser({ name: 'Primary User' });
    const otherUser = createUser({ name: 'Other User' });
    await loginAs(agent, primaryUser);

    createTaskAction.execute(primaryUser.id, {
      title: 'Primary task',
      priority: 'high',
      status: 'pending',
    });

    createTaskAction.execute(otherUser.id, {
      title: 'Other task',
      priority: 'low',
      status: 'pending',
    });

    const response = await agent.get('/api/tasks').set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.tasks).toHaveLength(1);
    expect(response.body.tasks[0]).toMatchObject({
      title: 'Primary task',
      user_id: primaryUser.id,
    });
  });
});
