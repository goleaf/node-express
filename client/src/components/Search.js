import EmptyState from './EmptyState.js';

const RECENT_SEARCHES_KEY = 'todo-recent-searches';

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const formatLabel = (value = '') => {
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

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

export class Search {
  constructor(root = document.querySelector('[data-search-page]')) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.endpoint = this.root.dataset.searchEndpoint || '/api/tasks/search';
    this.searchInput = this.root.querySelector('[data-search-input]');
    this.filterInputs = [...this.root.querySelectorAll('[data-filter-input]')];
    this.resultsElement = this.root.querySelector('[data-search-results]');
    this.resultsCountElement = this.root.querySelector('[data-results-count]');
    this.activeFilterChips = this.root.querySelector('[data-active-filter-chips]');
    this.recentSearchesShell = this.root.querySelector('[data-recent-searches]');
    this.recentSearchesList = this.root.querySelector('[data-recent-searches-list]');
    this.categories = this.parseJson('[data-categories-json]');
    this.tags = this.parseJson('[data-tags-json]');
    this.pendingSearchTimeout = null;
    this.recentSearches = this.loadRecentSearches();

    this.bindEvents();
    this.renderActiveFilterChips();
    this.renderRecentSearches();
  }

  bindEvents() {
    this.searchInput?.addEventListener('input', () => {
      if (!this.searchInput.value.trim()) {
        this.renderRecentSearches();
        this.showRecentSearches();
      }

      this.queueSearch();
    });

    this.searchInput?.addEventListener('focus', () => {
      if (!this.searchInput.value.trim()) {
        this.showRecentSearches();
      }
    });

    this.searchInput?.addEventListener('blur', () => {
      window.setTimeout(() => this.hideRecentSearches(), 120);
    });

    for (const input of this.filterInputs) {
      input.addEventListener('change', () => {
        this.queueSearch();
      });
    }

    this.activeFilterChips?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-filter]');

      if (!button) {
        return;
      }

      const field = button.dataset.removeFilter;

      if (!field) {
        return;
      }

      this.clearFilter(field);
      this.queueSearch();
    });

    this.recentSearchesList?.addEventListener('mousedown', (event) => {
      const button = event.target.closest('[data-recent-search]');

      if (!button) {
        return;
      }

      event.preventDefault();
      this.searchInput.value = button.dataset.recentSearch || '';
      this.hideRecentSearches();
      void this.performSearch();
    });
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

  queueSearch() {
    window.clearTimeout(this.pendingSearchTimeout);
    this.pendingSearchTimeout = window.setTimeout(() => {
      void this.performSearch();
    }, 400);
  }

  async performSearch() {
    const params = this.buildSearchParams();
    const response = await fetch(`${this.endpoint}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    this.resultsCountElement.textContent = `${payload.total || 0} results`;
    this.renderResults(payload.tasks || []);
    this.renderActiveFilterChips();

    const query = this.searchInput.value.trim();

    if (query) {
      this.addRecentSearch(query);
      this.hideRecentSearches();
    } else if (document.activeElement === this.searchInput) {
      this.renderRecentSearches();
      this.showRecentSearches();
    }
  }

  buildSearchParams() {
    const params = new URLSearchParams();
    const query = this.searchInput.value.trim();

    if (query) {
      params.set('query', query);
    }

    for (const input of this.filterInputs) {
      if (!input.value) {
        continue;
      }

      params.set(input.dataset.filterInput, input.value);
    }

    return params;
  }

  renderResults(tasks) {
    if (!tasks.length) {
      this.resultsElement.innerHTML = EmptyState.renderSearch();
      return;
    }

    this.resultsElement.innerHTML = tasks.map((task) => this.renderTaskCard(task)).join('');
  }

  renderTaskCard(task) {
    const priorityClasses = priorityClassMap[task.priority] || priorityClassMap.medium;
    const priorityMeta = priorityMetaMap[task.priority] || { icon: '•', label: formatLabel(task.priority) };
    const categoryChips = (task.categories || [])
      .map((category) => `
        <span
          class="touch-target inline-flex rounded-md-full border px-3 py-1 text-md-label-medium"
          style="--category-color:${escapeHtml(category.color)};--category-color-bg:${escapeHtml(category.color)}20;--category-color-border:${escapeHtml(category.color)}66;background-color:var(--category-color-bg);color:var(--category-color);border-color:var(--category-color-border);"
        >
          ${escapeHtml(category.name)}
        </span>
      `)
      .join('');
    const tagChips = (task.tags || [])
      .map((tag) => `
        <span
          class="touch-target inline-flex rounded-md-full border px-3 py-1 text-md-label-medium"
          style="--tag-color:${escapeHtml(tag.color || '#6750A4')};--tag-color-bg:${escapeHtml(tag.color || '#6750A4')}20;--tag-color-border:${escapeHtml(tag.color || '#6750A4')}66;background-color:var(--tag-color-bg);color:var(--tag-color);border-color:var(--tag-color-border);"
        >
          ${escapeHtml(tag.name)}
        </span>
      `)
      .join('');

    return `
      <article class="rounded-md-medium border border-md-outline-variant bg-md-surface p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <a href="/tasks/${escapeHtml(task.id)}" class="block truncate text-md-title-medium text-md-on-surface">
              ${escapeHtml(task.title)}
            </a>
            ${task.description ? `<p class="mt-1 line-clamp-2 text-md-body-small text-md-on-surface-variant">${escapeHtml(task.description)}</p>` : ''}
          </div>
          <span class="touch-target inline-flex items-center gap-1.5 rounded-md-full px-3 py-1 text-md-label-medium ${priorityClasses}">
            <span aria-hidden="true">${priorityMeta.icon}</span>
            <span>${escapeHtml(priorityMeta.label)}</span>
          </span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <span class="touch-target inline-flex rounded-md-full border border-md-outline px-3 py-1 text-md-label-medium text-md-on-surface-variant">
            ${escapeHtml(formatLabel(task.status))}
          </span>
          ${task.due_date ? `<span class="touch-target inline-flex rounded-md-full border border-md-outline px-3 py-1 text-md-label-medium text-md-on-surface-variant">${escapeHtml(task.due_date)}</span>` : ''}
          ${categoryChips}
          ${tagChips}
        </div>
      </article>
    `;
  }

  renderActiveFilterChips() {
    const chips = [];
    const query = this.searchInput.value.trim();

    if (query) {
      chips.push(this.renderFilterChip('query', `Query: ${query}`));
    }

    for (const input of this.filterInputs) {
      if (!input.value) {
        continue;
      }

      chips.push(this.renderFilterChip(input.dataset.filterInput, this.resolveFilterLabel(input.dataset.filterInput, input.value)));
    }

    this.activeFilterChips.innerHTML = chips.join('');
  }

  renderFilterChip(field, label) {
    return `
      <button
        type="button"
        data-remove-filter="${escapeHtml(field)}"
        class="touch-target inline-flex items-center gap-2 rounded-md-full bg-md-secondary-container px-3 py-2 text-md-label-medium text-md-on-secondary-container"
      >
        <span>${escapeHtml(label)}</span>
        <span aria-hidden="true">×</span>
      </button>
    `;
  }

  resolveFilterLabel(field, value) {
    switch (field) {
      case 'filter_status':
      case 'filter_priority':
      case 'sort_by':
        return formatLabel(value);
      case 'sort_direction':
        return value.toUpperCase();
      case 'filter_category_id': {
        const category = this.categories.find((entry) => String(entry.id) === String(value));
        return category ? `Category: ${category.name}` : 'Category';
      }
      case 'filter_tag_id': {
        const tag = this.tags.find((entry) => String(entry.id) === String(value));
        return tag ? `Tag: ${tag.name}` : 'Tag';
      }
      case 'date_from':
        return `From: ${value}`;
      case 'date_to':
        return `To: ${value}`;
      default:
        return value;
    }
  }

  clearFilter(field) {
    if (field === 'query') {
      this.searchInput.value = '';
      this.renderRecentSearches();
      this.showRecentSearches();
      return;
    }

    const input = this.filterInputs.find((entry) => entry.dataset.filterInput === field);

    if (input) {
      input.value = '';
    }
  }

  loadRecentSearches() {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  addRecentSearch(query) {
    const unique = [query, ...this.recentSearches.filter((item) => item !== query)].slice(0, 10);
    this.recentSearches = unique;
    window.sessionStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(unique));
    this.renderRecentSearches();
  }

  renderRecentSearches() {
    if (!this.recentSearches.length) {
      this.recentSearchesList.innerHTML = `
        <p class="text-md-body-small text-md-on-surface-variant">Your last 10 searches will appear here.</p>
      `;
      return;
    }

    this.recentSearchesList.innerHTML = this.recentSearches
      .map((search) => `
        <button
          type="button"
          data-recent-search="${escapeHtml(search)}"
          class="rounded-md-full border border-md-outline px-3 py-2 text-md-label-medium text-md-on-surface-variant"
        >
          ${escapeHtml(search)}
        </button>
      `)
      .join('');
  }

  showRecentSearches() {
    this.recentSearchesShell.classList.remove('hidden');
  }

  hideRecentSearches() {
    this.recentSearchesShell.classList.add('hidden');
  }
}
