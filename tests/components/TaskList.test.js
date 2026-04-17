/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

await jest.unstable_mockModule('../../client/src/components/EmptyState.js', () => ({
  default: {
    renderTasks: () => '<div data-empty-state>empty</div>',
  },
}));

await jest.unstable_mockModule('../../client/src/components/Haptics.js', () => ({
  default: {
    complete: jest.fn(),
    delete: jest.fn(),
    error: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../client/src/components/MultiSelect.js', () => ({
  default: class MultiSelectMock {
    constructor() {
      this.isSelecting = false;
    }

    clearSelection() {}

    refresh() {}
  },
}));

await jest.unstable_mockModule('../../client/src/components/SwipeGesture.js', () => ({
  default: class SwipeGestureMock {},
}));

const { TaskList } = await import('../../client/src/components/TaskList.js');

describe('TaskList undo toast', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <meta name="csrf-token" content="test-token">
      <div data-task-list-page data-current-filter="all">
        <section data-task-list></section>
      </div>
    `;
  });

  it('routes undo clicks from the toast container to restoreTask', () => {
    const root = document.querySelector('[data-task-list-page]');
    const taskList = new TaskList(root);
    taskList.restoreTask = jest.fn();

    taskList.showUndoToast('123');

    const undoButton = document.querySelector('[data-undo-delete]');
    expect(undoButton).not.toBeNull();

    undoButton.click();

    expect(taskList.restoreTask).toHaveBeenCalledWith('123');
  });
});
