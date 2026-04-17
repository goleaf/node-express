const cardClass = 'rounded-md-large border border-dashed border-md-outline-variant bg-md-surface px-6 py-8 text-center';

export class EmptyState {
  static renderTasks() {
    return `
      <article data-empty-state class="${cardClass}">
        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-md-primary-container/50 text-md-primary">
          <svg viewBox="0 0 64 64" class="h-10 w-10 fill-none stroke-current" stroke-width="2.5">
            <rect x="18" y="12" width="28" height="40" rx="6" />
            <path d="M24 22h16" stroke-linecap="round" />
            <path d="M24 30h10" stroke-linecap="round" />
            <path d="m24 40 5 5 11-12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h2 class="mt-5 text-md-headline-small text-md-on-surface">Start your first task</h2>
        <p class="mt-2 text-md-body-medium text-md-on-surface-variant">
          Capture the next thing that matters and keep the list moving.
        </p>
        <a
          href="/tasks/new"
          class="mt-5 inline-flex items-center justify-center rounded-md-full bg-md-primary px-5 py-3 text-md-label-large text-md-on-primary"
        >
          Add first task
        </a>
      </article>
    `;
  }

  static renderSearch() {
    return `
      <article data-search-empty class="${cardClass}">
        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-md-secondary-container/50 text-md-secondary">
          <svg viewBox="0 0 64 64" class="h-10 w-10 fill-none stroke-current" stroke-width="2.5">
            <circle cx="28" cy="28" r="14" />
            <path d="m38 38 10 10" stroke-linecap="round" />
          </svg>
        </div>
        <h2 class="mt-5 text-md-headline-small text-md-on-surface">No results</h2>
        <p class="mt-2 text-md-body-medium text-md-on-surface-variant">
          Try a broader query or remove one of the active filters.
        </p>
      </article>
    `;
  }

  static renderNotifications() {
    return `
      <article data-notification-empty-card class="px-4 py-6 text-center">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-md-tertiary-container/45 text-md-tertiary">
          <svg viewBox="0 0 64 64" class="h-8 w-8 fill-none stroke-current" stroke-width="2.5">
            <path d="M22 28a10 10 0 1 1 20 0v10l6 6H16l6-6Z" stroke-linejoin="round" />
            <path d="M28 50a4 4 0 0 0 8 0" stroke-linecap="round" />
          </svg>
        </div>
        <h2 class="mt-4 text-md-headline-small text-md-on-surface">You&apos;re all caught up</h2>
        <p class="mt-2 text-md-body-medium text-md-on-surface-variant">
          New reminders and alerts will appear here in real time.
        </p>
      </article>
    `;
  }
}

export default EmptyState;
