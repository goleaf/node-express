import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import LoginUserAction from '../actions/auth/LoginUserAction.js';
import LogoutUserAction from '../actions/auth/LogoutUserAction.js';
import RegisterUserAction from '../actions/auth/RegisterUserAction.js';
import ResetPasswordAction from '../actions/auth/ResetPasswordAction.js';
import SendPasswordResetAction from '../actions/auth/SendPasswordResetAction.js';
import validateForgotPassword from '../requests/auth/validateForgotPassword.js';
import validateLogin from '../requests/auth/validateLogin.js';
import validateRegister from '../requests/auth/validateRegister.js';
import validateResetPassword from '../requests/auth/validateResetPassword.js';

const router = Router();
const loginUserAction = new LoginUserAction();
const registerUserAction = new RegisterUserAction();
const logoutUserAction = new LogoutUserAction();
const sendPasswordResetAction = new SendPasswordResetAction();
const resetPasswordAction = new ResetPasswordAction();

const renderView = (res, view, locals = {}, statusCode = 200) => {
  return res.status(statusCode).render(`auth/${view}`, {
    pageError: null,
    ...locals,
  });
};

const pushFlashMessage = async (session, type, text) => {
  session.flashMessages = [...(session.flashMessages ?? []), { type, text }];

  await new Promise((resolve, reject) => {
    session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  handler: (req, res) => {
    const message = 'Too many authentication requests. Try again in 15 minutes.';

    if (req.accepts(['html', 'json']) === 'html') {
      return res.status(429).render('errors/error', {
        title: 'Too many requests',
        statusCode: 429,
        message,
      });
    }

    return res.status(429).json({ error: message });
  },
});

router.use(authRateLimiter);

router.get('/', (req, res) => {
  res.redirect('/auth/login');
});

router.get('/login', (req, res) => {
  renderView(res, 'login', {
    title: 'Log in',
    form: {
      email: '',
    },
  });
});

router.post(
  '/login',
  validateLogin,
  asyncHandler(async (req, res) => {
    req.session.requestIp = req.ip;

    const user = await loginUserAction.execute(req.body.email, req.body.password, req.session);

    if (!user) {
      return renderView(
        res,
        'login',
        {
          title: 'Log in',
          pageError: 'Invalid email or password.',
          form: {
            email: req.body.email,
          },
        },
        422,
      );
    }

    await pushFlashMessage(req.session, 'success', `Welcome back, ${user.name}.`);

    return res.redirect('/dashboard');
  }),
);

router.get('/register', (req, res) => {
  renderView(res, 'register', {
    title: 'Create account',
    form: {
      name: '',
      email: '',
    },
  });
});

router.post(
  '/register',
  validateRegister,
  asyncHandler(async (req, res) => {
    await registerUserAction.execute(req.body.name, req.body.email, req.body.password);
    await pushFlashMessage(req.session, 'success', 'Account created. You can sign in now.');
    return res.redirect('/auth/login');
  }),
);

router.get('/forgot-password', (req, res) => {
  renderView(res, 'forgot-password', {
    title: 'Forgot password',
    form: {
      email: '',
    },
  });
});

router.post(
  '/forgot-password',
  validateForgotPassword,
  asyncHandler(async (req, res) => {
    await sendPasswordResetAction.execute(req.body.email);
    await pushFlashMessage(
      req.session,
      'success',
      'If that account exists, a password reset link has been sent.',
    );
    return res.redirect('/auth/forgot-password');
  }),
);

router.get('/reset-password', (req, res) => {
  renderView(
    res,
    'reset-password',
    {
      title: 'Reset password',
      token: req.query.token ?? '',
    },
    req.query.token ? 200 : 400,
  );
});

router.post(
  '/reset-password',
  validateResetPassword,
  asyncHandler(async (req, res) => {
    const wasReset = await resetPasswordAction.execute(req.body.token, req.body.password);

    if (!wasReset) {
      return renderView(
        res,
        'reset-password',
        {
          title: 'Reset password',
          pageError: 'This password reset link is invalid or has expired.',
          token: req.body.token,
        },
        422,
      );
    }

    await pushFlashMessage(req.session, 'success', 'Password reset complete. Sign in with your new password.');
    return res.redirect('/auth/login');
  }),
);

router.get('/logout', (req, res) => {
  renderView(res, 'logout', {
    title: 'Log out',
  });
});

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await logoutUserAction.execute(req.session);
    return res.redirect('/auth/login');
  }),
);

export default router;
