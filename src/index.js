import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'todos.json');

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', token: 'success' },
  { value: 'medium', label: 'Medium', token: 'info' },
  { value: 'high', label: 'High', token: 'warning' },
  { value: 'urgent', label: 'Urgent', token: 'error' },
];

const RECOVERY_WINDOW_DAYS = 30;
const RECOVERY_WINDOW_MS = RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'General', color: '#3b82f6', icon: '🗂️' },
  { id: 2, name: 'Work', color: '#f59e0b', icon: '💼' },
  { id: 3, name: 'Personal', color: '#10b981', icon: '🏠' },
  { id: 4, name: 'Finance', color: '#ec4899', icon: '💳' },
];

const DUE_GROUPS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'later', label: 'Later' },
];

const SMART_LISTS = {
  all: 'All Tasks',
  today: 'Today',
  starred: 'Starred',
  completed: 'Completed',
  trash: 'Trash',
};

const SORT_OPTIONS = [
  { value: 'position', label: 'Manual' },
  { value: 'due', label: 'Due Date' },
  { value: 'created', label: 'Created Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

const PRIORITY_WEIGHT = Object.fromEntries(PRIORITY_OPTIONS.map((item, index) => [item.value, index]));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const PRIORITY_MAP = Object.fromEntries(PRIORITY_OPTIONS.map((item) => [item.value, item]));

const sanitizeColor = (value, fallback = '#64748b') => {
  const color = String(value || '').trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
};

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const safeScriptJson = (value) => {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
};

const parseId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseIds = (value) => {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  const ids = [];
  for (const raw of values) {
    const id = parseId(raw);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
};

const parseTags = (value = '') => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  return [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))];
};

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === '1' || value === 1 || value === 'true' || value === 'on' || value === 'yes') {
    return true;
  }
  if (value === '0' || value === 0 || value === 'false' || value === 'off' || value === 'no') {
    return false;
  }
  return defaultValue;
};

const escapeRegExp = (value) => {
  return String(value).replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeSort = (value) => {
  const sort = String(value || 'position').trim().toLowerCase();
  return SORT_OPTIONS.some((option) => option.value === sort) ? sort : 'position';
};

const normalizeStatusFilter = (value) => {
  const normalized = String(value || 'all').trim().toLowerCase();
  if (normalized === 'done' || normalized === 'open') {
    return normalized;
  }
  return 'all';
};

const normalizeDateFilter = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : raw;
};

const parseDateBoundary = (value, atEnd = false) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(atEnd ? 23 : 0, atEnd ? 59 : 0, atEnd ? 59 : 0, atEnd ? 999 : 0);
  return parsed.getTime();
};

const toDateMillis = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.getTime();
};

const normalizeFilterFromSource = (source, categories = [], presets = []) => {
  const payload = source?.filters ? source.filters : source;
  const presetId = parseId(payload?.presetId);
  const matchedPreset =
    presetId && Array.isArray(presets)
      ? presets.find((preset) => Number(preset?.id) === presetId)
      : null;

  const merged = {
    ...(matchedPreset?.filters || {}),
    ...(payload || {}),
  };

  const normalizedSmart = normalizeSmartFilter({
    smart: merged.smart,
    status: merged.status || merged.statusFilter,
  });

  const categoryId = resolveCategoryId(merged.categoryId ?? merged.category, categories);
  const tags = parseTags(merged.tag || merged.tags);
  const dueFrom = normalizeDateFilter(merged.dueFrom || merged.from);
  const dueTo = normalizeDateFilter(merged.dueTo || merged.to);
  const safeDueFrom = parseDateBoundary(dueFrom);
  const safeDueTo = parseDateBoundary(dueTo, true);

  const fromToDateOk = safeDueFrom === null || safeDueTo === null || safeDueFrom <= safeDueTo;

  const search = String(merged.q || merged.search || '').trim();

  return {
    smart: normalizedSmart.smart,
    statusFilter: normalizedSmart.statusFilter,
    search,
    priorityFilter: PRIORITY_MAP[String(merged.priority || 'all').trim()] ? String(merged.priority).trim() : 'all',
    categoryId: merged.categoryId || merged.category ? categoryId : null,
    tags,
    dueFrom: fromToDateOk ? dueFrom : '',
    dueTo: fromToDateOk ? dueTo : '',
    sort: normalizeSort(merged.sort),
    presetId,
    smartSource: merged.smart || null,
  };
};

const normalizeFilterForStorage = (filters) => ({
  smart: filters.smart === 'all' ? null : filters.smart,
  status: filters.statusFilter === 'all' ? null : filters.statusFilter,
  q: filters.search || null,
  priority: filters.priorityFilter === 'all' ? null : filters.priorityFilter,
  categoryId: filters.categoryId || null,
  tags: filters.tags?.length ? filters.tags.join(',') : null,
  dueFrom: filters.dueFrom || null,
  dueTo: filters.dueTo || null,
  sort: filters.sort === 'position' ? null : filters.sort,
});

const buildFilterQuery = (filterState = {}, overrides = {}) => {
  const active = {
    ...filterState,
    ...overrides,
  };
  const normalizedStatus = active.statusFilter || active.status || 'all';
  const hasTagsOverride = Object.prototype.hasOwnProperty.call(overrides, 'tags');
  const explicitTags = Object.prototype.hasOwnProperty.call(overrides, 'tags') ? overrides.tags : null;
  const hasTagOverride = Object.prototype.hasOwnProperty.call(overrides, 'tag');
  const explicitTag = hasTagOverride ? overrides.tag : null;
  const params = new URLSearchParams();

  if (active.smart && active.smart !== 'all') {
    params.set('smart', active.smart);
  }
  if (normalizedStatus && normalizedStatus !== 'all') {
    params.set('status', normalizedStatus);
  }
  if (active.search) {
    params.set('q', active.search);
  }
  if (active.priorityFilter && active.priorityFilter !== 'all') {
    params.set('priority', active.priorityFilter);
  }
  if (active.categoryId) {
    params.set('categoryId', String(active.categoryId));
  }
  const nextTags =
    hasTagsOverride && Array.isArray(explicitTags)
      ? explicitTags
      : hasTagsOverride
        ? parseTags(explicitTags)
        : hasTagOverride
          ? parseTags(explicitTag)
          : active.tags;
  if (nextTags?.length) {
    for (const tag of [...new Set((nextTags || []).map((item) => String(item || '').trim()).filter(Boolean))]) {
      params.append('tag', tag);
    }
  }
  if (active.dueFrom) {
    params.set('dueFrom', active.dueFrom);
  }
  if (active.dueTo) {
    params.set('dueTo', active.dueTo);
  }
  if (active.sort && active.sort !== 'position') {
    params.set('sort', active.sort);
  }
  if (active.presetId) {
    params.set('presetId', String(active.presetId));
  }

  return params.toString();
};

const normalizeCategory = (category = {}) => {
  const fallback = DEFAULT_CATEGORIES[0];
  const normalized = {
    id: parseId(category.id) || fallback.id,
    name: String(category.name || fallback.name).trim() || fallback.name,
    icon: String(category.icon || fallback.icon).trim() || fallback.icon,
    color: sanitizeColor(category.color || fallback.color, fallback.color),
  };
  return normalized;
};

const nextCategoryId = (categories = []) => {
  const ids = categories.map((category) => parseId(category.id)).filter(Boolean);
  return ids.length ? Math.max(...ids) + 1 : 1;
};

const normalizeAndDeduplicateCategories = (rawCategories = []) => {
  const provided = Array.isArray(rawCategories) ? rawCategories : [];
  const normalized = [...provided, ...DEFAULT_CATEGORIES].map(normalizeCategory);

  const byName = new Set();
  const byId = new Set();
  const prepared = [];

  let cursor = 1;
  for (const category of normalized) {
    const key = category.name.toLowerCase();
    if (byName.has(key)) {
      continue;
    }
    let id = category.id;
    if (!Number.isFinite(id) || byId.has(id)) {
      while (byId.has(cursor)) {
        cursor += 1;
      }
      id = cursor;
      cursor += 1;
    }
    byName.add(key);
    byId.add(id);
    prepared.push({
      id,
      name: category.name,
      icon: String(category.icon || '🏷️').trim() || '🏷️',
      color: sanitizeColor(category.color),
    });
  }

  if (!prepared.length) {
    return [normalizeCategory(DEFAULT_CATEGORIES[0])];
  }

  return prepared.sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
};

const resolveCategoryId = (value, categories = []) => {
  const parsed = parseId(value);
  if (parsed && categories.some((category) => category.id === parsed)) {
    return parsed;
  }

  const fallbackId = categories[0]?.id || DEFAULT_CATEGORIES[0].id;
  const targetName = String(value || '').trim().toLowerCase();
  if (!targetName) {
    return fallbackId;
  }

  const byName = categories.find((category) => category.name.toLowerCase() === targetName);
  return byName ? byName.id : fallbackId;
};

const categoryMapFrom = (categories) => Object.fromEntries(categories.map((category) => [String(category.id), category]));

const normalizeSubtasks = (rawSubtasks) => {
  if (!Array.isArray(rawSubtasks)) {
    return [];
  }

  const seen = new Set();
  let cursor = 1;
  const normalized = [];

  for (const item of rawSubtasks) {
    const parsed = parseId(item?.id);
    const id = parsed && !seen.has(parsed) ? parsed : cursor++;
    seen.add(id);
    normalized.push({
      id,
      title: String(item?.title || '').trim() || `Subtask ${id}`,
      completed: Boolean(item?.completed),
      createdAt: String(item?.createdAt || new Date().toISOString()),
      updatedAt: String(item?.updatedAt || item?.createdAt || new Date().toISOString()),
    });
  }

  return normalized;
};

const nextSubtaskId = (subtasks = []) => {
  const values = subtasks.map((subtask) => parseId(subtask.id) || 0);
  return values.length ? Math.max(...values) + 1 : 1;
};

const INITIAL_TODO = {
  id: 1,
  title: 'Welcome to your todo app',
  description: 'Edit this task or add a new one.',
  completed: false,
  dueAt: '',
  priority: 'medium',
  categoryId: DEFAULT_CATEGORIES[0].id,
  tags: ['setup'],
  position: 1,
  starred: false,
  subtasks: [
    {
      id: 1,
      title: 'Try duplicate',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const normalizeTodo = (todo = {}, categories = []) => {
  const subtasks = normalizeSubtasks(todo.subtasks);
  const createdAt = String(todo.createdAt || new Date().toISOString());
  const updatedAt = String(todo.updatedAt || createdAt);
  const priority = PRIORITY_MAP[String(todo.priority)] ? String(todo.priority) : 'medium';
  const categoryId = resolveCategoryId(
    todo.categoryId ?? todo.categoryId?.toString() ?? todo.category,
    categories,
  );
  const starred = Boolean(todo.starred);

  return {
    id: parseId(todo.id) || 0,
    title: String(todo.title || '').trim(),
    description: String(todo.description || '').trim(),
    completed: Boolean(todo.completed),
    dueAt: String(todo.dueAt || '').trim(),
    priority,
    categoryId,
    tags: parseTags(todo.tags),
    starred,
    position: Number.isFinite(Number(todo.position)) ? Number(todo.position) : null,
    subtasks,
    deletedAt: todo.deletedAt ? String(todo.deletedAt) : null,
    createdAt,
    updatedAt,
  };
};

const writeStore = async (tasks, categories, filterPresets = []) => {
  const nextCategories = normalizeAndDeduplicateCategories(categories);
  const usedIds = new Set();
  const nextPresets = Array.isArray(filterPresets)
    ? filterPresets
        .map((preset, index) => {
          const fallbackId = index + 1;
          const baseId = parseId(preset?.id);
          let id = baseId || fallbackId;
          while (usedIds.has(id)) {
            id += 1;
          }
          usedIds.add(id);
          return {
            id,
            name: String(preset?.name || '').trim() || 'Saved filter',
            createdAt: String(preset?.createdAt || new Date().toISOString()),
            updatedAt: String(preset?.updatedAt || preset?.createdAt || new Date().toISOString()),
            filters: preset.filters || {},
          };
        })
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : a.id - b.id))
    : [];
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify(
      {
        todos: tasks,
        categories: nextCategories,
        filterPresets: nextPresets,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf-8',
  );
};

const writeTodos = async (tasks, categories) => writeStore(tasks, categories);

const ensureDataFile = async () => {
  if (!existsSync(DATA_DIR)) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DATA_FILE)) {
    const categories = normalizeAndDeduplicateCategories(DEFAULT_CATEGORIES);
    await writeStore([normalizeTodo(INITIAL_TODO, categories)], categories);
    return;
  }

  await ensureStoreShape();
};

const migrateOldFormatIfNeeded = (parsed) => {
  if (Array.isArray(parsed)) {
    const categories = normalizeAndDeduplicateCategories(DEFAULT_CATEGORIES);
    return {
      categories,
      todos: parsed.map((todo) => normalizeTodo(todo, categories)),
      filterPresets: [],
    };
  }

  const rawCategories = normalizeAndDeduplicateCategories(parsed?.categories);
  const todos = Array.isArray(parsed?.todos) ? parsed.todos : [];
  const presetLatest = (a, b) => {
    if (a.updatedAt > b.updatedAt) {
      return -1;
    }
    if (a.updatedAt < b.updatedAt) {
      return 1;
    }
    return 0;
  };
  return {
    categories: rawCategories,
    todos: todos.map((todo) => normalizeTodo(todo, rawCategories)),
    filterPresets: Array.isArray(parsed?.filterPresets)
      ? parsed.filterPresets
          .map((preset, index) => {
            const filters = normalizeFilterForStorage(normalizeFilterFromSource(preset, rawCategories, []));
            return {
              id: parseId(preset?.id) || index + 1,
              name: String(preset?.name || '').trim() || `Preset ${index + 1}`,
              createdAt: String(preset?.createdAt || new Date().toISOString()),
              updatedAt: String(preset?.updatedAt || preset?.createdAt || new Date().toISOString()),
              filters,
            };
          })
          .sort(presetLatest)
      : [],
  };
};

const purgeExpiredTrash = (todos) => {
  const now = Date.now();
  const cutoff = now - RECOVERY_WINDOW_MS;
  return todos.filter((todo) => {
    if (!todo.deletedAt) {
      return true;
    }
    const deletedAt = Date.parse(todo.deletedAt);
    return Number.isNaN(deletedAt) || deletedAt >= cutoff;
  });
};

const loadStore = async () => {
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  const { categories, todos: normalizedTodos, filterPresets = [] } = migrateOldFormatIfNeeded(parsed);
  const deduplicatedCategories = normalizeAndDeduplicateCategories(categories);
  const normalized = normalizedTodos.map((todo) => normalizeTodo(todo, deduplicatedCategories));
  const cleaned = purgeExpiredTrash(normalized);
  const normalizedPresets = filterPresets
    .map((preset, index) => {
      const normalized = normalizeFilterFromSource(preset?.filters || preset, deduplicatedCategories, []);
      return {
        id: parseId(preset?.id) || index + 1,
        name: String(preset?.name || '').trim() || 'Saved filter',
        createdAt: String(preset?.createdAt || new Date().toISOString()),
        updatedAt: String(preset?.updatedAt || preset?.createdAt || new Date().toISOString()),
        filters: {
          smart: normalized.smart,
          statusFilter: normalized.statusFilter,
          status: normalized.statusFilter,
          q: normalized.search,
          priority: normalized.priorityFilter,
          categoryId: normalized.categoryId,
          tags: normalized.tags,
          dueFrom: normalized.dueFrom,
          dueTo: normalized.dueTo,
          sort: normalized.sort,
        },
      };
    })
    .filter((preset) => Boolean(preset.id));

  if (cleaned.length !== normalized.length || normalized.some((todo) => todo.id === 0)) {
    await writeStore(cleaned, deduplicatedCategories, normalizedPresets);
  }

  return {
    todos: cleaned,
    categories: deduplicatedCategories,
    filterPresets: normalizedPresets,
  };
};

const ensureStoreShape = async () => {
  try {
    const current = JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
    const normalized = migrateOldFormatIfNeeded(current);
    await writeStore(normalized.todos, normalized.categories, normalized.filterPresets);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const loadTodos = async () => (await loadStore()).todos;

const getActiveTodos = (todos) => todos.filter((todo) => !todo.deletedAt);
const getDeletedTodos = (todos) => todos.filter((todo) => todo.deletedAt);

const nextTaskId = (todos) => {
  const valid = todos.map((todo) => parseId(todo.id)).filter(Boolean);
  return valid.length ? Math.max(...valid) + 1 : 1;
};

const nextTaskPosition = (todos) => {
  const active = getActiveTodos(todos);
  const positions = active.map((todo) => (Number.isFinite(todo.position) ? todo.position : -1));
  return positions.length ? Math.max(...positions) + 1 : 1;
};

const nextPresetId = (presets = []) => {
  const ids = presets.map((preset) => parseId(preset?.id)).filter(Boolean);
  return ids.length ? Math.max(...ids) + 1 : 1;
};

const sortTodos = (todos, sortBy = 'position') => {
  const sort = normalizeSort(sortBy);

  return [...todos].sort((a, b) => {
    if (sort === 'due') {
      const aDue = toDateMillis(a.dueAt);
      const bDue = toDateMillis(b.dueAt);
      const aMissing = aDue === null;
      const bMissing = bDue === null;
      if (aMissing || bMissing) {
        return aMissing ? (bMissing ? 0 : 1) : -1;
      }
      if (aDue !== bDue) {
        return aDue - bDue;
      }
    }

    if (sort === 'created') {
      const aCreated = toDateMillis(a.createdAt);
      const bCreated = toDateMillis(b.createdAt);
      if (aCreated !== bCreated) {
        return (bCreated || 0) - (aCreated || 0);
      }
    }

    if (sort === 'priority') {
      const aPriority = PRIORITY_WEIGHT[a.priority] ?? PRIORITY_WEIGHT.medium;
      const bPriority = PRIORITY_WEIGHT[b.priority] ?? PRIORITY_WEIGHT.medium;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
    }

    if (sort === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }

    const aPos = Number.isFinite(a.position) ? a.position : Number.MAX_SAFE_INTEGER;
    const bPos = Number.isFinite(b.position) ? b.position : Number.MAX_SAFE_INTEGER;
    if (aPos !== bPos) {
      return aPos - bPos;
    }
    const aCreated = toDateMillis(a.createdAt);
    const bCreated = toDateMillis(b.createdAt);
    return (bCreated || 0) - (aCreated || 0);
  });
};

const getDateBucket = (dueAt) => {
  if (!dueAt) {
    return 'later';
  }
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return 'later';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + 7);

  const normalizedDue = new Date(dueDate);
  normalizedDue.setHours(0, 0, 0, 0);

  if (normalizedDue < today) {
    return 'overdue';
  }
  if (normalizedDue < tomorrow) {
    return 'today';
  }
  if (normalizedDue <= endOfWeek) {
    return 'week';
  }
  return 'later';
};

const byDateBucket = (todos) => {
  const grouped = {
    overdue: [],
    today: [],
    week: [],
    later: [],
  };

  for (const todo of todos) {
    const bucket = getDateBucket(todo.dueAt);
    if (!grouped[bucket]) {
      grouped[bucket] = [];
    }
    grouped[bucket].push({
      ...todo,
      dueBucket: bucket,
    });
  }

  return grouped;
};

const groupLabel = (bucket) => {
  return DUE_GROUPS.find((item) => item.key === bucket)?.label || 'Later';
};

const buildTagCloud = (todos) => {
  const counts = {};
  for (const todo of todos) {
    for (const tag of todo.tags || []) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

const filterByTag = (todos, tag) => {
  const target = String(tag || '').trim();
  if (!target) {
    return todos;
  }
  return todos.filter((todo) => todo.tags.includes(target));
};

const applyAdvancedFilters = (todos, filterState = {}) => {
  const search = String(filterState.search || '').trim().toLowerCase();
  const priority = filterState.priorityFilter;
  const categoryId = Number.isFinite(Number(filterState.categoryId)) ? Number(filterState.categoryId) : null;
  const tags = Array.isArray(filterState.tags) ? filterState.tags : [];
  const dueFrom = parseDateBoundary(filterState.dueFrom);
  const dueTo = parseDateBoundary(filterState.dueTo, true);

  let filtered = [...todos];

  if (search) {
    filtered = filtered.filter((todo) => {
      const title = String(todo.title || '').toLowerCase();
      const description = String(todo.description || '').toLowerCase();
      return title.includes(search) || description.includes(search);
    });
  }

  if (priority && priority !== 'all') {
    filtered = filtered.filter((todo) => todo.priority === priority);
  }

  if (categoryId) {
    filtered = filtered.filter((todo) => todo.categoryId === categoryId);
  }

  if (tags.length) {
    filtered = filtered.filter((todo) => {
      const normalizedTodoTags = new Set(todo.tags.map((tag) => String(tag || '').toLowerCase()));
      return tags.every((tag) => normalizedTodoTags.has(String(tag || '').toLowerCase()));
    });
  }

  if (dueFrom !== null || dueTo !== null) {
    filtered = filtered.filter((todo) => {
      const dueDate = toDateMillis(todo.dueAt);
      if (dueDate === null) {
        return false;
      }
      if (dueFrom !== null && dueDate < dueFrom) {
        return false;
      }
      if (dueTo !== null && dueDate > dueTo) {
        return false;
      }
      return true;
    });
  }

  return filtered;
};

const highlightMatch = (text, searchTerm) => {
  const value = String(text || '');
  const escaped = escapeHtml(value);
  const trimmed = String(searchTerm || '').trim();
  if (!trimmed) {
    return escaped;
  }
  const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, 'gi');
  return escaped.replace(pattern, '<mark class="search-highlight">$1</mark>');
};

const subtaskProgress = (subtasks = []) => {
  const total = subtasks.length;
  if (total === 0) {
    return { done: 0, total, ratio: 0 };
  }
  const done = subtasks.filter((subtask) => subtask.completed).length;
  return { done, total, ratio: Math.round((done / total) * 100) };
};

const subtaskProgressText = (subtasks = []) => {
  const { done, total } = subtaskProgress(subtasks);
  return `${done}/${total} subtasks complete`;
};

const smartParam = (value) => {
  if (!value) {
    return 'all';
  }
  return Object.prototype.hasOwnProperty.call(SMART_LISTS, value) ? value : 'all';
};

const normalizeSmartFilter = (query = {}) => {
  const smart = smartParam(query.smart);
  const legacy = String(query.status || '').trim().toLowerCase();
  if (smart !== 'all') {
    return { smart, statusFilter: 'all' };
  }
  if (legacy === 'done') {
    return { smart: 'completed', statusFilter: 'done' };
  }
  if (legacy === 'open') {
    return { smart: 'all', statusFilter: 'open' };
  }
  return { smart: 'all', statusFilter: 'all' };
};

const applySmartFilter = (todos, smart, statusFilter = 'all') => {
  let filtered = [...todos];

  if (smart === 'today') {
    filtered = filtered.filter((todo) => getDateBucket(todo.dueAt) === 'today');
  }
  if (smart === 'starred') {
    filtered = filtered.filter((todo) => todo.starred);
  }
  if (smart === 'completed') {
    filtered = filtered.filter((todo) => todo.completed);
  }

  if (statusFilter === 'done') {
    filtered = filtered.filter((todo) => todo.completed);
  }
  if (statusFilter === 'open') {
    filtered = filtered.filter((todo) => !todo.completed);
  }

  return filtered;
};

const normalizePriority = (value) => {
  return PRIORITY_MAP[String(value)] ? String(value) : 'medium';
};

const priorityClass = (priority) => {
  return PRIORITY_MAP[normalizePriority(priority)]?.token || 'info';
};

const renderCategorySelect = (name, categories, selectedId = null) => {
  const options = categories
    .map(
      (category) => `
        <option value="${category.id}" ${selectedId === category.id ? 'selected' : ''}>
          ${escapeHtml(category.icon)} ${escapeHtml(category.name)}
        </option>`,
    )
    .join('');

  return `<select class="select" name="${name}">${options}</select>`;
};

const renderSubtaskList = (todo) => {
  const subtasks = todo.subtasks || [];
  const rows = subtasks
    .map(
      (subtask) => `
        <li class="subtask-item">
          <label class="subtask-label">
            <input
              class="subtask-toggle"
              type="checkbox"
              data-task-id="${todo.id}"
              data-subtask-id="${subtask.id}"
              ${subtask.completed ? 'checked' : ''}
            />
            <span>${escapeHtml(subtask.title)}</span>
          </label>
          <form method="POST" action="/todos/${todo.id}/subtasks/${subtask.id}/delete">
            <button class="btn btn-ghost" type="submit" title="Delete subtask">×</button>
          </form>
        </li>`,
    )
    .join('');

  return `
      <div class="subtasks">
        <p>Subtasks</p>
        <ul>${rows || '<li class="empty-subtask">No subtasks yet.</li>'}</ul>
        <form method="POST" action="/todos/${todo.id}/subtasks" class="subtask-add">
          <input class="input" name="title" placeholder="Add subtask" required />
          <button class="btn btn-soft" type="submit">Add</button>
        </form>
      </div>
  `;
};

const renderTodoRow = (todo, categories, search = '') => {
  const category = categoryMapFrom(categories)[String(todo.categoryId)] || categories[0] || DEFAULT_CATEGORIES[0];
  const { done, total, ratio } = subtaskProgress(todo.subtasks);
  const chips = (todo.tags || []).map((tag) => `<span class="meta-chip">${escapeHtml(tag)}</span>`).join('');
  const priorityTokenClass = priorityClass(todo.priority);
  const titleMarkup = highlightMatch(todo.title, search);
  const descriptionMarkup = todo.description
    ? highlightMatch(todo.description, search)
    : '<span class="description-empty">No description</span>';

  return `
    <li class="todo-item ${todo.completed ? 'is-done' : ''}" data-task-id="${todo.id}" data-completed="${todo.completed ? 'true' : 'false'}" draggable="true">
      <div class="select-col">
        <input type="checkbox" class="select-task" value="${todo.id}" />
      </div>
      <div class="drag-handle" aria-hidden="true">⠿</div>
      <div class="todo-content">
        <h3 class="todo-title">${titleMarkup}</h3>
        <p class="todo-description">${descriptionMarkup}</p>
        <form method="POST" action="/todos/${todo.id}/edit" class="title-form">
          <input class="input" name="title" value="${escapeHtml(todo.title)}" required />
          <select class="select" name="priority">
            ${PRIORITY_OPTIONS.map(
              (item) =>
                `<option value="${item.value}" ${todo.priority === item.value ? 'selected' : ''}>${item.label}</option>`,
            ).join('')}
          </select>
          <input class="input" type="date" name="dueAt" value="${escapeHtml(todo.dueAt)}" />
          ${renderCategorySelect('categoryId', categories, todo.categoryId)}
          <textarea class="textarea" name="description" rows="1">${escapeHtml(todo.description)}</textarea>
          <button class="btn btn-soft" type="submit">Save inline</button>
        </form>

        <div class="todo-meta">
          <span class="meta-chip priority-token priority-${priorityTokenClass}">${todo.priority.toUpperCase()}</span>
          <span class="meta-chip category-chip" style="--chip-color:${escapeHtml(category.color)}">
            ${escapeHtml(category.icon)} ${escapeHtml(category.name)}
          </span>
          ${chips}
          <span class="meta-chip">Due ${todo.dueAt ? escapeHtml(todo.dueAt) : 'Not set'}</span>
          <span class="meta-chip">Updated ${todo.updatedAt.slice(0, 10)}</span>
        </div>

        <div class="progress-wrap">
          <span class="progress-text">${subtaskProgressText(todo.subtasks)}</span>
          <div class="progress-track">
            <span class="progress-fill" style="width:${ratio}%"></span>
          </div>
        </div>

        ${renderSubtaskList(todo)}

        <div class="task-actions">
          <button type="button" class="btn btn-ghost star-btn ${todo.starred ? 'is-starred' : ''}" data-task-id="${todo.id}" title="Star task">${todo.starred ? '★' : '☆'}</button>
          <button type="button" class="btn btn-ghost toggle-btn" data-task-id="${todo.id}">${todo.completed ? '↺' : '✓'}</button>
          <button type="button" class="btn btn-outline open-sheet" data-task-id="${todo.id}">Edit details</button>
          <form method="POST" action="/todos/${todo.id}/duplicate">
            <button class="btn btn-outline" type="submit">Duplicate</button>
          </form>
          <form method="POST" action="/todos/${todo.id}/delete" onsubmit="return confirm('Move to trash?')">
            <button class="btn btn-danger" type="submit">Trash</button>
          </form>
        </div>
      </div>
    </li>`;
};

const renderTrashRow = (todo) => {
  const deletedDate = todo.deletedAt ? new Date(todo.deletedAt).toISOString().slice(0, 10) : 'Unknown';
  const { done, total } = subtaskProgress(todo.subtasks);

  return `
    <li class="todo-item" data-task-id="${todo.id}">
      <div class="todo-content">
        <div class="todo-meta">
          <strong>${escapeHtml(todo.title)}</strong>
          <span class="meta-chip">Deleted ${deletedDate}</span>
          <span class="meta-chip">Subtasks ${done}/${total}</span>
        </div>
        <p>${escapeHtml(todo.description || 'No description')}</p>
        <div class="task-actions">
          <form method="POST" action="/todos/${todo.id}/recover">
            <button class="btn btn-primary" type="submit">Recover</button>
          </form>
          <form method="POST" action="/todos/${todo.id}/hard-delete" onsubmit="return confirm('Delete permanently? This cannot be undone.')">
            <button class="btn btn-danger" type="submit">Delete permanently</button>
          </form>
        </div>
      </div>
    </li>`;
};

const renderTagCloud = (tags, filterState = {}) => {
  const items = tags
    .map((entry) => {
      const isActive = (filterState.tags || []).includes(entry.tag);
      const params = buildFilterQuery(filterState, { tag: entry.tag });
      return `
        <a
          href="/?${params}"
          class="tag-chip ${isActive ? 'active' : ''}"
        >${escapeHtml(entry.tag)} <span>${entry.count}</span></a>
      `;
    })
    .join('');

  if (!items) {
    return '';
  }

  return `
    <section class="card surface card-tag-cloud">
      <h3 class="surface-title">Tag Cloud</h3>
      <div class="tag-cloud">${items}</div>
      ${filterState.tags?.length ? `<a class="tag-clear" href="/?${buildFilterQuery({...filterState, tags: []})}">Clear tag filter</a>` : ''}
    </section>
  `;
};

const renderFilterPanel = (categories, filterState = [], presets = []) => {
  const presetsMarkup = presets
    .map((preset) => {
      const params = buildFilterQuery(preset.filters);
      return `
        <li class="preset-item">
          <a href="/?${params}" class="preset-link">
            ${escapeHtml(preset.name)}
          </a>
          <form method="POST" action="/presets/${preset.id}/delete">
            <button class="btn btn-danger" type="submit">Remove</button>
          </form>
        </li>
      `;
    })
    .join('');

  return `
    <section class="filters card surface">
      <details class="filter-panel">
        <summary>Advanced Filters</summary>
        <form method="GET" action="/" class="filter-form">
          <input class="input" type="search" name="q" value="${escapeHtml(filterState.search || '')}" placeholder="Search title or description" />
          <select class="select" name="status">
            <option value="">All status</option>
            <option value="open" ${filterState.statusFilter === 'open' ? 'selected' : ''}>Open</option>
            <option value="done" ${filterState.statusFilter === 'done' ? 'selected' : ''}>Done</option>
          </select>
          <select class="select" name="priority">
            <option value="">All priorities</option>
            ${PRIORITY_OPTIONS.map(
              (item) =>
                `<option value="${item.value}" ${filterState.priorityFilter === item.value ? 'selected' : ''}>${item.label}</option>`,
            ).join('')}
          </select>
          <select class="select" name="categoryId">
            <option value="">All categories</option>
            ${categories
              .map(
                (category) =>
                  `<option value="${category.id}" ${
                    String(filterState.categoryId || '') === String(category.id) ? 'selected' : ''
                  }>${escapeHtml(category.icon)} ${escapeHtml(category.name)}</option>`,
              )
              .join('')}
          </select>
          <input class="input" name="tag" value="${escapeHtml((filterState.tags || []).join(', '))}" placeholder="Tag (comma-separated for save/load)" />
          <input class="input" type="date" name="dueFrom" value="${escapeHtml(filterState.dueFrom || '')}" />
          <input class="input" type="date" name="dueTo" value="${escapeHtml(filterState.dueTo || '')}" />
          <select class="select" name="sort">
            ${SORT_OPTIONS.map(
              (option) =>
                `<option value="${option.value}" ${filterState.sort === option.value ? 'selected' : ''}>${option.label}</option>`,
            ).join('')}
          </select>
          <input type="hidden" name="smart" value="${filterState.smart || 'all'}" />
          <input type="hidden" name="presetId" value="" />
          <button class="btn btn-primary" type="submit">Apply</button>
          <a class="btn btn-ghost" href="/">Reset</a>
        </form>
      </details>

      <form method="POST" action="/presets" class="preset-save-form">
        <input class="input" name="name" placeholder="Preset name" required />
        <input type="hidden" name="q" value="${escapeHtml(filterState.search || '')}" />
        <input type="hidden" name="status" value="${filterState.statusFilter || 'all'}" />
        <input type="hidden" name="priority" value="${filterState.priorityFilter || 'all'}" />
        <input type="hidden" name="categoryId" value="${filterState.categoryId || ''}" />
        <input type="hidden" name="tag" value="${escapeHtml((filterState.tags || []).join(', '))}" />
        <input type="hidden" name="dueFrom" value="${escapeHtml(filterState.dueFrom || '')}" />
        <input type="hidden" name="dueTo" value="${escapeHtml(filterState.dueTo || '')}" />
        <input type="hidden" name="sort" value="${filterState.sort || 'position'}" />
        <input type="hidden" name="smart" value="${filterState.smart || 'all'}" />
        <button class="btn btn-outline" type="submit">Save current as preset</button>
      </form>

      <section class="presets">
        <h3>Saved Presets</h3>
        <ul class="preset-list">${presetsMarkup || '<li class="empty">No saved presets yet.</li>'}</ul>
      </section>
    </section>
  `;
};

const renderGroups = (groups, categories, searchTerm = '') => {
  let html = '';
  let hasRows = false;

  for (const config of DUE_GROUPS) {
    const key = config.key;
    const todos = groups[key] || [];
    if (!todos.length) {
      continue;
    }
    hasRows = true;
      const rows = todos.map((todo) => renderTodoRow(todo, categories, searchTerm)).join('');
      html += `
        <section class="task-group">
        <h3>${config.label} <span>${todos.length}</span></h3>
        <ul class="todo-list">${rows}</ul>
      </section>
    `;
  }

  if (!hasRows) {
    return '<p class="empty">No items found.</p>';
  }

  return html;
};

const renderPage = ({
  todos,
  categories,
  filterState = {},
  filterPresets = [],
  smart,
  statusFilter = 'all',
  selectedTag = '',
  isTrashView = false,
}) => {
  const activeTodos = getActiveTodos(todos);
  const deletedTodos = getDeletedTodos(todos);
  const smartFilter = filterState.smart || smartParam(smart);
  const effectiveFilterState = {
    ...filterState,
    smart: smartFilter,
  };
  const resolvedTags = filterState.tags || (selectedTag ? [selectedTag] : []);
  effectiveFilterState.tags = resolvedTags;
  effectiveFilterState.search = String(filterState.search || '').trim();
  effectiveFilterState.statusFilter = statusFilter || filterState.statusFilter || 'all';
  effectiveFilterState.categoryId = filterState.categoryId || null;
  const baseSmart = applySmartFilter(activeTodos, smartFilter, statusFilter);
  const advancedFiltered = applyAdvancedFilters(baseSmart, {
    ...effectiveFilterState,
    tags: resolvedTags.length ? resolvedTags : [selectedTag],
  });
  const filteredTasks = filterByTag(advancedFiltered, selectedTag);
  const finalSortedTasks = sortTodos(filteredTasks, effectiveFilterState.sort);
  const groupedTasks = byDateBucket(filteredTasks);
  const groupedAndSorted = byDateBucket(finalSortedTasks);
  const tagCloud = buildTagCloud(applyAdvancedFilters(baseSmart, { ...effectiveFilterState, tags: [] }));
  const categoryMap = categoryMapFrom(categories);
  const categoryOptions = safeScriptJson(categories);
  const taskPayload = filteredTasks.map((todo) => ({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    dueAt: todo.dueAt,
    priority: todo.priority,
    categoryId: todo.categoryId,
    tags: todo.tags,
    starred: todo.starred,
  }));

  const counts = {
    all: applyAdvancedFilters(activeTodos, effectiveFilterState).length,
    today: applyAdvancedFilters(
      activeTodos.filter((todo) => getDateBucket(todo.dueAt) === 'today'),
      effectiveFilterState,
    ).length,
    starred: applyAdvancedFilters(activeTodos.filter((todo) => todo.starred), effectiveFilterState).length,
    completed: applyAdvancedFilters(activeTodos.filter((todo) => todo.completed), effectiveFilterState).length,
    trash: deletedTodos.length,
  };

  const smartLinks = Object.entries(SMART_LISTS)
    .map(([key, label]) => {
      const params = buildFilterQuery(effectiveFilterState, { smart: key, tags: selectedTag ? [selectedTag] : [] });
      const active = (isTrashView ? key === 'trash' : key === smartFilter) ? 'active' : '';
      return `<a href="/?${params}" class="${active}">${label} (${counts[key]})</a>`;
    })
    .join('');

  const bulkCategoryOptions = categories
    .map((category) => `<option value="${category.id}">${escapeHtml(category.icon)} ${escapeHtml(category.name)}</option>`)
    .join('');

  const listMarkup = isTrashView
    ? deletedTodos.map(renderTrashRow).join('')
    : renderGroups(groupedAndSorted, categories, effectiveFilterState.search);

  const listHeader = isTrashView ? `<h2>Trash (${deletedTodos.length})</h2>` : `<h2>Tasks</h2>`;

  return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Task Management</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="container">
      <header class="app-header">
        <h1>Task Management</h1>
        <nav class="app-nav">
          <a href="/">Tasks</a>
          <a href="/categories">Categories</a>
        </nav>
      </header>

      ${!isTrashView ? `
      <section class="composer card surface">
        <form method="POST" action="/todos" class="compose-form">
          <input class="input" name="title" placeholder="What do you want to do?" required />
          <input class="input" type="text" name="description" placeholder="Description" />
          <input class="input" type="date" name="dueAt" />
          <select class="select" name="priority">
            ${PRIORITY_OPTIONS.map(
              (option) =>
                `<option value="${option.value}" ${option.value === 'medium' ? 'selected' : ''}>${option.label}</option>`,
            ).join('')}
          </select>
          ${renderCategorySelect('categoryId', categories, categories[0]?.id)}
          <input class="input" type="text" name="tags" placeholder="Tags (comma separated)" />
          <button class="btn btn-primary" type="submit">Add Task</button>
        </form>
      </section>
      ` : ''}

      <section class="stats card surface">
        ${smartLinks}
      </section>

      ${renderTagCloud(tagCloud, effectiveFilterState)}
      ${renderFilterPanel(categories, effectiveFilterState, filterPresets)}

      ${!isTrashView ? `
      <section class="bulk card surface">
        <form method="POST" action="/todos/bulk" id="bulk-form">
          <input type="hidden" id="bulk-ids" name="ids" />
          <label class="control">
            <input type="checkbox" id="select-all" />
            Select all
          </label>
          <select class="select" id="bulk-action" name="action">
            <option value="complete">Mark complete</option>
            <option value="incomplete">Mark incomplete</option>
            <option value="delete">Soft delete</option>
            <option value="categorize">Set category</option>
          </select>
          <select class="select" id="bulk-category" name="categoryId" disabled>
            <option value="">Choose category</option>
            ${bulkCategoryOptions}
          </select>
          <button class="btn btn-primary" type="submit">Apply</button>
        </form>
      </section>
      ` : ''}

      <section class="list card surface">
        ${listHeader}
        <div class="group-list">${listMarkup || '<p class="empty">No items found.</p>'}</div>
      </section>
    </main>

    <aside id="edit-sheet" class="sheet" aria-hidden="true" hidden>
      <div class="sheet-panel">
        <div class="sheet-head">
          <h3>Edit task</h3>
          <button type="button" class="btn btn-ghost" id="close-sheet">Close</button>
        </div>
        <form id="edit-sheet-form" method="POST" action="/todos/0/edit" class="sheet-form">
          <input class="input" id="sheet-title" name="title" required />
          <textarea class="textarea" id="sheet-description" name="description" rows="3"></textarea>
          <input class="input" type="date" id="sheet-dueAt" name="dueAt" />
          <select class="select" id="sheet-priority" name="priority">
            ${PRIORITY_OPTIONS.map(
              (option) => `<option value="${option.value}">${option.label}</option>`,
            ).join('')}
          </select>
          ${renderCategorySelect('categoryId', categories, categories[0]?.id).replace('class="select"', 'class="select" id="sheet-category"')}
          <input class="input" id="sheet-tags" name="tags" placeholder="Tags (comma separated)" />
          <label class="control">
            <input type="checkbox" id="sheet-starred" name="starred" value="1" />
            Star this task
          </label>
          <button class="btn btn-primary" type="submit">Save</button>
        </form>
        <p class="help-text">Subtasks can be edited inline on each card.</p>
      </div>
    </aside>

    <script id="task-payload" type="application/json">${safeScriptJson(taskPayload)}</script>
    <script id="category-payload" type="application/json">${safeScriptJson(categoryOptions)}</script>
    <script>
      (function() {
        const tasks = (() => {
          try {
            return JSON.parse(document.getElementById('task-payload')?.textContent || '[]');
          } catch (_error) {
            return [];
          }
        })();

        const categories = (() => {
          try {
            return JSON.parse(document.getElementById('category-payload')?.textContent || '[]');
          } catch (_error) {
            return [];
          }
        })();

        const taskById = Object.fromEntries(tasks.map((todo) => [String(todo.id), todo]));
        const categoryById = Object.fromEntries(categories.map((category) => [String(category.id), category]));

        const bulkForm = document.getElementById('bulk-form');
        const selectAll = document.getElementById('select-all');
        const bulkIdsInput = document.getElementById('bulk-ids');
        const bulkAction = document.getElementById('bulk-action');
        const bulkCategory = document.getElementById('bulk-category');
        const taskRows = () => Array.from(document.querySelectorAll('.todo-item[data-task-id]'));
        const selectedRows = () => taskRows().filter((row) => row.querySelector('.select-task')?.checked);

        const collectSelected = () => selectedRows().map((row) => row.dataset.taskId).filter(Boolean);

        const updateBulkState = () => {
          const selected = collectSelected();
          if (bulkCategory) {
            bulkCategory.disabled = bulkAction?.value !== 'categorize';
          }
          if (!selectAll) return;
          const checkboxes = document.querySelectorAll('.select-task');
          selectAll.checked = checkboxes.length > 0 && selected.length === checkboxes.length;
          selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
        };

        document.addEventListener('change', (event) => {
          if (event.target.classList.contains('select-task')) {
            updateBulkState();
            return;
          }

          if (event.target.id === 'select-all') {
            const shouldSelect = event.target.checked;
            document.querySelectorAll('.select-task').forEach((checkbox) => {
              checkbox.checked = shouldSelect;
            });
            updateBulkState();
          }
        });

        if (bulkForm && bulkIdsInput) {
          bulkForm.addEventListener('submit', (event) => {
            const selected = collectSelected();
            if (!selected.length) {
              event.preventDefault();
              return;
            }
            if (bulkAction?.value === 'categorize' && !bulkCategory?.value) {
              event.preventDefault();
              return;
            }
            bulkIdsInput.value = selected.join(',');
          });
        }

        if (selectAll) {
          const observer = new MutationObserver(() => {
            updateBulkState();
          });
          observer.observe(document.body, { childList: true, subtree: true });
          updateBulkState();
        }

        const sheet = document.getElementById('edit-sheet');
        const sheetClose = document.getElementById('close-sheet');
        const sheetForm = document.getElementById('edit-sheet-form');
        const sheetTitle = document.getElementById('sheet-title');
        const sheetDescription = document.getElementById('sheet-description');
        const sheetDueAt = document.getElementById('sheet-dueAt');
        const sheetPriority = document.getElementById('sheet-priority');
        const sheetCategory = document.getElementById('sheet-category');
        const sheetTags = document.getElementById('sheet-tags');
        const sheetStarred = document.getElementById('sheet-starred');

        const openSheet = (event) => {
          const button = event.target.closest('.open-sheet');
          if (!button || !sheet || !sheetForm) {
            return;
          }
          const id = button.dataset.taskId;
          const task = taskById[id];
          if (!task) {
            return;
          }

          sheetTitle.value = task.title || '';
          sheetDescription.value = task.description || '';
          sheetDueAt.value = task.dueAt || '';
          sheetPriority.value = task.priority || 'medium';
          sheetCategory.value = String(task.categoryId || '');
          sheetTags.value = Array.isArray(task.tags) ? task.tags.join(', ') : '';
          sheetStarred.checked = Boolean(task.starred);
          sheetForm.action = '/todos/' + id + '/edit';

          sheet.setAttribute('aria-hidden', 'false');
          sheet.classList.add('is-open');
          sheet.hidden = false;
        };

        document.addEventListener('click', (event) => {
          if (event.target.closest('.open-sheet')) {
            openSheet(event);
            return;
          }
          if (event.target === sheet || event.target === sheetClose) {
            sheet.classList.remove('is-open');
            sheet.setAttribute('aria-hidden', 'true');
            sheet.hidden = true;
          }
        });

        const toggleTask = async (taskId) => {
          const row = document.querySelector('.todo-item[data-task-id=\"' + taskId + '\"]');
          if (!row) return;
          const button = row.querySelector('.toggle-btn');
          if (!button) return;
          const previous = row.dataset.completed === 'true';
          const nextCompleted = !previous;

          row.dataset.completed = String(nextCompleted);
          row.classList.toggle('is-done', nextCompleted);
          button.textContent = nextCompleted ? '↺' : '✓';

          try {
            const response = await fetch('/api/todos/' + taskId, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ completed: nextCompleted }),
            });
            if (!response.ok) {
              throw new Error('Request failed');
            }
          } catch (_error) {
            row.dataset.completed = String(previous);
            row.classList.toggle('is-done', previous);
            button.textContent = previous ? '↺' : '✓';
            alert('Could not update task state.');
          }
        };

        const toggleStar = async (taskId) => {
          const row = document.querySelector('.todo-item[data-task-id=\"' + taskId + '\"]');
          if (!row) return;
          const button = row.querySelector('.star-btn');
          if (!button) return;
          const previous = button.classList.contains('is-starred');
          const nextStarred = !previous;

          button.classList.toggle('is-starred', nextStarred);
          button.textContent = nextStarred ? '★' : '☆';

          try {
            const response = await fetch('/api/todos/' + taskId, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ starred: nextStarred }),
            });
            if (!response.ok) {
              throw new Error('Request failed');
            }
          } catch (_error) {
            button.classList.toggle('is-starred', previous);
            button.textContent = previous ? '★' : '☆';
            alert('Could not update starred state.');
          }
        };

        document.addEventListener('click', (event) => {
          if (event.target.classList.contains('toggle-btn')) {
            const taskId = event.target.dataset.taskId;
            void toggleTask(taskId);
            return;
          }
          if (event.target.classList.contains('star-btn')) {
            const taskId = event.target.dataset.taskId;
            void toggleStar(taskId);
            return;
          }
        });

        const updateSubtaskRow = async (taskId, subtaskId, payload) => {
          try {
            const response = await fetch('/api/todos/' + taskId + '/subtasks/' + subtaskId, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify(payload),
            });
            if (!response.ok) {
              throw new Error('Request failed');
            }
          } catch (_error) {
            const input = document.querySelector(
              '.subtask-toggle[data-task-id=\"' + taskId + '\"][data-subtask-id=\"' + subtaskId + '\"]'
            );
            if (input) {
              input.checked = !input.checked;
            }
            alert('Could not update subtask.');
          }
        };

        document.addEventListener('change', (event) => {
          if (!event.target.classList.contains('subtask-toggle')) {
            return;
          }
          const taskId = Number(event.target.dataset.taskId);
          const subtaskId = Number(event.target.dataset.subtaskId);
          if (!taskId || !subtaskId) {
            return;
          }
          void updateSubtaskRow(taskId, subtaskId, { completed: event.target.checked });
        });

        const todoLists = document.querySelectorAll('.todo-list');
        let dragged = null;

        const getAfterElement = (container, y) => {
          const eligibleElements = [...(container ? container.querySelectorAll('.todo-item:not(.dragging)') : [])];
          return eligibleElements.reduce(
            (closest, child) => {
              const box = child.getBoundingClientRect();
              const offset = y - box.top - box.height / 2;
              if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
              }
              return closest;
            },
            { offset: Number.NEGATIVE_INFINITY, element: null },
          ).element;
        };

        const syncOrder = async () => {
          const ids = [...document.querySelectorAll('.todo-list .todo-item[data-task-id]')].map((row) =>
            Number(row.dataset.taskId),
          );
          try {
            await fetch('/todos/reorder', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ order: ids }),
            });
          } catch (_error) {
            console.error('Could not save task order');
          }
        };

        const attachDragHandlers = (todoList) => {
          if (!todoList) {
            return;
          }

          todoList.addEventListener('dragstart', (event) => {
            const dragging = event.target.closest('.todo-item[draggable]');
            if (!dragging) return;
            dragged = dragging;
            dragged.classList.add('dragging');
          });

          todoList.addEventListener('dragover', (event) => {
            if (!dragged) return;
            event.preventDefault();
            const after = getAfterElement(todoList, event.clientY);
            if (!after) {
              todoList.appendChild(dragged);
              return;
            }
            todoList.insertBefore(dragged, after);
          });

          todoList.addEventListener('drop', (event) => {
            event.preventDefault();
            if (!dragged) return;
            dragged.classList.remove('dragging');
            void syncOrder();
            dragged = null;
          });

          todoList.addEventListener('dragend', () => {
            if (dragged) {
              dragged.classList.remove('dragging');
            }
            dragged = null;
          });
        };

        if (todoLists.length) {
          for (const todoList of todoLists) {
            attachDragHandlers(todoList);
          }
        }
      })();
    </script>
  </body>
  </html>
  `;
};

const renderCategoryPage = (categories, error = '') => {
  const rows = categories
    .map(
      (category) => `
        <li class="category-card">
          <form method="POST" action="/categories/${category.id}/edit" class="category-row">
            <input class="input" name="name" value="${escapeHtml(category.name)}" required />
            <input class="input" name="icon" value="${escapeHtml(category.icon)}" />
            <input class="input" name="color" value="${escapeHtml(category.color)}" />
            <button class="btn btn-soft" type="submit">Save</button>
          </form>
          <form method="POST" action="/categories/${category.id}/delete" onsubmit="return confirm('Delete this category?')">
            <button class="btn btn-danger" type="submit">Delete</button>
          </form>
        </li>
      `,
    )
    .join('');

  const errorBlock = error ? `<p class="error-msg">${escapeHtml(error)}</p>` : '';

  return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Categories</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="container">
      <header class="app-header">
        <h1>Categories</h1>
        <nav class="app-nav">
          <a href="/">Tasks</a>
          <a href="/categories" class="active">Categories</a>
        </nav>
      </header>

      ${errorBlock}
      <section class="card surface">
        <h2>Create Category</h2>
        <form method="POST" action="/categories" class="category-form">
          <input class="input" name="name" placeholder="Name" required />
          <input class="input" name="icon" placeholder="Icon (emoji)" value="🏷️" />
          <input class="input" name="color" placeholder="Hex color" value="#64748b" />
          <button class="btn btn-primary" type="submit">Add</button>
        </form>
      </section>

      <section class="card surface">
        <h2>Category Library (${categories.length})</h2>
        <ul class="category-list">${rows || '<li class="empty">No categories yet.</li>'}</ul>
      </section>
    </main>
  </body>
  </html>
  `;
};

  app.get('/', async (req, res) => {
    const { todos, categories, filterPresets } = await loadStore();
    const filterState = normalizeFilterFromSource(req.query, categories, filterPresets);
    const { smart, statusFilter } = normalizeSmartFilter(req.query);
    const selectedTag = parseTags(req.query.tag)[0] || '';

    const isTrashView = smart === 'trash';
    const pageSmart = isTrashView ? 'trash' : smart;
    if (isTrashView) {
      res.send(
        renderPage({
          todos,
          categories,
          filterState: {
            ...filterState,
            smart: pageSmart,
          },
          smart: pageSmart,
          statusFilter: 'all',
          selectedTag,
          isTrashView: true,
        }),
      );
      return;
    }

    res.send(
      renderPage({
        todos,
        categories,
        filterState,
        filterPresets,
        smart: pageSmart,
        statusFilter,
        selectedTag,
        isTrashView: false,
      }),
    );
  });

app.get('/trash', async (_req, res) => {
  res.redirect('/?smart=trash');
});

app.get('/categories', async (_req, res) => {
  const { categories } = await loadStore();
  res.send(renderCategoryPage(categories));
});

app.post('/categories', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const name = String(req.body.name || '').trim();
  const icon = String(req.body.icon || '🏷️').trim() || '🏷️';
  const color = sanitizeColor(req.body.color, '#64748b');
  if (!name) {
    res.send(renderCategoryPage(categories, 'Name is required.'));
    return;
  }

  const exists = categories.some((category) => category.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    res.send(renderCategoryPage(categories, 'A category with this name already exists.'));
    return;
  }

  categories.push({
    id: nextCategoryId(categories),
    name,
    icon,
    color,
  });

  await writeStore(todos, categories, filterPresets);
  res.redirect('/categories');
});

app.post('/categories/:id/edit', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }

  const category = categories.find((item) => item.id === id);
  if (!category) {
    return res.status(404).send('Category not found');
  }

  const name = String(req.body.name || '').trim();
  const icon = String(req.body.icon || '🏷️').trim() || '🏷️';
  const color = sanitizeColor(req.body.color, category.color);

  if (!name) {
    return res.status(400).send('Name is required');
  }

  const duplicate = categories.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return res.status(400).send('A category with this name already exists');
  }

  category.name = name;
  category.icon = icon;
  category.color = color;

  await writeStore(todos, categories, filterPresets);
  res.redirect('/categories');
});

app.post('/categories/:id/delete', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }

  if (!categories.length) {
    return res.status(400).send('No categories to delete');
  }
  if (categories.length <= 1) {
    return res.status(400).send('Keep at least one category');
  }

  const category = categories.find((item) => item.id === id);
  if (!category) {
    return res.status(404).send('Category not found');
  }

  const fallback = categories.find((item) => item.id !== id);
  if (!fallback) {
    return res.status(400).send('Cannot delete this category');
  }

  for (const todo of todos) {
    if (todo.categoryId === id) {
      todo.categoryId = fallback.id;
    }
  }

  const nextCategories = categories.filter((item) => item.id !== id);
  await writeStore(todos, nextCategories, filterPresets);
  res.redirect('/categories');
});

app.post('/presets', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const name = String(req.body.name || '').trim() || 'Saved filter';
  const normalized = normalizeFilterFromSource(req.body, categories, filterPresets);
  const filters = normalizeFilterForStorage(normalized);
  const presetId = nextPresetId(filterPresets);
  const now = new Date().toISOString();
  const nextPresets = [
    ...filterPresets,
    {
      id: presetId,
      name,
      createdAt: now,
      updatedAt: now,
      filters,
    },
  ];

  await writeStore(todos, categories, nextPresets);
  const redirectPath = `/?${buildFilterQuery(
    {
      ...normalized,
      presetId,
    },
    {},
  )}`;
  res.redirect(redirectPath);
});

app.post('/presets/:id/delete', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid preset id');
  }
  const nextPresets = filterPresets.filter((preset) => parseId(preset.id) !== id);
  await writeStore(todos, categories, nextPresets);
  res.redirect(req.get('referer') || '/');
});

app.get('/api/todos', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
  const filterState = normalizeFilterFromSource(req.query, categories, filterPresets);
  const { smart, statusFilter } = normalizeSmartFilter(req.query);
  const active = includeDeleted ? todos : getActiveTodos(todos);
  const filtered = applySmartFilter(active, smart, statusFilter);
  const withAdvanced = applyAdvancedFilters(filtered, {
    ...filterState,
    tags: filterState.tags?.length ? filterState.tags : [String(req.query.tag || '').trim()],
  });
  const sorted = sortTodos(withAdvanced, filterState.sort);
  res.json(sorted);
});

app.get('/api/todos/:id', async (req, res) => {
  const { todos } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  res.json(todo);
});

app.post('/todos', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const dueAt = String(req.body.dueAt || '').trim();
  const priority = normalizePriority(req.body.priority);
  const categoryId = resolveCategoryId(req.body.categoryId ?? req.body.category, categories);
  const tags = parseTags(req.body.tags);

  if (!title) {
    return res.status(400).send('Title is required');
  }

  todos.push({
    id: nextTaskId(todos),
    title,
    description,
    completed: false,
    dueAt,
    priority,
    categoryId,
    tags,
    starred: parseBoolean(req.body.starred),
    position: nextTaskPosition(todos),
    subtasks: [],
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await writeStore(todos, categories, filterPresets);
  res.redirect('/');
});

app.post('/todos/:id/edit', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }
  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).send('Todo not found');
  }

  const title = String(req.body.title || '').trim();
  if (!title) {
    return res.status(400).send('Title is required');
  }

  todo.title = title;
  todo.description = String(req.body.description || '').trim();
  todo.dueAt = String(req.body.dueAt || '').trim();
  todo.priority = normalizePriority(req.body.priority);
  if (Object.prototype.hasOwnProperty.call(req.body, 'categoryId') || Object.prototype.hasOwnProperty.call(req.body, 'category')) {
    todo.categoryId = resolveCategoryId(req.body.categoryId ?? req.body.category, categories);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'tags')) {
    todo.tags = parseTags(req.body.tags);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'starred')) {
    todo.starred = parseBoolean(req.body.starred);
  }
  todo.updatedAt = new Date().toISOString();

  await writeStore(todos, categories, filterPresets);

  const referer = req.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      res.redirect(url.pathname + url.search);
      return;
    } catch (_error) {
      // fallthrough
    }
  }
  res.redirect('/');
});

app.post('/todos/:id/delete', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }

  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).send('Todo not found');
  }

  todo.deletedAt = new Date().toISOString();
  todo.updatedAt = new Date().toISOString();
  await writeStore(todos, categories, filterPresets);
  res.redirect('/');
});

app.post('/todos/:id/recover', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }

  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).send('Todo not found');
  }

  todo.deletedAt = null;
  todo.updatedAt = new Date().toISOString();
  await writeStore(todos, categories, filterPresets);
  res.redirect('/trash');
});

app.post('/todos/:id/hard-delete', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }

  const next = todos.filter((item) => item.id !== id);
  if (next.length === todos.length) {
    return res.status(404).send('Todo not found');
  }

  await writeStore(next, categories, filterPresets);
  res.redirect('/trash');
});

app.post('/todos/bulk', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const ids = parseIds(req.body.ids);
  const action = String(req.body.action || '').trim();
  const byId = new Set(ids);
  const categoryId = resolveCategoryId(req.body.categoryId, categories);

  if (!ids.length) {
    return res.status(400).send('No tasks selected');
  }

  if (!['complete', 'incomplete', 'delete', 'categorize'].includes(action)) {
    return res.status(400).send('Invalid bulk action');
  }
  if (action === 'categorize' && !parseId(req.body.categoryId)) {
    return res.status(400).send('Category is required for categorize');
  }

  for (const todo of todos) {
    if (!byId.has(todo.id) || todo.deletedAt) {
      continue;
    }
    if (action === 'complete') {
      todo.completed = true;
    }
    if (action === 'incomplete') {
      todo.completed = false;
    }
    if (action === 'delete') {
      todo.deletedAt = new Date().toISOString();
    }
    if (action === 'categorize') {
      todo.categoryId = categoryId;
    }
    todo.updatedAt = new Date().toISOString();
  }

  await writeStore(todos, categories, filterPresets);
  res.redirect('/');
});

app.post('/todos/:id/duplicate', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }
  const source = todos.find((item) => item.id === id);
  if (!source) {
    return res.status(404).send('Todo not found');
  }

  const now = new Date().toISOString();
  let subtaskId = 1;
  const duplicatedSubtasks = source.subtasks.map((subtask) => ({
    ...subtask,
    id: subtaskId++,
    createdAt: now,
    updatedAt: now,
  }));

  const duplicated = {
    ...source,
    id: nextTaskId(todos),
    title: `${source.title} (Copy)`,
    subtasks: duplicatedSubtasks,
    completed: false,
    starred: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    position: nextTaskPosition(todos),
  };

  todos.push(duplicated);
  await writeStore(todos, categories, filterPresets);
  res.redirect('/');
});

app.post('/todos/reorder', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const order = parseIds(req.body.order);
  if (!order.length) {
    return res.status(400).send('Order missing');
  }

  const active = getActiveTodos(todos);
  const activeIds = new Set(active.map((todo) => todo.id));
  const requested = order.filter((id) => activeIds.has(id));
  const missing = active.filter((todo) => !requested.includes(todo.id)).map((todo) => todo.id);
  const finalOrder = [...requested, ...missing];
  const map = Object.fromEntries(active.map((todo) => [todo.id, todo]));

  finalOrder.forEach((id, index) => {
    if (map[id]) {
      map[id].position = index + 1;
    }
  });

  await writeStore(todos, categories, filterPresets);
  res.json({ ok: true, order: finalOrder });
});

app.post('/todos/:id/subtasks', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).send('Invalid id');
  }

  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).send('Todo not found');
  }

  const title = String(req.body.title || '').trim();
  if (!title) {
    return res.status(400).send('Subtask title is required');
  }

  todo.subtasks.push({
    id: nextSubtaskId(todo.subtasks),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  todo.updatedAt = new Date().toISOString();
  await writeStore(todos, categories, filterPresets);
  res.redirect('/');
});

app.post('/todos/:id/subtasks/:subtaskId/delete', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  const subtaskId = parseId(req.params.subtaskId);
  if (!id || !subtaskId) {
    return res.status(400).send('Invalid id');
  }

  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).send('Todo not found');
  }

  const nextSubtasks = todo.subtasks.filter((subtask) => subtask.id !== subtaskId);
  if (nextSubtasks.length === todo.subtasks.length) {
    return res.status(404).send('Subtask not found');
  }

  todo.subtasks = nextSubtasks;
  todo.updatedAt = new Date().toISOString();
  await writeStore(todos, categories, filterPresets);
  res.redirect('/');
});

app.patch('/api/todos/:id', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  if ('completed' in req.body) {
    todo.completed = Boolean(req.body.completed);
  }
  if ('title' in req.body) {
    const title = String(req.body.title).trim();
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    todo.title = title;
  }
  if ('description' in req.body) {
    todo.description = String(req.body.description).trim();
  }
  if ('dueAt' in req.body) {
    todo.dueAt = String(req.body.dueAt).trim();
  }
  if ('priority' in req.body && PRIORITY_MAP[req.body.priority]) {
    todo.priority = req.body.priority;
  }
  if ('categoryId' in req.body || 'category' in req.body) {
    todo.categoryId = resolveCategoryId(req.body.categoryId ?? req.body.category, categories);
  }
  if ('tags' in req.body) {
    todo.tags = parseTags(req.body.tags);
  }
  if ('starred' in req.body) {
    todo.starred = parseBoolean(req.body.starred, todo.starred);
  }

  todo.updatedAt = new Date().toISOString();
  await writeStore(todos, categories, filterPresets);
  res.json(todo);
});

app.patch('/api/todos/:id/subtasks/:subtaskId', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  const subtaskId = parseId(req.params.subtaskId);
  if (!id || !subtaskId) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  const subtask = todo.subtasks.find((item) => item.id === subtaskId);
  if (!subtask) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  if ('completed' in req.body) {
    subtask.completed = Boolean(req.body.completed);
  }
  if ('title' in req.body) {
    const title = String(req.body.title).trim();
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    subtask.title = title;
  }
  subtask.updatedAt = new Date().toISOString();
  todo.updatedAt = new Date().toISOString();

  await writeStore(todos, categories, filterPresets);
  res.json({ ok: true, subtask });
});

app.delete('/api/todos/:id/subtasks/:subtaskId', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  const subtaskId = parseId(req.params.subtaskId);
  if (!id || !subtaskId) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  const next = todo.subtasks.filter((subtask) => subtask.id !== subtaskId);
  if (next.length === todo.subtasks.length) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  todo.subtasks = next;
  todo.updatedAt = new Date().toISOString();
  await writeStore(todos, categories, filterPresets);
  res.status(204).send();
});

app.delete('/api/todos/:id', async (req, res) => {
  const { todos, categories, filterPresets } = await loadStore();
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const next = todos.filter((item) => item.id !== id);
  if (next.length === todos.length) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  await writeStore(next, categories, filterPresets);
  res.status(204).send();
});

app.listen(PORT, async () => {
  await ensureDataFile();
  console.log(`Task Management app running at http://localhost:${PORT}`);
});
