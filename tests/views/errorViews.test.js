import { describe, expect, it } from '@jest/globals';
import ejs from 'ejs';
import path from 'node:path';

const viewsDir = path.join(process.cwd(), 'src/views');

const renderView = (templatePath, data) =>
  ejs.renderFile(path.join(viewsDir, templatePath), data);

describe('error views', () => {
  it('renders the generic error page without shared request locals', async () => {
    await expect(
      renderView('errors/error.ejs', {
        title: 'Something went wrong',
        statusCode: 500,
        message: 'We could not complete that request.',
      }),
    ).resolves.toContain('Something went wrong');
  });

  it('renders the 403 page without shared request locals', async () => {
    await expect(
      renderView('errors/403.ejs', {
        title: 'Access denied',
        message: 'You do not have permission to access this screen.',
      }),
    ).resolves.toContain('Access denied');
  });

  it('renders the 404 page without shared request locals', async () => {
    await expect(
      renderView('errors/404.ejs', {
        title: 'Page not found',
        requestedPath: '/missing',
      }),
    ).resolves.toContain('/missing');
  });
});
