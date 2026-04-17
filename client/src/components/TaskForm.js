import { queueToast, showErrorToast } from './toastHelpers.js';

export class TaskForm {
  constructor(root = document.querySelector('[data-task-form-page]')) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.form = this.root.querySelector('[data-task-form]');
    this.mode = this.root.dataset.mode || 'create';
    this.taskId = this.root.dataset.taskId || null;
    this.priorityInput = this.form.querySelector('input[name="priority"]');
    this.prioritySegments = [...this.form.querySelectorAll('[data-priority-segment]')];
    this.categoryChips = [...this.form.querySelectorAll('[data-category-chip]')];
    this.tagChips = [...this.form.querySelectorAll('[data-tag-chip]')];
    this.subtasksList = this.form.querySelector('[data-subtasks-list]');
    this.addSubtaskButton = this.form.querySelector('[data-add-subtask]');
    this.dueDateInput = this.form.querySelector('input[name="due_date"]');
    this.dateDisplay = this.form.querySelector('[data-date-display]');
    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    this.selectedCategories = new Set(
      this.categoryChips.filter((chip) => chip.getAttribute('aria-pressed') === 'true').map((chip) => Number(chip.dataset.categoryId)),
    );
    this.selectedTags = new Set(
      this.tagChips.filter((chip) => chip.getAttribute('aria-pressed') === 'true').map((chip) => Number(chip.dataset.tagId)),
    );

    this.bindEvents();
    this.initDatePicker();
  }

  bindEvents() {
    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });

    for (const segment of this.prioritySegments) {
      segment.addEventListener('click', () => {
        this.priorityInput.value = segment.dataset.value || 'medium';
        this.updatePrioritySegments();
      });
    }

    for (const chip of this.categoryChips) {
      chip.addEventListener('click', () => {
        this.handleCategoryToggle(Number(chip.dataset.categoryId));
      });
    }

    for (const chip of this.tagChips) {
      chip.addEventListener('click', () => {
        this.handleTagToggle(Number(chip.dataset.tagId));
      });
    }

    this.addSubtaskButton?.addEventListener('click', () => {
      this.addSubtask();
    });

    this.subtasksList?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-subtask]');

      if (!removeButton) {
        return;
      }

      const row = removeButton.closest('[data-subtask-row]');
      const index = [...this.subtasksList.querySelectorAll('[data-subtask-row]')].indexOf(row);
      this.removeSubtask(index);
    });
  }

  async submit() {
    this.clearErrors();

    const payload = {
      title: this.form.querySelector('input[name="title"]')?.value.trim() || '',
      description: this.form.querySelector('textarea[name="description"]')?.value.trim() || null,
      priority: this.priorityInput.value || 'medium',
      status: this.form.querySelector('input[name="status"]')?.value || 'pending',
      due_date: this.dueDateInput?.value || null,
      category_ids: [...this.selectedCategories],
      tag_ids: [...this.selectedTags],
      subtasks: [...this.subtasksList.querySelectorAll('[data-subtask-input]')]
        .map((input) => input.value.trim())
        .filter(Boolean),
    };

    const endpoint = this.mode === 'edit' && this.taskId ? `/tasks/${this.taskId}` : '/tasks';
    const method = this.mode === 'edit' && this.taskId ? 'PATCH' : 'POST';

    const response = await fetch(endpoint, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    if (response.status === 422) {
      const payload = await response.json();
      this.showErrors(payload.errors || {});
      return;
    }

    if (!response.ok) {
      this.showErrors({
        title: 'We could not save this task.',
      });
      showErrorToast('We could not save this task.');
      return;
    }

    const payloadJson = await response.json();
    const nextTaskId = payloadJson.task?.id || this.taskId;
    queueToast(payloadJson.toast || { type: 'success', message: this.mode === 'edit' ? 'Task updated' : 'Task created' });

    if (nextTaskId) {
      window.location.href = `/tasks/${nextTaskId}`;
      return;
    }

    window.location.href = '/tasks';
  }

  addSubtask(value = '') {
    if (!this.subtasksList) {
      return;
    }

    const row = document.createElement('div');
    row.dataset.subtaskRow = '';
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
      <input
        type="text"
        data-subtask-input
        value="${this.escapeAttribute(value)}"
        placeholder="New subtask"
        class="w-full rounded-md-extra-small border border-md-outline px-4 py-3 text-md-on-surface outline-none focus:border-2 focus:border-md-primary"
      >
      <button type="button" data-remove-subtask class="touch-target rounded-md-full text-md-on-surface-variant" aria-label="Remove subtask">
        <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2">
          <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
        </svg>
      </button>
    `;

    this.subtasksList.appendChild(row);
    row.querySelector('[data-subtask-input]')?.focus();
  }

  removeSubtask(index) {
    const rows = [...this.subtasksList.querySelectorAll('[data-subtask-row]')];

    if (rows.length <= 1) {
      const input = rows[0]?.querySelector('[data-subtask-input]');

      if (input) {
        input.value = '';
        input.focus();
      }

      return;
    }

    rows[index]?.remove();
  }

  handleCategoryToggle(id) {
    if (this.selectedCategories.has(id)) {
      this.selectedCategories.delete(id);
    } else {
      this.selectedCategories.add(id);
    }

    this.updateSelectableChipState(this.categoryChips, this.selectedCategories, 'categoryId');
  }

  handleTagToggle(id) {
    if (this.selectedTags.has(id)) {
      this.selectedTags.delete(id);
    } else {
      this.selectedTags.add(id);
    }

    this.updateSelectableChipState(this.tagChips, this.selectedTags, 'tagId');
  }

  showErrors(errors) {
    for (const [field, message] of Object.entries(errors)) {
      const target = this.form.querySelector(`[data-error-for="${field}"]`);

      if (!target) {
        continue;
      }

      target.textContent = String(message);
      target.classList.remove('hidden');
    }
  }

  clearErrors() {
    for (const target of this.form.querySelectorAll('[data-error-for]')) {
      target.textContent = '';
      target.classList.add('hidden');
    }
  }

  initDatePicker() {
    if (!this.dueDateInput || !this.dateDisplay) {
      return;
    }

    const formatDate = () => {
      if (!this.dueDateInput.value) {
        this.dateDisplay.textContent = 'No due date selected.';
        return;
      }

      const selectedDate = new Date(`${this.dueDateInput.value}T00:00:00`);

      if (Number.isNaN(selectedDate.getTime())) {
        this.dateDisplay.textContent = '';
        return;
      }

      this.dateDisplay.textContent = new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(selectedDate);
    };

    formatDate();
    this.dueDateInput.addEventListener('change', formatDate);
  }

  updatePrioritySegments() {
    for (const segment of this.prioritySegments) {
      const active = segment.dataset.value === this.priorityInput.value;

      segment.classList.toggle('bg-md-secondary-container', active);
      segment.classList.toggle('text-md-on-secondary-container', active);
      segment.classList.toggle('bg-transparent', !active);
      segment.classList.toggle('text-md-on-surface-variant', !active);
    }
  }

  updateSelectableChipState(chips, selectedSet, dataKey) {
    for (const chip of chips) {
      const id = Number(chip.dataset[dataKey]);
      const selected = selectedSet.has(id);

      chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      chip.classList.toggle('border-transparent', selected);
      chip.classList.toggle('bg-md-primary-container', selected);
      chip.classList.toggle('text-md-on-primary-container', selected);
      chip.classList.toggle('border-md-outline', !selected);
      chip.classList.toggle('text-md-on-surface-variant', !selected);
    }
  }

  escapeAttribute(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}

export default TaskForm;
