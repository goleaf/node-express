export class PageTransition {
  constructor() {
    this.activeRequests = 0;
    this.bar = document.createElement('div');
    this.bar.className = 'pointer-events-none fixed left-0 top-0 z-[100] h-[3px] w-0 bg-md-primary opacity-0 transition-all duration-medium2 ease-standard';
    document.body.appendChild(this.bar);
    this.patchFetch();
  }

  patchFetch() {
    if (window.__todoFetchPatched) {
      return;
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const shouldTrack = this.shouldTrack(args);

      if (shouldTrack) {
        this.start();
      }

      try {
        return await originalFetch(...args);
      } finally {
        if (shouldTrack) {
          this.complete();
        }
      }
    };

    window.__todoFetchPatched = true;
  }

  shouldTrack(args) {
    const [resource, init = {}] = args;
    const request = resource instanceof Request ? resource : null;
    const method = String(init.method || request?.method || 'GET').toUpperCase();

    if (method !== 'GET') {
      return false;
    }

    const headers = new Headers(init.headers || request?.headers || {});
    const accept = headers.get('Accept') || '';
    return accept.includes('text/html');
  }

  start() {
    this.activeRequests += 1;

    if (this.activeRequests > 1) {
      return;
    }

    this.bar.classList.remove('opacity-0', 'w-full');
    this.bar.classList.add('opacity-100', 'w-0');

    requestAnimationFrame(() => {
      this.bar.classList.remove('w-0');
      this.bar.classList.add('w-3/4');
    });
  }

  complete() {
    this.activeRequests = Math.max(this.activeRequests - 1, 0);

    if (this.activeRequests > 0) {
      return;
    }

    this.bar.classList.remove('w-3/4');
    this.bar.classList.add('w-full');

    window.setTimeout(() => {
      this.bar.classList.remove('opacity-100', 'w-full');
      this.bar.classList.add('opacity-0', 'w-0');
    }, 220);
  }
}
