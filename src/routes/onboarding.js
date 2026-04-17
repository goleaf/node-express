import { Router } from 'express';
import CompleteOnboardingAction from '../actions/onboarding/CompleteOnboardingAction.js';
import requireAuth from '../middleware/auth.js';
import UserModel from '../models/UserModel.js';

const router = Router();
const completeOnboardingAction = new CompleteOnboardingAction();
const allowedThemes = new Set(['light', 'dark', 'system']);
const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const pushFlash = (req, type, message) => {
  req.session.flashMessages = [
    ...(Array.isArray(req.session.flashMessages) ? req.session.flashMessages : []),
    { type, message },
  ];
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const { password_hash, ...publicUser } = user;
  return publicUser;
};

const ensureIncomplete = (req, res, next) => {
  if (Number(req.currentUser?.onboarding_completed) === 1) {
    return res.redirect('/dashboard');
  }

  return next();
};

router.use(requireAuth);
router.use(ensureIncomplete);

router.get('/', (req, res) => {
  return res.render('onboarding/step1', {
    title: 'Welcome',
    currentStep: 1,
  });
});

router.get('/step-2', (req, res) => {
  return res.render('onboarding/step2', {
    title: 'Create your first task',
    currentStep: 2,
  });
});

router.get('/step-3', (req, res) => {
  return res.render('onboarding/step3', {
    title: 'Set your preferences',
    currentStep: 3,
  });
});

router.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const theme = allowedThemes.has(req.body.theme) ? req.body.theme : 'system';
    const defaultPriority = allowedPriorities.has(req.body.default_priority)
      ? req.body.default_priority
      : 'medium';

    UserModel.update(req.session.userId, {
      theme_preference: theme,
      default_priority: defaultPriority,
    });

    const user = completeOnboardingAction.execute(req.session.userId);
    req.session.user = sanitizeUser(user);
    pushFlash(req, 'success', 'Welcome aboard. Your workspace is ready.');

    return res.redirect('/dashboard');
  }),
);

export default router;
