const PENDING_TOAST_KEY = 'todo-pending-toast';

const ICONS = {
  success: `
    <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2">
      <path d="M5 12.5l4 4L19 7.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  error: `
    <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2">
      <path d="M12 8v5" stroke-linecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
      <path d="M10.3 3.9 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke-linejoin="round" />
    </svg>
  `,
  warning: `
    <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2">
      <path d="M12 8v5" stroke-linecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
      <path d="M10.3 3.9 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke-linejoin="round" />
    </svg>
  `,
  info: `
    <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v5" stroke-linecap="round" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  `,
};

const sanitizeText = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

export class ToastManager {
  constructor(container = document.querySelector('[data-toast-container]')) {
    this.container = container || this.createContainer();
    this.toasts = [];
    this.nextId = 0;

    this.consumeInitialToasts();
    this.consumePendingToast();
  }

  createContainer() {
    const container = document.createElement('div');
    container.dataset.toastContainer = '';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    container.className = 'pointer-events-none fixed bottom-24 left-4 right-4 z-50 flex flex-col gap-2';
    document.body.append(container);
    return container;
  }

  queueForNextPage(toast) {
    try {
      window.sessionStorage.setItem(PENDING_TOAST_KEY, JSON.stringify(toast));
    } catch {
      // ignore storage failures
    }
  }

  consumePendingToast() {
    try {
      const payload = window.sessionStorage.getItem(PENDING_TOAST_KEY);

      if (!payload) {
        return;
      }

      window.sessionStorage.removeItem(PENDING_TOAST_KEY);
      const toast = JSON.parse(payload);

      if (toast?.message) {
        this.show(toast);
      }
    } catch {
      // ignore storage failures
    }
  }

  consumeInitialToasts() {
    const source = document.querySelector('[data-initial-toasts]');

    if (!source?.textContent) {
      return;
    }

    try {
      const toasts = JSON.parse(source.textContent);

      if (!Array.isArray(toasts)) {
        return;
      }

      toasts.forEach((toast) => {
        if (toast?.message) {
          this.show({ ...toast, duration: toast.duration || 4000 });
        }
      });
    } catch {
      // ignore malformed initial toast payloads
    }
  }

  show(options = {}) {
    const toast = {
      id: ++this.nextId,
      type: options.type || 'info',
      message: options.message || '',
      action: options.action || null,
      duration: Number(options.duration || 4000),
    };

    if (!toast.message) {
      return null;
    }

    if (this.toasts.length >= 3) {
      this.dismiss(this.toasts[0].id, { immediate: true });
    }

    const element = document.createElement('article');
    element.dataset.toastId = String(toast.id);
    element.className = 'pointer-events-auto flex min-h-[48px] items-center gap-3 rounded-md-extra-small bg-md-inverse-surface px-4 py-3 text-md-inverse-on-surface shadow-lg animate-sheet-in';
    element.innerHTML = `
      <span class="shrink-0 text-md-inverse-on-surface">${ICONS[toast.type] || ICONS.info}</span>
      <p class="min-w-0 flex-1 text-md-body-medium text-md-inverse-on-surface">${sanitizeText(toast.message)}</p>
      ${toast.action?.label ? `<button type="button" data-toast-action class="touch-target ml-auto rounded-md-full px-2 text-md-label-large text-md-primary">${sanitizeText(toast.action.label)}</button>` : ''}
      <button type="button" data-toast-dismiss class="touch-target rounded-md-full text-md-inverse-on-surface" aria-label="Dismiss notification">
        <svg viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2">
          <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
        </svg>
      </button>
    `;

    const timeoutId = window.setTimeout(() => {
      this.dismiss(toast.id);
    }, toast.duration);

    element.querySelector('[data-toast-action]')?.addEventListener('click', () => {
      window.clearTimeout(timeoutId);
      toast.action.callback?.();
      this.dismiss(toast.id, { immediate: true });
    });

    element.querySelector('[data-toast-dismiss]')?.addEventListener('click', () => {
      this.dismiss(toast.id);
    });

    this.toasts.push({ ...toast, element, timeoutId });
    this.container.append(element);
    return toast.id;
  }

  dismiss(id, options = {}) {
    const { immediate = false } = options;
    const index = this.toasts.findIndex((toast) => toast.id === id);

    if (index < 0) {
      return;
    }

    const [toast] = this.toasts.splice(index, 1);
    window.clearTimeout(toast.timeoutId);

    if (immediate) {
      toast.element.remove();
      return;
    }

    toast.element.classList.remove('animate-sheet-in');
    toast.element.classList.add('animate-sheet-out');

    window.setTimeout(() => {
      toast.element.remove();
    }, 320);
  }
}

export default ToastManager;
