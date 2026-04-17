import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const findByIdMock = jest.fn();

await jest.unstable_mockModule('../../src/models/UserModel.js', () => ({
  default: {
    findById: findByIdMock,
  },
}));

const { requireAuth } = await import('../../src/middleware/auth.js');

const buildResponse = () => {
  const res = {
    locals: {},
    redirect: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

describe('requireAuth', () => {
  beforeEach(() => {
    findByIdMock.mockReset();
  });

  it('redirects incomplete onboarding users to onboarding for html requests', () => {
    findByIdMock.mockReturnValue({
      id: 1,
      name: 'Onboarding Tester',
      email: 'tester@example.com',
      password_hash: 'secret',
      onboarding_completed: 0,
    });

    const req = {
      session: { userId: 1, user: null },
      accepts: jest.fn(() => 'html'),
      originalUrl: '/dashboard',
      path: '/dashboard',
    };
    const res = buildResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/onboarding');
    expect(next).not.toHaveBeenCalled();
    expect(req.session.user).toMatchObject({
      id: 1,
      name: 'Onboarding Tester',
      onboarding_completed: 0,
    });
  });

  it('returns onboarding json redirect payload for api requests', () => {
    findByIdMock.mockReturnValue({
      id: 2,
      name: 'Api Tester',
      email: 'api@example.com',
      password_hash: 'secret',
      onboarding_completed: 0,
    });

    const req = {
      session: { userId: 2, user: null },
      accepts: jest.fn(() => 'json'),
      originalUrl: '/api/tasks',
      path: '/api/tasks',
    };
    const res = buildResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      redirect: '/onboarding',
      message: 'Complete onboarding to continue.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows completed users through and exposes the public user', () => {
    findByIdMock.mockReturnValue({
      id: 3,
      name: 'Complete User',
      email: 'complete@example.com',
      password_hash: 'secret',
      onboarding_completed: 1,
    });

    const req = {
      session: { userId: 3, user: null },
      accepts: jest.fn(() => 'html'),
      originalUrl: '/dashboard',
      path: '/dashboard',
    };
    const res = buildResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.redirect).not.toHaveBeenCalled();
    expect(req.currentUser).toEqual({
      id: 3,
      name: 'Complete User',
      email: 'complete@example.com',
      onboarding_completed: 1,
    });
    expect(req.currentUser.password_hash).toBeUndefined();
    expect(res.locals.currentUser).toEqual(req.currentUser);
  });
});
