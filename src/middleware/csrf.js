import { randomBytes, timingSafeEqual } from 'node:crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const parseCookies = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      if (key) {
        cookies[key] = decodeURIComponent(value);
      }

      return cookies;
    }, {});
};

const serializeCookie = (name, value, { secure = false } = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

const createCsrfError = () => {
  const error = new Error('Invalid CSRF token.');
  error.statusCode = 403;
  error.code = 'EBADCSRFTOKEN';
  return error;
};

const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const extractSubmittedToken = (req) => {
  if (typeof req.get === 'function') {
    const headerToken = req.get('x-csrf-token');

    if (headerToken) {
      return headerToken;
    }
  }

  if (req.body && typeof req.body === 'object') {
    return req.body._csrf || req.body.csrfToken || null;
  }

  return null;
};

const csrfProtection = (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  let csrfToken = cookies[CSRF_COOKIE_NAME];

  if (!csrfToken) {
    csrfToken = randomBytes(32).toString('hex');
    res.append(
      'Set-Cookie',
      serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
        secure: process.env.NODE_ENV === 'production',
      }),
    );
  }

  req.csrfToken = csrfToken;
  res.locals.csrfToken = csrfToken;

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const submittedToken = extractSubmittedToken(req);

  if (!submittedToken || !safeCompare(csrfToken, submittedToken)) {
    return next(createCsrfError());
  }

  return next();
};

export default csrfProtection;
