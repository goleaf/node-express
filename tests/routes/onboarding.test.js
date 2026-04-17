import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app.js';
import db from '../../src/config/database.js';

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
  `);
};

const createUser = ({ onboardingCompleted = 0 } = {}) => {
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
    name: 'Onboarding Test User',
    email: `onboarding-${Date.now()}-${Math.random()}@example.com`,
    password_hash: bcrypt.hashSync(password, 4),
    theme_preference: 'system',
    onboarding_completed: onboardingCompleted,
    default_priority: 'medium',
    default_view: 'list',
  });

  const id = Number(result.lastInsertRowid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  return { id, email: user.email, password };
};

const extractCsrfToken = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  const csrfCookie = cookies.find((cookie) => cookie.startsWith('csrf_token='));

  if (!csrfCookie) {
    throw new Error('Expected csrf_token cookie to be set.');
  }

  return decodeURIComponent(csrfCookie.split(';')[0].slice('csrf_token='.length));
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
  expect(response.headers.location).toBe('/dashboard');

  return csrfToken;
};

describe('onboarding routes', () => {
  beforeEach(() => {
    resetDatabase();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redirects incomplete users from dashboard to onboarding and renders step one', async () => {
    const agent = request.agent(app);
    const credentials = createUser();

    await loginAs(agent, credentials);

    const dashboardResponse = await agent.get('/dashboard');
    expect(dashboardResponse.status).toBe(302);
    expect(dashboardResponse.headers.location).toBe('/onboarding');

    const onboardingResponse = await agent.get('/onboarding');
    expect(onboardingResponse.status).toBe(200);
    expect(onboardingResponse.text).toContain('Get started');
  });

  it('completes onboarding, persists preferences, and redirects completed users away from onboarding', async () => {
    const agent = request.agent(app);
    const credentials = createUser();
    const csrfToken = await loginAs(agent, credentials);

    const completionResponse = await agent.post('/onboarding/complete').send({
      _csrf: csrfToken,
      theme: 'dark',
      default_priority: 'urgent',
    });

    expect(completionResponse.status).toBe(302);
    expect(completionResponse.headers.location).toBe('/dashboard');

    const updatedUser = db
      .prepare(`
        SELECT onboarding_completed, theme_preference, default_priority
        FROM users
        WHERE email = ?
      `)
      .get(credentials.email);

    expect(updatedUser).toMatchObject({
      onboarding_completed: 1,
      theme_preference: 'dark',
      default_priority: 'urgent',
    });

    const onboardingResponse = await agent.get('/onboarding');
    expect(onboardingResponse.status).toBe(302);
    expect(onboardingResponse.headers.location).toBe('/dashboard');
  });
});
