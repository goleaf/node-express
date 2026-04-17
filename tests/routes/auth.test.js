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

const createUser = ({ onboardingCompleted = 1 } = {}) => {
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
    name: 'Auth Test User',
    email: `auth-${Date.now()}-${Math.random()}@example.com`,
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

describe('auth routes', () => {
  beforeEach(() => {
    resetDatabase();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a user and redirects to login', async () => {
    const agent = request.agent(app);
    const registerPage = await agent.get('/auth/register');
    const csrfToken = extractCsrfToken(registerPage);

    const response = await agent.post('/auth/register').send({
      _csrf: csrfToken,
      name: 'Registered User',
      email: 'registered-user@example.com',
      password: 'password123',
      password_confirmation: 'password123',
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/login');

    const user = db.prepare('SELECT name, email FROM users WHERE email = ?').get('registered-user@example.com');
    expect(user).toMatchObject({
      name: 'Registered User',
      email: 'registered-user@example.com',
    });
  });

  it('logs in a completed user and grants dashboard access', async () => {
    const agent = request.agent(app);
    const user = createUser({ onboardingCompleted: 1 });
    const loginPage = await agent.get('/auth/login');
    const csrfToken = extractCsrfToken(loginPage);

    const loginResponse = await agent.post('/auth/login').send({
      _csrf: csrfToken,
      email: user.email,
      password: user.password,
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe('/dashboard');

    const dashboardResponse = await agent.get('/dashboard');
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.text).toContain('Dashboard');
  });

  it('logs a user out and revokes the authenticated session', async () => {
    const agent = request.agent(app);
    const user = createUser({ onboardingCompleted: 1 });
    const loginPage = await agent.get('/auth/login');
    const csrfToken = extractCsrfToken(loginPage);

    await agent.post('/auth/login').send({
      _csrf: csrfToken,
      email: user.email,
      password: user.password,
    });

    const logoutResponse = await agent.post('/auth/logout').send({
      _csrf: csrfToken,
    });

    expect(logoutResponse.status).toBe(302);
    expect(logoutResponse.headers.location).toBe('/auth/login');

    const dashboardResponse = await agent.get('/dashboard');
    expect(dashboardResponse.status).toBe(302);
    expect(dashboardResponse.headers.location).toBe('/auth/login');
  });
});
