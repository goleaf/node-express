import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../src/app.js';
import db from '../../src/config/database.js';
import CreateTaskAction from '../../src/actions/tasks/CreateTaskAction.js';
import CategoryModel from '../../src/models/CategoryModel.js';
import TagModel from '../../src/models/TagModel.js';

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

const createUser = ({ onboardingCompleted = 1, name = 'Lists User' } = {}) => {
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
    email: `lists-${Date.now()}-${Math.random()}@example.com`,
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

describe('categories, tags, and profile preference routes', () => {
  beforeEach(() => {
    resetDatabase();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates, updates, and deletes a category while detaching it from tasks', async () => {
    const agent = request.agent(app);
    const user = createUser();
    const csrfToken = await loginAs(agent, user);
    const task = createTaskAction.execute(user.id, {
      title: 'Category-bound task',
      priority: 'medium',
      status: 'pending',
    });

    const createResponse = await agent.post('/categories').set('Accept', 'application/json').send({
      _csrf: csrfToken,
      name: 'Work',
      color: '#6750A4',
      icon: 'work',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Category created',
      },
      category: {
        name: 'Work',
        color: '#6750A4',
        icon: 'work',
        user_id: user.id,
      },
    });

    const categoryId = Number(createResponse.body.category.id);
    CategoryModel.attachToTask(task.id, categoryId, user.id);

    const updateResponse = await agent
      .patch(`/categories/${categoryId}`)
      .set('Accept', 'application/json')
      .send({
        _csrf: csrfToken,
        name: 'Deep Work',
        color: '#386A20',
        icon: 'book',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Category updated',
      },
      category: {
        id: categoryId,
        name: 'Deep Work',
        color: '#386A20',
        icon: 'book',
      },
    });

    const deleteResponse = await agent
      .delete(`/categories/${categoryId}`)
      .set('Accept', 'application/json')
      .send({ _csrf: csrfToken });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Category deleted',
      },
    });

    const deletedCategory = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    expect(deletedCategory).toBeUndefined();

    const pivotRows = db
      .prepare('SELECT category_id FROM task_categories WHERE task_id = ? AND category_id = ?')
      .all(task.id, categoryId);

    expect(pivotRows).toHaveLength(0);
  });

  it('creates, updates, and deletes a tag while detaching it from tasks', async () => {
    const agent = request.agent(app);
    const user = createUser();
    const csrfToken = await loginAs(agent, user);
    const task = createTaskAction.execute(user.id, {
      title: 'Tag-bound task',
      priority: 'high',
      status: 'pending',
    });

    const createResponse = await agent.post('/tags').set('Accept', 'application/json').send({
      _csrf: csrfToken,
      name: 'Urgent',
      color: '#B3261E',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Tag created',
      },
      tag: {
        name: 'Urgent',
        color: '#B3261E',
        user_id: user.id,
      },
    });

    const tagId = Number(createResponse.body.tag.id);
    TagModel.syncTaskTags(task.id, [tagId], user.id);

    const updateResponse = await agent
      .patch(`/tags/${tagId}`)
      .set('Accept', 'application/json')
      .send({
        _csrf: csrfToken,
        name: 'Critical',
        color: '#D97706',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Tag updated',
      },
      tag: {
        id: tagId,
        name: 'Critical',
        color: '#D97706',
      },
    });

    const deleteResponse = await agent
      .delete(`/tags/${tagId}`)
      .set('Accept', 'application/json')
      .send({ _csrf: csrfToken });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Tag deleted',
      },
    });

    const deletedTag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
    expect(deletedTag).toBeUndefined();

    const pivotRows = db.prepare('SELECT tag_id FROM task_tags WHERE task_id = ? AND tag_id = ?').all(task.id, tagId);
    expect(pivotRows).toHaveLength(0);
  });

  it('persists profile preference updates through the json endpoint', async () => {
    const agent = request.agent(app);
    const user = createUser();
    const csrfToken = await loginAs(agent, user);

    const response = await agent
      .patch('/profile/preferences')
      .set('Accept', 'application/json')
      .send({
        _csrf: csrfToken,
        theme: 'dark',
        default_priority: 'urgent',
        default_view: 'calendar',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      toast: {
        type: 'success',
        message: 'Preferences updated',
      },
      user: {
        id: user.id,
        theme_preference: 'dark',
        default_priority: 'urgent',
        default_view: 'calendar',
      },
    });

    const storedUser = db
      .prepare('SELECT theme_preference, default_priority, default_view FROM users WHERE id = ?')
      .get(user.id);

    expect(storedUser).toMatchObject({
      theme_preference: 'dark',
      default_priority: 'urgent',
      default_view: 'calendar',
    });
  });
});
