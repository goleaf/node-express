import EmptyState from './EmptyState.js';
import Haptics from './Haptics.js';
import MultiSelect from './MultiSelect.js';
import SwipeGesture from './SwipeGesture.js';
import { showErrorToast, showToastFromPayload } from './toastHelpers.js';

const priorityClassMap = {
  low: 'bg-md-secondary-container text-md-on-secondary-container',
  medium: 'bg-md-tertiary-container text-md-on-tertiary-container',
  high: 'bg-md-primary-container text-md-on-primary-container',
  urgent: 'bg-md-error-container text-md-on-error-container',
};

const priorityMetaMap = {
  low: { icon: '↓', label: 'Low' },
  medium: { icon: '→', label: 'Medium' },
  high: { icon: '↗', label: 'High' },
  urgent: { icon: '↑', label: 'Urgent' },
};

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

export class TaskList {
  constructor(root = document.querySelector('[data-task-list-page]')) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.listElement = this.root.querySelector('[data-task-list]');
    this.filterChips = [...this.root.querySelectorAll('[data-filter-chip]')];
    this.taskCards = [...this.root.querySelectorAll('[data-task-card]')];
    this.currentFilter = this.root.dataset.currentFilter || 'all';
    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    this.deletedTaskCache = new Map();
    this.multiSelect = new MultiSelect(this.listElement, {
      onCompleteSelected: (taskIds) => {
        void this.bulkAction(taskIds, 'complete');
      },
      onDeleteSelected: (taskIds) => {
        void this.bulkAction(taskIds, 'delete');
      },
      onCancel: () => {
        this.initSwipeGestures();
      },
    });

    this.bindEvents();
    this.initSwipeGestures();
  }

  hydrate() {
    if (!this.root || !this.listElement) {
      return;
    }

    void this.filterTasks(this.currentFilter);
  }

  bindEvents() {
    for (const chip of this.filterChips) {
      chip.addEventListener('click', () => {
        const nextFilter = chip.dataset.filter || 'all';
        void this.filterTasks(nextFilter);
      });
    }

    this.root.addEventListener('click', (event) => {
      if (this.multiSelect?.isSelecting) {
        return;
      }

      const completeButton = event.target.closest('[data-task-complete]');

      if (completeButton) {
        const card = completeButton.closest('[data-task-card]');

        if (card?.dataset.taskId) {
          void this.toggleComplete(card.dataset.taskId);
        }

        return;
      }

      const deleteButton = event.target.closest('[data-task-delete]');

      if (deleteButton) {
        const card = deleteButton.closest('[data-task-card]');

        if (card?.dataset.taskId) {
          void this.deleteTask(card.dataset.taskId);
        }
      }
    });
  }

  async filterTasks(filter) {
    const response = await fetch(`/api/tasks?filter=${encodeURIComponent(filter)}`, {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      showErrorToast('We could not load tasks.');
      return;
    }

    const payload = await response.json();
    this.currentFilter = filter;
    this.root.dataset.currentFilter = filter;
    this.root.dataset.taskListLoading = 'false';
    this.updateActiveChip(filter);
    this.multiSelect?.clearSelection();
    this.renderTasks(payload.tasks || []);
  }

  async toggleComplete(taskId, options = {}) {
    const { haptic = true } = options;
    const card = this.findTaskCard(taskId);

    if (!card) {
      return;
    }

    if (card.dataset.taskStatus === 'completed') {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.csrfToken,
        },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (haptic) {
          Haptics.error();
        }
        showErrorToast('We could not update that task.');
        return;
      }

      const payload = await response.json();
      showToastFromPayload(payload);
      await this.filterTasks(this.currentFilter);
      return;
    }

    const title = card.querySelector('[data-task-title]');
    const button = card.querySelector('[data-task-complete]');
    const snapshot = {
      cardClassName: card.className,
      cardStatus: card.dataset.taskStatus || 'pending',
      titleClassName: title?.className || '',
      buttonClassName: button?.className || '',
      buttonChecked: button?.getAttribute('aria-checked') || 'false',
    };

    this.applyPendingState(card, true);
    this.applyOptimisticCompletion(card);

    const response = await fetch(`/api/tasks/${taskId}/complete`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      if (title) {
        title.className = snapshot.titleClassName;
      }

      if (button) {
        button.className = snapshot.buttonClassName;
        button.setAttribute('aria-checked', snapshot.buttonChecked);
      }

      card.className = snapshot.cardClassName;
      card.dataset.taskStatus = snapshot.cardStatus;
      this.applyPendingState(card, false);

      if (haptic) {
        Haptics.error();
      }

      showErrorToast('We could not update that task.');
      return;
    }

    const payload = await response.json();
    card.dataset.taskStatus = payload.task?.status || 'completed';
    this.applyPendingState(card, false);
    this.listElement?.append(card);
    showToastFromPayload(payload);

    if (haptic) {
      Haptics.complete();
    }
  }

  async deleteTask(taskId, options = {}) {
    const { haptic = true } = options;
    const card = this.findTaskCard(taskId);

    if (!card) {
      return;
    }

    this.deletedTaskCache.set(String(taskId), {
      element: card,
      nextSibling: card.nextElementSibling,
      filter: this.currentFilter,
    });

    card.remove();
    this.ensureEmptyState();

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      this.restoreDeletedCard(taskId);
      this.deletedTaskCache.delete(String(taskId));

      if (haptic) {
        Haptics.error();
      }

      showErrorToast('We could not delete that task.');
      return;
    }

    const payload = await response.json();
    this.showUndoToast(taskId, payload?.toast);

    if (haptic) {
      Haptics.delete();
    }
  }

  async restoreTask(taskId) {
    const response = await fetch(`/api/tasks/${taskId}/restore`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      Haptics.error();
      showErrorToast('We could not restore that task.');
      return;
    }

    const payload = await response.json();
    const restored = this.restoreDeletedCard(taskId);

    if (!restored) {
      await this.filterTasks(this.currentFilter);
    }

    this.deletedTaskCache.delete(String(taskId));
    showToastFromPayload(payload);
  }

  async bulkAction(taskIds, action) {
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return;
    }

    const response = await fetch('/tasks/bulk', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        task_ids: taskIds,
        action,
      }),
    });

    if (!response.ok) {
      Haptics.error();
      showErrorToast('We could not update those tasks.');
      return;
    }

    const payload = await response.json();

    if (action === 'complete') {
      Haptics.complete();
    }

    if (action === 'delete') {
      Haptics.delete();
    }

    showToastFromPayload(payload);
    this.multiSelect?.clearSelection();
    await this.filterTasks(this.currentFilter);
  }

  initSwipeGestures() {
    this.taskCards = [...this.root.querySelectorAll('[data-task-card]')];

    for (const card of this.taskCards) {
      if (card.dataset.swipeReady === 'true') {
        continue;
      }

      card.dataset.swipeReady = 'true';
      const taskId = card.dataset.taskId;

      if (!taskId) {
        continue;
      }

      card.__swipeGesture = new SwipeGesture(card, {
        disabled: () => Boolean(this.multiSelect?.isSelecting),
        onLeftAction: () => {
          void this.deleteTask(taskId, { haptic: false });
        },
        onRightAction: () => {
          void this.toggleComplete(taskId, { haptic: false });
        },
      });
    }
  }

  renderTasks(tasks) {
    if (!this.listElement) {
      return;
    }

    this.listElement.innerHTML =
      tasks.length > 0
        ? tasks.map((task, index) => this.renderTaskCard(task, index)).join('')
        : this.renderEmptyStateCard();

    this.taskCards = [...this.root.querySelectorAll('[data-task-card]')];
    this.multiSelect?.refresh();
    this.initSwipeGestures();
  }

  renderTaskCard(task, index = 0) {
    const completed = task.status === 'completed';
    const priorityClasses = priorityClassMap[task.priority] || priorityClassMap.medium;
    const priorityMeta = priorityMetaMap[task.priority] || { icon: '•', label: escapeHtml(task.priority) };
    const animationDelay = Math.min(index * 30, 150);

    return `
      <article
        data-task-card
        data-task-id="${task.id}"
        data-task-status="${escapeHtml(task.status)}"
        class="animate-task-enter relative overflow-hidden rounded-md-medium border border-md-outline-variant bg-md-surface shadow-sm"
        style="animation-delay: ${animationDelay}ms"
      >
        <div data-swipe-surface class="relative z-10 bg-md-surface p-4">
          <div class="flex items-start gap-3">
            <button
              type="button"
              data-task-complete
              class="touch-target mt-0.5 shrink-0 rounded-md-full border ${completed ? 'border-md-primary bg-md-primary text-md-on-primary' : 'border-md-outline text-md-on-surface-variant'}"
              role="checkbox"
              aria-checked="${completed ? 'true' : 'false'}"
              aria-label="Mark ${escapeHtml(task.title)} as complete"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2">
                <path d="M5 12.5l4 4L19 7.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p data-task-title class="truncate text-md-title-medium ${completed ? 'text-md-on-surface-variant line-through' : 'text-md-on-surface'}">
                    ${escapeHtml(task.title)}
                  </p>
                  ${task.description ? `<p class="mt-1 line-clamp-2 text-md-body-small text-md-on-surface-variant">${escapeHtml(task.description)}</p>` : ''}
                </div>

                <button type="button" data-task-delete class="touch-target shrink-0 rounded-md-full text-md-on-surface-variant" aria-label="Delete task">
                  <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.8">
                    <path d="M4 7h16" stroke-linecap="round" />
                    <path d="M9 7V5h6v2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M7 7l1 12h8l1-12" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <span class="touch-target inline-flex items-center gap-1.5 rounded-md-full px-3 py-1 text-md-label-medium ${priorityClasses}">
                  <span aria-hidden="true">${priorityMeta.icon}</span>
                  <span>${priorityMeta.label}</span>
                </span>
                ${task.due_date ? `<span class="touch-target inline-flex rounded-md-full border border-md-outline px-3 py-1 text-md-label-medium text-md-on-surface-variant">${escapeHtml(task.due_date)}</span>` : ''}
                ${task.primary_category_name ? `<span class="touch-target inline-flex rounded-md-full border border-md-outline-variant px-3 py-1 text-md-label-medium text-md-on-surface-variant">${escapeHtml(task.primary_category_name)}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  renderEmptyStateCard() {
    return EmptyState.renderTasks();
  }

  ensureEmptyState() {
    if (!this.listElement) {
      return;
    }

    const cards = this.listElement.querySelectorAll('[data-task-card]');

    if (cards.length === 0 && !this.listElement.querySelector('[data-empty-state]')) {
      this.listElement.innerHTML = this.renderEmptyStateCard();
      this.multiSelect?.refresh();
    }
  }

  restoreDeletedCard(taskId) {
    const cached = this.deletedTaskCache.get(String(taskId));

    if (!cached?.element || !this.listElement || cached.filter !== this.currentFilter) {
      return false;
    }

    this.listElement.querySelector('[data-empty-state]')?.remove();

    if (cached.nextSibling && cached.nextSibling.isConnected) {
      this.listElement.insertBefore(cached.element, cached.nextSibling);
    } else {
      this.listElement.append(cached.element);
    }

    this.taskCards = [...this.root.querySelectorAll('[data-task-card]')];
    this.multiSelect?.refresh();
    this.initSwipeGestures();
    return true;
  }

  updateActiveChip(filter) {
    for (const chip of this.filterChips) {
      const active = (chip.dataset.filter || 'all') === filter;
      chip.className = `touch-target shrink-0 rounded-md-full px-4 py-2 text-md-label-large transition-colors ${active ? 'bg-md-secondary-container text-md-on-secondary-container' : 'border border-md-outline text-md-on-surface-variant'}`;
    }
  }

  findTaskCard(taskId) {
    return this.root.querySelector(`[data-task-card][data-task-id="${CSS.escape(String(taskId))}"]`);
  }

  applyPendingState(card, pending) {
    card.classList.toggle('opacity-60', pending);
    card.classList.toggle('pointer-events-none', pending);
  }

  applyOptimisticCompletion(card) {
    const title = card.querySelector('[data-task-title]');
    const button = card.querySelector('[data-task-complete]');

    title?.classList.add('animate-task-complete', 'line-through', 'text-md-on-surface-variant');
    title?.classList.remove('text-md-on-surface');
    button?.classList.add('border-md-primary', 'bg-md-primary', 'text-md-on-primary');
    button?.classList.remove('border-md-outline', 'text-md-on-surface-variant');
    button?.setAttribute('aria-checked', 'true');
  }

  showUndoToast(taskId, toast = null) {
    const message = toast?.message || 'Task deleted';

    if (window.Toast?.show) {
      window.Toast.show({
        type: toast?.type || 'success',
        message,
        action: {
          label: 'UNDO',
          callback: () => {
            void this.restoreTask(taskId);
          },
        },
      });
      return;
    }

    const container = document.querySelector('[data-toast-container]') || document.body;
    const toastElement = document.createElement('article');
    toastElement.className = 'pointer-events-auto flex min-h-[48px] items-center gap-3 rounded-md-extra-small bg-md-inverse-surface px-4 py-3 text-md-inverse-on-surface shadow-lg';
    toastElement.innerHTML = `
      <p class=\"min-w-0 flex-1 text-md-body-medium text-md-inverse-on-surface\">${escapeHtml(message)}</p>
      <button type=\"button\" data-undo-delete class=\"touch-target rounded-md-full px-2 text-md-label-large text-md-primary\">UNDO</button>
    `;
    toastElement.querySelector('[data-undo-delete]')?.addEventListener('click', () => {
      void this.restoreTask(taskId);
      toastElement.remove();
    });
    container.append(toastElement);
  }
}

export default TaskList;
