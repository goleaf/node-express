import UserModel from '../models/UserModel.js';

const wantsHtml = (req) => req.accepts(['html', 'json']) === 'html';

const toPublicUser = (user) => {
  if (!user) {
    return null;
  }

  const { password_hash, ...publicUser } = user;
  return publicUser;
};

export const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    const error = new Error(
      wantsHtml(req) ? 'Please log in to continue.' : 'Authentication is required.',
    );
    error.statusCode = 401;
    return next(error);
  }

  const user = UserModel.findById(req.session.userId);

  if (!user) {
    req.session.userId = null;
    req.session.user = null;

    const error = new Error(
      wantsHtml(req) ? 'Please log in to continue.' : 'Authentication is required.',
    );
    error.statusCode = 401;
    return next(error);
  }

  const publicUser = toPublicUser(user);
  const currentPath = req.originalUrl || req.path || '/';

  req.currentUser = publicUser;
  req.session.user = publicUser;
  res.locals.currentUser = publicUser;

  if (
    Number(publicUser.onboarding_completed) === 0
    && !currentPath.startsWith('/onboarding')
    && !currentPath.startsWith('/auth')
  ) {
    if (wantsHtml(req)) {
      return res.redirect('/onboarding');
    }

    return res.status(409).json({
      success: false,
      redirect: '/onboarding',
      message: 'Complete onboarding to continue.',
    });
  }

  return next();
};

export default requireAuth;
