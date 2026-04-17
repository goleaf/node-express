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

const createUser = () => {
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
    name: 'Security Test User',
    email: `security-${Date.now()}-${Math.random()}@example.com`,
    password_hash: bcrypt.hashSync(password, 4),
    theme_preference: 'system',
    onboarding_completed: 1,
    default_priority: 'medium',
    default_view: 'list',
  });

  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(Number(result.lastInsertRowid));

  return {
    email: user.email,
    password,
  };
};

const extractCsrfToken = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  const csrfCookie = cookies.find((cookie) => cookie.startsWith('csrf_token='));

  if (!csrfCookie) {
    throw new Error('Expected csrf_token cookie to be set.');
  }

  return decodeURIComponent(csrfCookie.split(';')[0].slice('csrf_token='.length));
};

describe('security middleware', () => {
  beforeEach(() => {
    resetDatabase();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects state-changing requests with an invalid CSRF token', async () => {
    const response = await request(app).post('/auth/login').set('Accept', 'application/json').send({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Invalid CSRF token.',
    });
  });

  it('rate limits repeated authentication requests after ten attempts', async () => {
    const agent = request.agent(app);
    const user = createUser();
    const loginPage = await agent.get('/auth/login');
    const csrfToken = extractCsrfToken(loginPage);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await agent.post('/auth/login').set('Accept', 'application/json').send({
        _csrf: csrfToken,
        email: user.email,
        password: 'wrongpass1',
      });
    }

    const response = await agent.post('/auth/login').set('Accept', 'application/json').send({
      _csrf: csrfToken,
      email: user.email,
      password: 'wrongpass1',
    });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: 'Too many authentication requests. Try again in 15 minutes.',
    });
  });
});
