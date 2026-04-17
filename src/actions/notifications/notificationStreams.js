const activeNotificationListeners = new Map();

export const registerNotificationListener = (userId, listener) => {
  const listeners = activeNotificationListeners.get(userId) || new Set();
  listeners.add(listener);
  activeNotificationListeners.set(userId, listeners);
};

export const unregisterNotificationListener = (userId, listener) => {
  const listeners = activeNotificationListeners.get(userId);

  if (!listeners) {
    return;
  }

  listeners.delete(listener);

  if (listeners.size === 0) {
    activeNotificationListeners.delete(userId);
  }
};

export const emitNotificationToUser = (userId, payload) => {
  const listeners = activeNotificationListeners.get(userId);

  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener(payload);
  }
};
