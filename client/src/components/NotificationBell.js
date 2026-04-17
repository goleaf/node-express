import EmptyState from './EmptyState.js';

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

export class NotificationBell {
  constructor(root = document.querySelector('[data-notification-root]')) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.bellButton = this.root.querySelector('[data-notification-bell]');
    this.badge = this.root.querySelector('[data-notification-badge]');
    this.dropdown = this.root.querySelector('[data-notification-dropdown]');
    this.list = this.root.querySelector('[data-notification-list]');
    this.emptyState = this.root.querySelector('[data-notification-empty]');
    this.markAllButton = this.root.querySelector('[data-notification-mark-all]');
    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    this.notifications = [];
    this.unreadCount = 0;
    this.eventSource = null;

    this.bindEvents();
    void this.loadInitialNotifications();
    this.connectStream();
  }

  bindEvents() {
    this.bellButton?.addEventListener('click', () => {
      this.toggleDropdown();
    });

    this.markAllButton?.addEventListener('click', () => {
      void this.markAllAsRead();
    });

    this.list?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mark-notification-read]');

      if (!button) {
        return;
      }

      void this.markAsRead(button.dataset.notificationId);
    });

    document.addEventListener('click', (event) => {
      if (!this.root.contains(event.target)) {
        this.dropdown?.classList.add('hidden');
      }
    });
  }

  async loadInitialNotifications() {
    const response = await fetch('/notifications', {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    this.notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
    this.unreadCount = Number(payload.unreadCount || 0);
    this.render();
  }

  connectStream() {
    this.eventSource = new EventSource('/notifications/stream');
    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const notification = payload.notification;

        if (!notification) {
          return;
        }

        this.notifications.unshift(notification);
        this.unreadCount += 1;
        this.render();
        this.playNotificationSound();
      } catch {
        // ignore malformed payloads
      }
    };
  }

  async markAsRead(id) {
    const response = await fetch(`/notifications/${id}/read`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const notification = payload.notification;

    this.notifications = this.notifications.map((entry) =>
      Number(entry.id) === Number(id) ? notification : entry,
    );
    this.unreadCount = Number(payload.unreadCount || 0);
    this.render();
  }

  async markAllAsRead() {
    const response = await fetch('/notifications/read-all', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return;
    }

    this.notifications = this.notifications.map((notification) => ({
      ...notification,
      read_at: notification.read_at || new Date().toISOString(),
    }));
    this.unreadCount = 0;
    this.render();
  }

  toggleDropdown() {
    this.dropdown?.classList.toggle('hidden');
  }

  playNotificationSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    try {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.04, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);
      oscillator.onended = () => context.close();
    } catch {
      // browsers can block audio without interaction
    }
  }

  render() {
    if (this.bellButton) {
      this.bellButton.setAttribute('aria-label', `Notifications, ${this.unreadCount} unread`);
    }

    if (this.badge) {
      this.badge.textContent = String(this.unreadCount);
      this.badge.setAttribute('aria-label', `${this.unreadCount} unread notifications`);
      this.badge.classList.toggle('hidden', this.unreadCount === 0);
    }

    if (this.emptyState) {
      this.emptyState.innerHTML = EmptyState.renderNotifications();
      this.emptyState.classList.toggle('hidden', this.notifications.length > 0);
    }

    if (this.list) {
      this.list.innerHTML = this.notifications.map((notification) => this.renderNotification(notification)).join('');
    }
  }

  renderNotification(notification) {
    const message = notification.data?.message || notification.type;
    const taskTitle = notification.data?.taskTitle;
    const isRead = Boolean(notification.read_at);

    return `
      <article class="border-b border-md-outline-variant px-4 py-3 ${isRead ? 'opacity-70' : ''}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-md-label-large text-md-on-surface">${escapeHtml(message)}</p>
            ${taskTitle ? `<p class="mt-1 text-md-body-small text-md-on-surface-variant">${escapeHtml(taskTitle)}</p>` : ''}
            <p class="mt-2 text-xs text-md-on-surface-variant">${escapeHtml(notification.created_at || '')}</p>
          </div>
          ${isRead ? '' : `
            <button
              type="button"
              data-mark-notification-read
              data-notification-id="${escapeHtml(notification.id)}"
              class="shrink-0 rounded-md-full bg-md-secondary-container px-3 py-1 text-md-label-medium text-md-on-secondary-container"
            >
              Read
            </button>
          `}
        </div>
      </article>
    `;
  }
}
