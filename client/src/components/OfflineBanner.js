import { showToast } from './toastHelpers.js';

export class OfflineBanner {
  constructor() {
    this.banner = null;
    this.handleOffline = () => this.show();
    this.handleOnline = () => this.hide();

    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('online', this.handleOnline);

    if (!navigator.onLine) {
      this.show();
    }
  }

  show() {
    if (!this.banner) {
      this.banner = document.createElement('div');
      this.banner.dataset.offlineBanner = '';
      this.banner.className = 'fixed inset-x-0 top-16 z-40 bg-md-error-container px-4 py-2 text-center text-md-body-small text-md-on-error-container';
      this.banner.textContent = "You're offline";
      document.body.append(this.banner);
    }

    this.toggleFloatingActions(true);
  }

  hide() {
    this.banner?.remove();
    this.banner = null;
    this.toggleFloatingActions(false);
    showToast({ type: 'success', message: 'Back online' });
  }

  toggleFloatingActions(disabled) {
    document.querySelectorAll('[data-floating-action]').forEach((element) => {
      element.classList.toggle('pointer-events-none', disabled);
      element.classList.toggle('opacity-50', disabled);
    });
  }
}

export default OfflineBanner;
