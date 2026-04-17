import { showErrorToast, showToastFromPayload } from './toastHelpers.js';

const emptyStateCopy = {
  categories: 'No categories yet. Add one to group your tasks.',
  tags: 'No tags yet. Add one for quick filtering.',
};

const formCopy = {
  categories: {
    createTitle: 'New category',
    editTitle: 'Edit category',
    subtitle: 'Create a new list color and icon.',
    submitLabel: 'Save category',
    placeholder: 'Personal, Work, Finance',
  },
  tags: {
    createTitle: 'New tag',
    editTitle: 'Edit tag',
    subtitle: 'Create a quick filter label.',
    submitLabel: 'Save tag',
    placeholder: 'Urgent, Deep work, Weekend',
  },
};

const endpointMap = {
  categories: '/categories',
  tags: '/tags',
};

const iconMap = {
  categories: (item) => item.icon || 'folder',
  tags: () => 'sell',
};

const shortCode = (value = '') => String(value).slice(0, 2).toUpperCase();

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

export class CategoryManager {
  constructor(root = document.querySelector('[data-category-manager-page]')) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.categories = this.parseJson('[data-categories-json]');
    this.tags = this.parseJson('[data-tags-json]');
    this.activeTab = this.root.dataset.activeTab === 'tags' ? 'tags' : 'categories';
    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    this.tabButtons = [...this.root.querySelectorAll('[data-manager-tab]')];
    this.panels = {
      categories: this.root.querySelector('[data-manager-panel="categories"]'),
      tags: this.root.querySelector('[data-manager-panel="tags"]'),
    };
    this.listElements = {
      categories: this.root.querySelector('[data-manager-list="categories"]'),
      tags: this.root.querySelector('[data-manager-list="tags"]'),
    };
    this.formShell = this.root.querySelector('[data-manager-form-shell]');
    this.form = this.root.querySelector('[data-manager-form]');
    this.formHeading = this.root.querySelector('[data-form-heading]');
    this.formSubheading = this.root.querySelector('[data-form-subheading]');
    this.submitButton = this.root.querySelector('[data-submit-manager-form]');
    this.openButton = this.root.querySelector('[data-open-manager-form]');
    this.closeButton = this.root.querySelector('[data-close-manager-form]');
    this.nameInput = this.form?.querySelector('input[name="name"]');
    this.idInput = this.form?.querySelector('input[name="id"]');
    this.colorInput = this.form?.querySelector('input[name="color"]');
    this.iconInput = this.form?.querySelector('input[name="icon"]');
    this.colorSwatches = [...this.root.querySelectorAll('[data-color-swatch]')];
    this.iconOptions = [...this.root.querySelectorAll('[data-icon-option]')];
    this.iconSection = this.root.querySelector('[data-icon-section]');
    this.mode = 'create';

    this.bindEvents();
    this.renderAll();
    this.syncActiveTab();
    this.syncFormForTab();
  }

  bindEvents() {
    for (const button of this.tabButtons) {
      button.addEventListener('click', () => {
        this.switchTab(button.dataset.managerTab || 'categories');
      });
    }

    this.openButton?.addEventListener('click', () => {
      this.openForm();
    });

    this.closeButton?.addEventListener('click', () => {
      this.closeForm();
    });

    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });

    this.root.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-edit-item]');

      if (editButton) {
        const kind = editButton.dataset.kind || this.activeTab;
        const itemId = Number(editButton.dataset.itemId);
        const item = this.getCollection(kind).find((entry) => Number(entry.id) === itemId);

        if (item) {
          this.switchTab(kind);
          this.openForm(item);
        }

        return;
      }

      const deleteButton = event.target.closest('[data-delete-item]');

      if (deleteButton) {
        const kind = deleteButton.dataset.kind || this.activeTab;
        const itemId = Number(deleteButton.dataset.itemId);
        void this.deleteItem(kind, itemId);
      }
    });

    for (const swatch of this.colorSwatches) {
      swatch.addEventListener('click', () => {
        this.handleColorSelect(swatch.dataset.color || '');
      });
    }

    for (const option of this.iconOptions) {
      option.addEventListener('click', () => {
        this.handleIconSelect(option.dataset.icon || '');
      });
    }
  }

  parseJson(selector) {
    const element = this.root.querySelector(selector);

    if (!element?.textContent) {
      return [];
    }

    try {
      return JSON.parse(element.textContent);
    } catch {
      return [];
    }
  }

  getCollection(kind = this.activeTab) {
    return kind === 'tags' ? this.tags : this.categories;
  }

  switchTab(tab) {
    this.activeTab = tab === 'tags' ? 'tags' : 'categories';
    this.root.dataset.activeTab = this.activeTab;
    this.syncActiveTab();
    this.syncFormForTab();
    this.clearErrors();

    const nextUrl = this.activeTab === 'tags' ? '/categories?tab=tags' : '/categories';
    window.history.replaceState({}, '', nextUrl);
  }

  openForm(item = null) {
    this.mode = item ? 'edit' : 'create';
    this.formShell?.classList.remove('hidden', 'pointer-events-none');

    if (!this.form) {
      return;
    }

    this.form.reset();
    this.clearErrors();

    const copy = formCopy[this.activeTab];
    this.formHeading.textContent = this.mode === 'edit' ? copy.editTitle : copy.createTitle;
    this.formSubheading.textContent = copy.subtitle;
    this.submitButton.textContent = copy.submitLabel;
    this.nameInput.placeholder = copy.placeholder;

    if (item) {
      this.idInput.value = String(item.id);
      this.nameInput.value = item.name || '';
      this.colorInput.value = item.color || this.colorSwatches[0]?.dataset.color || '';
      this.iconInput.value = item.icon || this.iconOptions[0]?.dataset.icon || '';
    } else {
      this.idInput.value = '';
      this.nameInput.value = '';
      this.colorInput.value = this.colorSwatches[0]?.dataset.color || '';
      this.iconInput.value = this.iconOptions[0]?.dataset.icon || '';
    }

    this.syncColorPicker();
    this.syncIconPicker();
    this.syncFormForTab();
    this.nameInput.focus();
  }

  closeForm() {
    this.formShell?.classList.add('hidden', 'pointer-events-none');
    this.mode = 'create';
    this.clearErrors();
  }

  handleColorSelect(color) {
    this.colorInput.value = color;
    this.syncColorPicker();
  }

  handleIconSelect(icon) {
    this.iconInput.value = icon;
    this.syncIconPicker();
  }

  syncColorPicker() {
    for (const swatch of this.colorSwatches) {
      const active = swatch.dataset.color === this.colorInput.value;
      swatch.setAttribute('aria-pressed', active ? 'true' : 'false');
      swatch.classList.toggle('border-md-on-surface', active);
      swatch.classList.toggle('border-transparent', !active);
    }
  }

  syncIconPicker() {
    for (const option of this.iconOptions) {
      const active = option.dataset.icon === this.iconInput.value;
      option.setAttribute('aria-pressed', active ? 'true' : 'false');
      option.classList.toggle('border-md-primary', active);
      option.classList.toggle('bg-md-primary-container', active);
      option.classList.toggle('text-md-on-primary-container', active);
      option.classList.toggle('border-md-outline', !active);
      option.classList.toggle('text-md-on-surface-variant', !active);
    }
  }

  syncActiveTab() {
    for (const button of this.tabButtons) {
      const active = button.dataset.managerTab === this.activeTab;

      button.classList.toggle('bg-md-secondary-container', active);
      button.classList.toggle('text-md-on-secondary-container', active);
      button.classList.toggle('shadow-sm', active);
      button.classList.toggle('bg-transparent', !active);
      button.classList.toggle('text-md-on-surface-variant', !active);
    }

    for (const [kind, panel] of Object.entries(this.panels)) {
      panel?.classList.toggle('hidden', kind !== this.activeTab);
    }
  }

  syncFormForTab() {
    const categoryMode = this.activeTab === 'categories';
    this.iconSection?.classList.toggle('hidden', !categoryMode);
    this.iconInput.disabled = !categoryMode;

    if (!categoryMode) {
      this.iconInput.value = '';
    } else if (!this.iconInput.value) {
      this.iconInput.value = this.iconOptions[0]?.dataset.icon || 'folder';
    }
  }

  async submit() {
    this.clearErrors();

    const kind = this.activeTab;
    const collection = this.getCollection(kind);
    const snapshot = collection.map((item) => ({ ...item }));
    const payload = {
      name: this.nameInput.value.trim(),
      color: this.colorInput.value,
    };

    if (kind === 'categories') {
      payload.icon = this.iconInput.value;
    }

    const editingId = Number(this.idInput.value);
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = {
      id: this.mode === 'edit' ? editingId : tempId,
      name: payload.name,
      color: payload.color,
      icon: payload.icon || null,
      task_count: this.mode === 'edit'
        ? (collection.find((item) => Number(item.id) === editingId)?.task_count || 0)
        : 0,
      pending: true,
    };

    if (this.mode === 'edit') {
      const index = collection.findIndex((item) => Number(item.id) === editingId);

      if (index >= 0) {
        collection.splice(index, 1, {
          ...collection[index],
          ...optimisticItem,
        });
      }
    } else {
      collection.unshift(optimisticItem);
    }

    this.renderList(kind);

    const method = this.mode === 'edit' ? 'PATCH' : 'POST';
    const endpoint = this.mode === 'edit'
      ? `${endpointMap[kind]}/${editingId}`
      : endpointMap[kind];

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
      this.restoreCollection(kind, snapshot);
      const responsePayload = await response.json();
      this.showErrors(responsePayload.errors || {});
      showErrorToast(`Please fix the ${kind === 'categories' ? 'category' : 'tag'} form errors.`);
      return;
    }

    if (!response.ok) {
      this.restoreCollection(kind, snapshot);
      this.showErrors({
        form: `We could not save this ${kind === 'categories' ? 'category' : 'tag'}.`,
      });
      showErrorToast(`We could not save this ${kind === 'categories' ? 'category' : 'tag'}.`);
      return;
    }

    const responsePayload = await response.json();
    const savedItem = responsePayload.category || responsePayload.tag;
    const currentCollection = this.getCollection(kind);

    if (this.mode === 'edit') {
      const index = currentCollection.findIndex((item) => Number(item.id) === editingId);

      if (index >= 0) {
        currentCollection.splice(index, 1, savedItem);
      }
    } else {
      const index = currentCollection.findIndex((item) => String(item.id) === tempId);

      if (index >= 0) {
        currentCollection.splice(index, 1, savedItem);
      } else {
        currentCollection.unshift(savedItem);
      }
    }

    this.renderList(kind);
    this.closeForm();
    showToastFromPayload(responsePayload);
  }

  async deleteItem(kind, id) {
    const collection = this.getCollection(kind);
    const snapshot = collection.map((item) => ({ ...item }));
    const index = collection.findIndex((item) => Number(item.id) === Number(id));

    if (index < 0) {
      return;
    }

    collection.splice(index, 1);
    this.renderList(kind);

    const response = await fetch(`${endpointMap[kind]}/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
    });

    if (response.ok) {
      const responsePayload = await response.json();
      showToastFromPayload(responsePayload);
      return;
    }

    this.restoreCollection(kind, snapshot);
    showErrorToast(`We could not delete that ${kind === 'categories' ? 'category' : 'tag'}.`);
  }

  restoreCollection(kind, snapshot) {
    if (kind === 'tags') {
      this.tags = snapshot;
    } else {
      this.categories = snapshot;
    }

    this.renderList(kind);
  }

  renderAll() {
    this.renderList('categories');
    this.renderList('tags');
  }

  renderList(kind) {
    const list = this.listElements[kind];
    const collection = this.getCollection(kind);

    if (!list) {
      return;
    }

    if (collection.length === 0) {
      list.innerHTML = `
        <article class="rounded-md-medium border border-dashed border-md-outline bg-md-surface p-4 text-md-body-medium text-md-on-surface-variant">
          ${escapeHtml(emptyStateCopy[kind])}
        </article>
      `;
      return;
    }

    list.innerHTML = collection.map((item) => this.renderCard(item, kind)).join('');
  }

  renderCard(item, kind) {
    const icon = iconMap[kind](item);
    const itemLabel = kind === 'categories' ? 'category' : 'tag';

    return `
      <article class="rounded-md-medium border border-md-outline-variant bg-md-surface p-4 shadow-sm ${item.pending ? 'opacity-70' : ''}">
        <div class="flex items-center gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md-full border shadow-sm"
            style="--item-color:${escapeHtml(item.color || '#6750A4')};--item-color-bg:${escapeHtml(item.color || '#6750A4')}20;--item-color-border:${escapeHtml(item.color || '#6750A4')}66;background-color:var(--item-color-bg);color:var(--item-color);border-color:var(--item-color-border);"
          >
            <span class="text-md-label-medium uppercase tracking-[0.08em]">${escapeHtml(shortCode(icon))}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-md-title-medium text-md-on-surface">${escapeHtml(item.name)}</p>
            <p class="mt-1 touch-target inline-flex rounded-md-full bg-md-surface-variant px-3 py-1 text-md-label-medium text-md-on-surface-variant">
              ${escapeHtml(item.task_count || 0)} tasks
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              data-edit-item
              data-kind="${kind}"
              data-item-id="${escapeHtml(item.id)}"
              class="touch-target rounded-md-full text-md-on-surface-variant"
              aria-label="Edit ${itemLabel}"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.8">
                <path d="M4 20h4l10-10-4-4L4 16v4z" stroke-linejoin="round" />
                <path d="M13 7l4 4" stroke-linecap="round" />
              </svg>
            </button>
            <button
              type="button"
              data-delete-item
              data-kind="${kind}"
              data-item-id="${escapeHtml(item.id)}"
              class="touch-target rounded-md-full text-md-error"
              aria-label="Delete ${itemLabel}"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.8">
                <path d="M4 7h16" stroke-linecap="round" />
                <path d="M9 7V5h6v2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M7 7l1 12h8l1-12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  showErrors(errors) {
    for (const [field, message] of Object.entries(errors)) {
      const target = this.form?.querySelector(`[data-error-for="${field}"]`);

      if (!target) {
        continue;
      }

      target.textContent = String(message);
      target.classList.remove('hidden');
    }
  }

  clearErrors() {
    for (const target of this.form?.querySelectorAll('[data-error-for]') || []) {
      target.textContent = '';
      target.classList.add('hidden');
    }
  }
}
