import multer from 'multer';
import { Router } from 'express';
import avatarUpload from '../config/multer.js';
import DeleteAccountAction from '../actions/profile/DeleteAccountAction.js';
import UpdatePasswordAction from '../actions/profile/UpdatePasswordAction.js';
import UpdatePreferencesAction from '../actions/profile/UpdatePreferencesAction.js';
import UpdateProfileAction from '../actions/profile/UpdateProfileAction.js';
import requireAuth from '../middleware/auth.js';
import UserModel from '../models/UserModel.js';
import validateUpdatePassword from '../requests/profile/validateUpdatePassword.js';
import validateUpdatePreferences from '../requests/profile/validateUpdatePreferences.js';
import validateUpdateProfile from '../requests/profile/validateUpdateProfile.js';

const router = Router();
const updateProfileAction = new UpdateProfileAction();
const updatePasswordAction = new UpdatePasswordAction();
const updatePreferencesAction = new UpdatePreferencesAction();
const deleteAccountAction = new DeleteAccountAction();

const tabs = new Set(['profile', 'password', 'preferences', 'danger']);

const uploadAvatar = (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'Avatar must not exceed 2MB.'
        : error.message || 'Avatar upload failed.';

    res.status(422).json({
      errors: {
        avatar: message,
      },
    });
  });
};

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const { password_hash, ...publicUser } = user;
  return publicUser;
};

const pushFlash = (req, type, message) => {
  req.session.flashMessages = [
    ...(Array.isArray(req.session.flashMessages) ? req.session.flashMessages : []),
    { type, message },
  ];
};

router.use(requireAuth);

router.get('/', (req, res) => {
  const activeTab = tabs.has(req.query.tab) ? req.query.tab : 'profile';
  const user = UserModel.getWithStats(req.session.userId);

  res.render('profile/index', {
    title: 'Profile',
    activeTab,
    user,
  });
});

router.post(
  '/details',
  uploadAvatar,
  validateUpdateProfile,
  asyncHandler(async (req, res) => {
    const user = await updateProfileAction.execute(req.session.userId, req.body, req.file);

    req.session.user = sanitizeUser(user);
    pushFlash(req, 'success', 'Profile updated.');

    return res.redirect('/profile?tab=profile');
  }),
);

router.post(
  '/password',
  validateUpdatePassword,
  asyncHandler(async (req, res) => {
    await updatePasswordAction.execute(req.session.userId, req.body.password, req.session);
    pushFlash(req, 'success', 'Password updated.');

    return res.redirect('/profile?tab=password');
  }),
);

router.post(
  '/preferences',
  validateUpdatePreferences,
  asyncHandler(async (req, res) => {
    const user = updatePreferencesAction.execute(req.session.userId, req.body);

    req.session.user = sanitizeUser(user);
    pushFlash(req, 'success', 'Preferences updated.');

    return res.redirect('/profile?tab=preferences');
  }),
);

router.patch(
  '/preferences',
  validateUpdatePreferences,
  asyncHandler(async (req, res) => {
    const user = updatePreferencesAction.execute(req.session.userId, req.body);
    const sanitizedUser = sanitizeUser(user);

    req.session.user = sanitizedUser;

    return res.json({
      success: true,
      toast: {
        type: 'success',
        message: 'Preferences updated',
      },
      user: sanitizedUser,
    });
  }),
);

router.post(
  '/delete-account',
  asyncHandler(async (req, res) => {
    await deleteAccountAction.execute(req.session.userId, req.session);
    return res.redirect('/auth/login');
  }),
);

export default router;
