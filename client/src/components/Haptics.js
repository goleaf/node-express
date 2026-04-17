const vibrate = (pattern) => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  navigator.vibrate(pattern);
};

const Haptics = {
  complete() {
    vibrate(50);
  },

  delete() {
    vibrate([100, 30, 100]);
  },

  error() {
    vibrate(200);
  },
};

export { Haptics };
export default Haptics;
