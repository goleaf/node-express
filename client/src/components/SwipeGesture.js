import Haptics from './Haptics.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class SwipeGesture {
  constructor(element, config = {}) {
    this.element = element;
    this.config = config;
    this.surface = this.element?.querySelector('[data-swipe-surface]');
    this.leftAction = null;
    this.touchState = null;
    this.currentX = 0;
    this.isOpen = false;

    if (!this.element || !this.surface) {
      return;
    }

    this.leftAction = this.ensureLeftAction();
    this.bindEvents();
  }

  bindEvents() {
    this.surface.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: true });
    this.surface.addEventListener('touchmove', (event) => this.handleTouchMove(event), { passive: false });
    this.surface.addEventListener('touchend', () => this.handleTouchEnd());
    this.surface.addEventListener('touchcancel', () => this.reset());

    this.element.addEventListener('click', (event) => {
      if (!this.isOpen) {
        return;
      }

      const actionButton = event.target.closest('[data-swipe-left-action]');

      if (!actionButton) {
        this.reset();
      }
    });

    this.leftAction?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      Haptics.delete();
      this.config.onLeftAction?.();
      this.reset();
    });
  }

  ensureLeftAction() {
    let action = this.element.querySelector('[data-swipe-left-action]');

    if (action) {
      return action;
    }

    action = document.createElement('button');
    action.type = 'button';
    action.dataset.swipeLeftAction = 'true';
    action.className = 'absolute inset-y-0 right-0 flex w-16 items-center justify-center bg-md-error text-md-on-error';
    action.setAttribute('aria-label', 'Delete task');
    action.innerHTML = `
      <svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.8">
        <path d="M4 7h16" stroke-linecap="round" />
        <path d="M9 7V5h6v2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M7 7l1 12h8l1-12" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;

    this.element.append(action);

    return action;
  }

  handleTouchStart(event) {
    if (this.isDisabled() || event.target.closest('button, a, input, textarea, select, label')) {
      return;
    }

    const touch = event.touches[0];
    this.touchState = {
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      startedAt: Date.now(),
      dragging: false,
    };

    this.surface.style.transition = 'none';
  }

  handleTouchMove(event) {
    if (!this.touchState || this.isDisabled()) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchState.startX;
    const deltaY = touch.clientY - this.touchState.startY;

    if (!this.touchState.dragging && Math.abs(deltaY) > Math.abs(deltaX)) {
      this.touchState = null;
      this.surface.style.transition = '';
      return;
    }

    this.touchState.dragging = true;
    this.touchState.deltaX = deltaX;
    this.currentX = clamp(deltaX, -96, 96);

    if (Math.abs(this.currentX) > 2) {
      event.preventDefault();
    }

    this.surface.style.transform = `translateX(${this.currentX}px)`;
  }

  handleTouchEnd() {
    if (!this.touchState) {
      return;
    }

    const elapsed = Math.max(Date.now() - this.touchState.startedAt, 1);
    const velocity = this.touchState.deltaX / elapsed;
    const deltaX = this.touchState.deltaX;

    this.touchState = null;

    if (deltaX < -60 || velocity < -0.45) {
      this.snapTo(-64, velocity);
      this.isOpen = true;
      return;
    }

    if (deltaX > 60 || velocity > 0.45) {
      this.snapTo(0, velocity);
      this.isOpen = false;
      Haptics.complete();
      this.config.onRightAction?.();
      return;
    }

    this.reset(velocity);
  }

  reset(velocity = 0) {
    this.snapTo(0, velocity);
    this.isOpen = false;
  }

  snapTo(targetX, velocity = 0) {
    const duration = clamp(260 - Math.abs(velocity * 220), 140, 260);
    this.currentX = targetX;
    this.surface.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    this.surface.style.transform = `translateX(${targetX}px)`;
  }

  isDisabled() {
    return Boolean(this.config.disabled?.());
  }
}

export default SwipeGesture;
