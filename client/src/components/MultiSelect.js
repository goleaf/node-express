const LONG_PRESS_MS = 500;

export class MultiSelect {
  constructor(listElement, config = {}) {
    this.listElement = listElement;
    this.config = config;
    this.selectedIds = new Set();
    this.isSelecting = false;
    this.longPressTimer = null;
    this.actionBar = this.createActionBar();

    if (!this.listElement) {
      return;
    }

    this.bindEvents();
    this.refresh();
  }

  bindEvents() {
    this.listElement.addEventListener('touchstart', (event) => {
      const card = event.target.closest('[data-task-card]');

      if (!card || event.target.closest('button, a, input, textarea, select, label')) {
        return;
      }

      this.clearLongPressTimer();
      this.longPressTimer = window.setTimeout(() => {
        this.enterSelectionMode(card);
      }, LONG_PRESS_MS);
    }, { passive: true });

    this.listElement.addEventListener('touchmove', () => {
      this.clearLongPressTimer();
    }, { passive: true });

    this.listElement.addEventListener('touchend', () => {
      this.clearLongPressTimer();
    }, { passive: true });

    this.listElement.addEventListener('click', (event) => {
      if (!this.isSelecting) {
        return;
      }

      const card = event.target.closest('[data-task-card]');

      if (!card || event.target.closest('a')) {
        return;
      }

      event.preventDefault();
      this.toggleCard(card);
    });
  }

  createActionBar() {
    const bar = document.createElement('div');
    bar.className = 'pointer-events-none fixed bottom-20 left-0 right-0 z-40 hidden translate-y-full border-t border-md-outline-variant bg-md-surface px-4 py-3 opacity-0 transition duration-300 ease-out';
    bar.innerHTML = `
      <div class="mx-auto flex w-full max-w-md items-center justify-around gap-2 sm:max-w-4xl">
        <button type="button" data-multi-complete class="touch-target rounded-md-full bg-md-secondary-container px-4 py-2 text-md-label-large text-md-on-secondary-container">
          Complete selected
        </button>
        <button type="button" data-multi-delete class="touch-target rounded-md-full bg-md-error-container px-4 py-2 text-md-label-large text-md-on-error-container">
          Delete selected
        </button>
        <button type="button" data-multi-cancel class="touch-target rounded-md-full border border-md-outline px-4 py-2 text-md-label-large text-md-on-surface-variant">
          Cancel
        </button>
      </div>
    `;

    bar.querySelector('[data-multi-complete]')?.addEventListener('click', () => {
      this.config.onCompleteSelected?.(this.getSelectedIds());
    });

    bar.querySelector('[data-multi-delete]')?.addEventListener('click', () => {
      this.config.onDeleteSelected?.(this.getSelectedIds());
    });

    bar.querySelector('[data-multi-cancel]')?.addEventListener('click', () => {
      this.exitSelectionMode();
      this.config.onCancel?.();
    });

    document.body.append(bar);

    return bar;
  }

  enterSelectionMode(card) {
    this.isSelecting = true;
    this.listElement.dataset.selecting = 'true';
    this.toggleCard(card, true);
  }

  exitSelectionMode() {
    this.selectedIds.clear();
    this.isSelecting = false;
    delete this.listElement.dataset.selecting;
    this.syncUi();
  }

  clearSelection() {
    this.exitSelectionMode();
  }

  getSelectedIds() {
    return [...this.selectedIds];
  }

  toggleCard(card, forceSelected = null) {
    const taskId = card?.dataset.taskId;

    if (!taskId) {
      return;
    }

    const shouldSelect = forceSelected ?? !this.selectedIds.has(taskId);

    if (shouldSelect) {
      this.selectedIds.add(taskId);
    } else {
      this.selectedIds.delete(taskId);
    }

    if (this.selectedIds.size === 0) {
      this.exitSelectionMode();
      return;
    }

    this.syncUi();
  }

  refresh() {
    if (!this.listElement) {
      return;
    }

    this.clearLongPressTimer();

    for (const card of this.listElement.querySelectorAll('[data-task-card]')) {
      this.ensureCheckbox(card);
    }

    this.syncUi();
  }

  ensureCheckbox(card) {
    if (card.querySelector('[data-multi-select-wrap]')) {
      return;
    }

    const wrap = document.createElement('div');
    wrap.dataset.multiSelectWrap = 'true';
    wrap.className = 'pointer-events-none absolute left-3 top-3 z-20 hidden';
    wrap.innerHTML = `
      <span class="touch-target rounded-md-full border border-md-outline bg-md-surface">
        <span data-multi-select-checkbox class="hidden h-3 w-3 rounded-full bg-md-primary"></span>
      </span>
    `;

    card.append(wrap);
  }

  syncUi() {
    const cardList = this.listElement ? [...this.listElement.querySelectorAll('[data-task-card]')] : [];

    for (const card of cardList) {
      const selected = this.selectedIds.has(card.dataset.taskId);
      const checkboxWrap = card.querySelector('[data-multi-select-wrap]');
      const checkbox = card.querySelector('[data-multi-select-checkbox]');

      checkboxWrap?.classList.toggle('hidden', !this.isSelecting);
      checkbox?.classList.toggle('hidden', !selected);
      card.classList.toggle('ring-2', selected);
      card.classList.toggle('ring-md-primary', selected);

      for (const button of card.querySelectorAll('[data-task-complete], [data-task-delete]')) {
        button.classList.toggle('hidden', this.isSelecting);
      }
    }

    const active = this.isSelecting && this.selectedIds.size > 0;
    this.actionBar.classList.toggle('hidden', !active);
    this.actionBar.classList.toggle('pointer-events-none', !active);
    this.actionBar.classList.toggle('translate-y-full', !active);
    this.actionBar.classList.toggle('opacity-0', !active);
    this.actionBar.classList.toggle('translate-y-0', active);
    this.actionBar.classList.toggle('opacity-100', active);
  }

  clearLongPressTimer() {
    window.clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }
}

export default MultiSelect;
