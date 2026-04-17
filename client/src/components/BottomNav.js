export class BottomNav {
  constructor(navs = [...document.querySelectorAll('[data-bottom-nav]')]) {
    this.navs = navs;

    if (!this.navs.length) {
      return;
    }

    this.navs.forEach((nav) => this.bindNav(nav));
  }

  bindNav(nav) {
    const items = [...nav.querySelectorAll('[data-bottom-nav-item]')];

    if (!items.length) {
      return;
    }

    const activeItem = items.find((item) => item.getAttribute('aria-current') === 'page') || items[0];
    this.syncTabIndexes(items, activeItem);

    nav.addEventListener('focusin', (event) => {
      const nextItem = event.target.closest('[data-bottom-nav-item]');

      if (!nextItem) {
        return;
      }

      this.syncTabIndexes(items, nextItem);
    });

    nav.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      const currentIndex = items.findIndex((item) => item === document.activeElement);

      if (currentIndex === -1) {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + items.length) % items.length;
      const nextItem = items[nextIndex];

      this.syncTabIndexes(items, nextItem);
      nextItem.focus();
    });
  }

  syncTabIndexes(items, activeItem) {
    items.forEach((item) => {
      item.tabIndex = item === activeItem ? 0 : -1;
    });
  }
}
