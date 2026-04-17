export class BottomSheet {
  constructor(root) {
    this.root = root;

    if (!this.root) {
      return;
    }

    this.backdrop = this.root.querySelector('[data-bottom-sheet-backdrop]');
    this.sheet = this.root.querySelector('[data-bottom-sheet-panel]');
    this.handle = this.root.querySelector('[data-bottom-sheet-handle]');
    this.closeButtons = [...this.root.querySelectorAll('[data-bottom-sheet-close]')];
    this.dragState = null;
    this.beforeOpenFocus = null;
    this.focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    this.handleKeydown = this.handleKeydown.bind(this);

    this.applyShellClasses();
    this.bindEvents();
  }

  static boot() {
    return [...document.querySelectorAll('[data-bottom-sheet]')].map((element) => {
      const sheet = new BottomSheet(element);
      const sheetId = element.getAttribute('id');

      if (sheetId) {
        document.querySelectorAll(`[data-bottom-sheet-trigger="${sheetId}"]`).forEach((trigger) => {
          trigger.addEventListener('click', (event) => {
            event.preventDefault();
            sheet.open();
          });
        });
      }

      return sheet;
    });
  }

  applyShellClasses() {
    this.root.classList.add('fixed', 'inset-0', 'z-50', 'hidden');
    this.backdrop?.classList.add('absolute', 'inset-0', 'bg-scrim/50', 'opacity-0', 'transition-opacity', 'duration-[400ms]', 'ease-[cubic-bezier(0,0,0,1)]');
    this.sheet?.classList.add(
      'absolute',
      'bottom-0',
      'left-0',
      'right-0',
      'max-h-[90vh]',
      'overflow-y-auto',
      'rounded-t-md-extra-large',
      'bg-md-surface',
      'pb-[env(safe-area-inset-bottom)]',
      'translate-y-full',
      'transition-transform',
      'duration-[400ms]',
      'ease-[cubic-bezier(0,0,0,1)]',
      'will-change-transform',
    );
    this.sheet?.setAttribute('tabindex', '-1');
  }

  bindEvents() {
    this.backdrop?.addEventListener('click', () => this.close());
    this.closeButtons.forEach((button) => button.addEventListener('click', () => this.close()));

    this.handle?.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];

      this.dragState = {
        startY: touch.clientY,
        currentY: touch.clientY,
      };
    }, { passive: true });

    this.handle?.addEventListener('touchmove', (event) => {
      if (!this.dragState || !this.sheet) {
        return;
      }

      const touch = event.touches[0];
      this.dragState.currentY = touch.clientY;
      const deltaY = Math.max(touch.clientY - this.dragState.startY, 0);
      this.sheet.style.transform = `translateY(${deltaY}px)`;
    }, { passive: true });

    this.handle?.addEventListener('touchend', () => {
      if (!this.dragState || !this.sheet) {
        return;
      }

      const deltaY = this.dragState.currentY - this.dragState.startY;
      this.dragState = null;

      if (deltaY > 96) {
        this.close();
        return;
      }

      this.sheet.style.transform = 'translateY(0)';
    });
  }

  getFocusableElements() {
    if (!this.sheet) {
      return [];
    }

    return [...this.sheet.querySelectorAll(this.focusableSelector)].filter((element) => {
      return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true';
    });
  }

  handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = this.getFocusableElements();

    if (focusableElements.length === 0) {
      event.preventDefault();
      this.sheet?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  open() {
    this.beforeOpenFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.root.classList.remove('hidden');
    document.addEventListener('keydown', this.handleKeydown);

    requestAnimationFrame(() => {
      this.backdrop?.classList.remove('opacity-0');
      this.backdrop?.classList.add('opacity-100');
      this.sheet?.classList.remove('translate-y-full');
      this.sheet?.classList.add('translate-y-0');
      if (this.sheet) {
        this.sheet.style.transform = 'translateY(0)';
      }

      const focusableElements = this.getFocusableElements();
      (focusableElements[0] || this.sheet)?.focus();
    });
  }

  close() {
    document.removeEventListener('keydown', this.handleKeydown);
    this.backdrop?.classList.remove('opacity-100');
    this.backdrop?.classList.add('opacity-0');
    this.sheet?.classList.remove('translate-y-0');
    this.sheet?.classList.add('translate-y-full');
    if (this.sheet) {
      this.sheet.style.transform = '';
    }

    window.setTimeout(() => {
      this.root.classList.add('hidden');
      this.beforeOpenFocus?.focus();
    }, 400);
  }
}
