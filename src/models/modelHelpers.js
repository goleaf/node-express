const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export const buildUpdatePayload = (data, allowedFields) => {
  const assignments = [];
  const params = {};

  for (const field of allowedFields) {
    if (!hasOwn(data, field) || data[field] === undefined) {
      continue;
    }

    assignments.push(`${field} = @${field}`);
    params[field] = data[field];
  }

  return { assignments, params };
};

export const ensureUserId = (userId) => {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new TypeError('A valid userId is required.');
  }

  return normalizedUserId;
};

export const normalizeIntegerIds = (values) => {
  const source = Array.isArray(values) ? values : [];
  const ids = [];

  for (const value of source) {
    const normalizedValue = Number(value);

    if (!Number.isInteger(normalizedValue) || normalizedValue <= 0 || ids.includes(normalizedValue)) {
      continue;
    }

    ids.push(normalizedValue);
  }

  return ids;
};

export const toJsonString = (value, fallback = '{}') => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
};

export const parseJson = (value, fallback = {}) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
