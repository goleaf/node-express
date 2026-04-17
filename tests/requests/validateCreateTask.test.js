import { beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import errorHandler from '../../src/middleware/errorHandler.js';
import validateCreateTask from '../../src/requests/tasks/validateCreateTask.js';

const buildApp = () => {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { userId: 1 };
    next();
  });

  app.post('/tasks', validateCreateTask, (req, res) => {
    res.status(201).json({ success: true });
  });

  app.use(errorHandler);

  return app;
};

describe('validateCreateTask', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it('returns 422 when title is missing', async () => {
    const response = await request(app).post('/tasks').send({
      priority: 'medium',
      status: 'pending',
    });

    expect(response.status).toBe(422);
    expect(response.body.errors.title).toBeDefined();
  });

  it('returns 422 when priority is invalid', async () => {
    const response = await request(app).post('/tasks').send({
      title: 'Invalid priority',
      priority: 'critical',
      status: 'pending',
    });

    expect(response.status).toBe(422);
    expect(response.body.errors.priority).toBeDefined();
  });

  it('returns 422 when due_date is in the past', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const response = await request(app).post('/tasks').send({
      title: 'Past due date',
      priority: 'medium',
      status: 'pending',
      due_date: yesterday,
    });

    expect(response.status).toBe(422);
    expect(response.body.errors.due_date).toBeDefined();
  });
});
