import { showErrorToast, showToastFromPayload } from './toastHelpers.js';

const THEME_STORAGE_KEY = 'theme';

export class ThemeSwitcher {
  constructor(root = document.body) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    this.themeControl = document.querySelector('select[name="theme"]');
    this.defaultPriorityControl = document.querySelector('select[name="default_priority"]');
    this.defaultViewControl = document.querySelector('select[name="default_view"]');
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.currentTheme = this.root.dataset.theme || 'system';
    this.handleSystemThemeChange = (event) => {
      if (this.currentTheme !== 'system') {
        return;
      }

      this.reflectResolvedTheme(event.matches);
    };

    this.bindEvents();
    this.applyTheme(this.currentTheme, { persist: false, sync: false });
  }

  bindEvents() {
    if (this.themeControl) {
      this.themeControl.value = this.currentTheme;
      this.themeControl.addEventListener('change', () => {
        void this.updateTheme(this.themeControl.value);
      });
    }

    if (typeof this.mediaQuery.addEventListener === 'function') {
      this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
      return;
    }

    if (typeof this.mediaQuery.addListener === 'function') {
      this.mediaQuery.addListener(this.handleSystemThemeChange);
    }
  }

  async updateTheme(theme) {
    this.applyTheme(theme, { persist: true, sync: false });
    await this.persistTheme(theme);
  }

  applyTheme(theme, options = {}) {
    const { persist = true, sync = true } = options;

    this.currentTheme = theme;
    this.root.dataset.theme = theme;
    this.reflectResolvedTheme(theme === 'dark' || (theme === 'system' && this.mediaQuery.matches));

    if (this.themeControl && this.themeControl.value !== theme) {
      this.themeControl.value = theme;
    }

    if (persist) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // ignore storage failures
      }
    }

    if (sync) {
      void this.persistTheme(theme);
    }
  }

  reflectResolvedTheme(useDarkTheme) {
    document.documentElement.classList.toggle('dark', useDarkTheme);
    document.documentElement.style.colorScheme = useDarkTheme ? 'dark' : 'light';
  }

  buildPayload(theme) {
    return {
      theme,
      default_priority: this.defaultPriorityControl?.value || this.root.dataset.defaultPriority || 'medium',
      default_view: this.defaultViewControl?.value || this.root.dataset.defaultView || 'list',
    };
  }

  async persistTheme(theme) {
    const response = await fetch('/profile/preferences', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify(this.buildPayload(theme)),
    });

    if (!response.ok) {
      showErrorToast('We could not update your preferences.');
      return false;
    }

    const payload = await response.json();
    const user = payload.user;

    if (user?.theme_preference) {
      this.root.dataset.theme = user.theme_preference;
      this.root.dataset.defaultPriority = user.default_priority || this.root.dataset.defaultPriority || 'medium';
      this.root.dataset.defaultView = user.default_view || this.root.dataset.defaultView || 'list';
    }

    showToastFromPayload(payload);
    return true;
  }
}

export default ThemeSwitcher;
