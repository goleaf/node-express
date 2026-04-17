import { showErrorToast, showToastFromPayload } from './toastHelpers.js';

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

export class TaskDetail {
  constructor(root = document.querySelector('[data-task-detail-page]')) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.taskId = Number(this.root.dataset.taskId);
    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    this.list = this.root.querySelector('[data-subtask-list]');
    this.emptyState = this.root.querySelector('[data-subtask-empty]');
    this.progressBar = this.root.querySelector('[data-progress-bar]');
    this.progressSummary = this.root.querySelector('[data-progress-summary]');
    this.createForm = this.root.querySelector('[data-subtask-create-form]');
    this.createInput = this.root.querySelector('[data-subtask-create-input]');
    this.draggedItem = null;

    this.bindEvents();
    this.refreshProgressFromDom();
  }

  bindEvents() {
    this.list?.addEventListener('change', (event) => {
      const checkbox = event.target.closest('[data-subtask-toggle]');

      if (!checkbox) {
        return;
      }

      const item = checkbox.closest('[data-subtask-item]');

      if (item?.dataset.subtaskId) {
        void this.toggleSubtask(item.dataset.subtaskId, checkbox.checked);
      }
    });

    this.list?.addEventListener('blur', (event) => {
      const input = event.target.closest('[data-subtask-title-input]');

      if (!input) {
        return;
      }

      const item = input.closest('[data-subtask-item]');

      if (item?.dataset.subtaskId) {
        void this.updateSubtaskTitle(item.dataset.subtaskId, input.value, input);
      }
    }, true);

    this.list?.addEventListener('keydown', (event) => {
      const input = event.target.closest('[data-subtask-title-input]');

      if (input && event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });

    this.list?.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('[data-subtask-delete]');

      if (!deleteButton) {
        return;
      }

      const item = deleteButton.closest('[data-subtask-item]');

      if (item?.dataset.subtaskId) {
        void this.deleteSubtask(item.dataset.subtaskId);
      }
    });

    this.list?.addEventListener('dragstart', (event) => {
      const item = event.target.closest('[data-subtask-item]');

      if (!item) {
        return;
      }

      this.draggedItem = item;
      item.classList.add('opacity-60');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.dataset.subtaskId || '');
    });

    this.list?.addEventListener('dragover', (event) => {
      event.preventDefault();
      const target = event.target.closest('[data-subtask-item]');

      if (!target || !this.draggedItem || target === this.draggedItem) {
        return;
      }

      const targetRect = target.getBoundingClientRect();
      const shouldInsertAfter = event.clientY > targetRect.top + targetRect.height / 2;

      if (shouldInsertAfter) {
        target.after(this.draggedItem);
      } else {
        target.before(this.draggedItem);
      }
    });

    this.list?.addEventListener('drop', (event) => {
      event.preventDefault();
      if (!this.draggedItem) {
        return;
      }

      this.draggedItem.classList.remove('opacity-60');
      this.draggedItem = null;
      this.syncSubtaskPositions();
      void this.persistSubtaskOrder();
    });

    this.list?.addEventListener('dragend', () => {
      if (!this.draggedItem) {
        return;
      }

      this.draggedItem.classList.remove('opacity-60');
      this.draggedItem = null;
    });

    this.createForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.createSubtask();
    });
  }

  async createSubtask() {
    const title = this.createInput?.value.trim();

    if (!title) {
      return;
    }

    const response = await fetch('/subtasks', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        task_id: this.taskId,
        title,
      }),
    });

    if (!response.ok) {
      showErrorToast('We could not create that subtask.');
      return;
    }

    const payload = await response.json();
    const subtask = payload.subtask;

    if (!subtask) {
      return;
    }

    this.emptyState?.classList.add('hidden');
    this.list?.insertAdjacentHTML('beforeend', this.renderSubtask(subtask));
    this.createInput.value = '';
    this.syncSubtaskPositions();
    this.refreshProgressFromDom();
    showToastFromPayload(payload);
  }

  async updateSubtaskTitle(subtaskId, title, input) {
    const trimmedTitle = title.trim();
    const previousValue = input.dataset.previousValue ?? input.defaultValue ?? '';

    if (!trimmedTitle || trimmedTitle === previousValue) {
      input.value = previousValue;
      return;
    }

    const response = await fetch(`/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ title: trimmedTitle }),
    });

    if (!response.ok) {
      input.value = previousValue;
      showErrorToast('We could not update that subtask.');
      return;
    }

    const payload = await response.json();
    input.value = payload.subtask?.title || trimmedTitle;
    input.defaultValue = input.value;
    input.dataset.previousValue = input.value;
    showToastFromPayload(payload);
  }

  async toggleSubtask(subtaskId, checked) {
    const response = await fetch(`/subtasks/${subtaskId}/toggle`, {
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
      const item = this.list?.querySelector(`[data-subtask-id="${subtaskId}"]`);
      const checkbox = item?.querySelector('[data-subtask-toggle]');

      if (checkbox) {
        checkbox.checked = !checked;
      }

      this.refreshProgressFromDom();
      showErrorToast('We could not update that subtask.');
      return;
    }

    const payload = await response.json();
    const item = this.list?.querySelector(`[data-subtask-id="${subtaskId}"]`);

    if (item && payload.subtask) {
      item.dataset.completed = payload.subtask.is_completed ? 'true' : 'false';
      item.classList.toggle('bg-md-primary-container/35', Boolean(payload.subtask.is_completed));
      const titleInput = item.querySelector('[data-subtask-title-input]');

      if (titleInput) {
        titleInput.classList.toggle('line-through', Boolean(payload.subtask.is_completed));
        titleInput.classList.toggle('text-md-on-surface-variant', Boolean(payload.subtask.is_completed));
      }
    }

    this.updateProgress(
      Number(payload.completedCount || 0),
      Number(payload.totalCount || 0),
      Number(payload.completionPercentage || 0),
    );
  }

  async deleteSubtask(subtaskId) {
    const item = this.list?.querySelector(`[data-subtask-id="${subtaskId}"]`);

    if (!item) {
      return;
    }

    item.remove();
    this.syncSubtaskPositions();
    this.refreshProgressFromDom();
    this.toggleEmptyState();

    const response = await fetch(`/subtasks/${subtaskId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      showErrorToast('We could not delete that subtask.');
      return;
    }

    const payload = await response.json();
    showToastFromPayload(payload);
  }

  syncSubtaskPositions() {
    const items = [...(this.list?.querySelectorAll('[data-subtask-item]') || [])];

    items.forEach((item, index) => {
      item.dataset.position = String(index);
    });
  }

  async persistSubtaskOrder() {
    const subtasks = [...(this.list?.querySelectorAll('[data-subtask-item]') || [])].map((item, index) => ({
      id: Number(item.dataset.subtaskId),
      position: index,
    }));

    if (!subtasks.length) {
      return;
    }

    const response = await fetch('/subtasks/reorder', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ subtasks }),
    });

    if (!response.ok) {
      showErrorToast('We could not save the new subtask order.');
    }
  }

  refreshProgressFromDom() {
    const items = [...(this.list?.querySelectorAll('[data-subtask-item]') || [])];
    const totalCount = items.length;
    const completedCount = items.filter((item) => item.dataset.completed === 'true').length;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    this.updateProgress(completedCount, totalCount, completionPercentage);
    this.toggleEmptyState();
  }

  updateProgress(completedCount, totalCount, completionPercentage) {
    if (this.progressSummary) {
      this.progressSummary.textContent = `${completedCount} of ${totalCount} subtasks complete`;
    }

    if (this.progressBar) {
      this.progressBar.style.width = `${completionPercentage}%`;
      this.progressBar.setAttribute('aria-valuenow', String(completionPercentage));
    }
  }

  toggleEmptyState() {
    const hasItems = Boolean(this.list?.querySelector('[data-subtask-item]'));
    this.emptyState?.classList.toggle('hidden', hasItems);
  }

  renderSubtask(subtask) {
    const completed = Boolean(subtask.is_completed);

    return `
      <article
        data-subtask-item
        data-subtask-id="${escapeHtml(subtask.id)}"
        data-position="${escapeHtml(subtask.position)}"
        data-completed="${completed ? 'true' : 'false'}"
        draggable="true"
        class="flex items-center gap-3 rounded-md-large border border-md-outline-variant bg-md-surface p-3 shadow-sm"
      >
        <button
          type="button"
          class="touch-target cursor-grab rounded-md-full text-md-on-surface-variant"
          aria-label="Drag to reorder"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.8">
            <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" stroke-linecap="round" />
          </svg>
        </button>
        <label class="touch-target rounded-md-full">
          <input data-subtask-toggle aria-label="Mark ${escapeHtml(subtask.title)} as complete" type="checkbox" class="h-5 w-5 rounded border-md-outline text-md-primary" ${completed ? 'checked' : ''}>
        </label>
        <input
          data-subtask-title-input
          type="text"
          value="${escapeHtml(subtask.title)}"
          class="min-w-0 flex-1 bg-transparent text-md-body-large text-md-on-surface outline-none ${completed ? 'line-through text-md-on-surface-variant' : ''}"
        >
        <button
          type="button"
          data-subtask-delete
          class="touch-target rounded-md-full text-md-error"
          aria-label="Delete subtask"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.8">
            <path d="M4 7h16" stroke-linecap="round" />
            <path d="M9 7V5h6v2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M7 7l1 12h8l1-12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </article>
    `;
  }
}
