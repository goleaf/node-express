const PENDING_TOAST_KEY = 'todo-pending-toast';

export const showToast = (toast) => {
  if (!toast?.message) {
    return;
  }

  window.Toast?.show(toast);
};

export const queueToast = (toast) => {
  if (!toast?.message) {
    return;
  }

  try {
    window.sessionStorage.setItem(PENDING_TOAST_KEY, JSON.stringify(toast));
  } catch {
    // ignore storage failures
  }
};

export const showToastFromPayload = (payload, options = {}) => {
  const { persist = false, override = {} } = options;
  const toast = payload?.toast ? { ...payload.toast, ...override } : null;

  if (!toast?.message) {
    return;
  }

  if (persist) {
    queueToast(toast);
    return;
  }

  showToast(toast);
};

export const showErrorToast = (message = 'We could not complete that request.') => {
  showToast({
    type: 'error',
    message,
  });
};
