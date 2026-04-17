export class OnboardingFlow {
  constructor(root = document.querySelector('[data-onboarding-page]')) {
    this.root = root;
    this.previewBadgeBaseClass =
      'touch-target inline-flex items-center gap-1.5 rounded-md-full px-3 py-1 text-md-label-medium';
    this.priorityConfig = {
      low: {
        label: 'Low',
        icon: '↓',
        classes: 'bg-md-secondary-container text-md-on-secondary-container',
      },
      medium: {
        label: 'Medium',
        icon: '→',
        classes: 'bg-md-tertiary-container text-md-on-tertiary-container',
      },
      high: {
        label: 'High',
        icon: '↗',
        classes: 'bg-md-primary-container text-md-on-primary-container',
      },
      urgent: {
        label: 'Urgent',
        icon: '↑',
        classes: 'bg-md-error-container text-md-on-error-container',
      },
    };

    if (!this.root) {
      return;
    }

    this.beforeNavigateClass = 'animate-onboarding-exit';
    this.titleInput = this.root.querySelector('[data-onboarding-task-title]');
    this.priorityInput = this.root.querySelector('[data-onboarding-task-priority]');
    this.previewTitle = this.root.querySelector('[data-onboarding-preview-title]');
    this.previewBadge = this.root.querySelector('[data-onboarding-preview-priority]');
    this.previewPriorityIcon = this.root.querySelector('[data-onboarding-preview-priority-icon]');
    this.previewPriorityLabel = this.root.querySelector('[data-onboarding-preview-priority-label]');
    this.themeInput = this.root.querySelector('[data-onboarding-theme-input]');
    this.themeOptions = Array.from(this.root.querySelectorAll('[data-theme-option]'));

    this.initTaskPreview();
    this.initThemeSelection();
    this.bindEvents();
  }

  initTaskPreview() {
    if (!this.titleInput || !this.priorityInput || !this.previewTitle || !this.previewBadge) {
      return;
    }

    const syncPreview = () => {
      const title = this.titleInput.value.trim() || this.titleInput.getAttribute('placeholder') || 'Plan the week';
      const priority = this.priorityInput.value || 'medium';
      const config = this.priorityConfig[priority] || this.priorityConfig.medium;

      this.previewTitle.textContent = title;
      this.previewBadge.className = `${this.previewBadgeBaseClass} ${config.classes}`;

      if (this.previewPriorityIcon) {
        this.previewPriorityIcon.textContent = config.icon;
      }

      if (this.previewPriorityLabel) {
        this.previewPriorityLabel.textContent = config.label;
      }
    };

    this.titleInput.addEventListener('input', syncPreview);
    this.priorityInput.addEventListener('change', syncPreview);
    syncPreview();
  }

  initThemeSelection() {
    if (!this.themeInput || this.themeOptions.length === 0) {
      return;
    }

    this.applyThemeSelection(this.themeInput.value || 'system');
  }

  bindEvents() {
    this.root.addEventListener('click', (event) => {
      const link = event.target.closest('[data-onboarding-link]');
      const themeOption = event.target.closest('[data-theme-option]');

      if (themeOption) {
        event.preventDefault();
        this.applyThemeSelection(themeOption.dataset.themeOption);
        return;
      }

      if (!link || !link.href) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      this.navigate(link.href);
    });
  }

  applyThemeSelection(theme) {
    if (!this.themeInput) {
      return;
    }

    const normalizedTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';

    this.themeInput.value = normalizedTheme;

    this.themeOptions.forEach((option) => {
      const isActive = option.dataset.themeOption === normalizedTheme;

      option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      option.classList.toggle('bg-md-primary', isActive);
      option.classList.toggle('text-md-on-primary', isActive);
      option.classList.toggle('text-md-on-surface-variant', !isActive);
    });

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = normalizedTheme === 'dark' || (normalizedTheme === 'system' && prefersDark);

    document.documentElement.classList.toggle('dark', shouldUseDark);
  }

  navigate(href) {
    this.root.classList.add(this.beforeNavigateClass);

    window.setTimeout(() => {
      window.location.href = href;
    }, 400);
  }
}
