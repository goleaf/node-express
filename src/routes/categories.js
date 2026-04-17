import express from 'express';
import CreateCategoryAction from '../actions/categories/CreateCategoryAction.js';
import DeleteCategoryAction from '../actions/categories/DeleteCategoryAction.js';
import UpdateCategoryAction from '../actions/categories/UpdateCategoryAction.js';
import { requireAuth } from '../middleware/auth.js';
import validateIntegerParam from '../middleware/validateIntegerParam.js';
import CategoryModel from '../models/CategoryModel.js';
import TagModel from '../models/TagModel.js';
import validateCreateCategory from '../requests/categories/validateCreateCategory.js';
import validateDeleteCategory from '../requests/categories/validateDeleteCategory.js';
import validateUpdateCategory from '../requests/categories/validateUpdateCategory.js';

const router = express.Router();

const createCategoryAction = new CreateCategoryAction();
const updateCategoryAction = new UpdateCategoryAction();
const deleteCategoryAction = new DeleteCategoryAction();
const toast = (message, type = 'success') => ({ type, message });

const COLOR_SWATCHES = [
  '#6750A4',
  '#625B71',
  '#7D5260',
  '#006A6A',
  '#386A20',
  '#B3261E',
  '#1D4ED8',
  '#D97706',
  '#C026D3',
  '#0F766E',
  '#4F46E5',
  '#334155',
];

const CATEGORY_ICONS = [
  'work',
  'home',
  'favorite',
  'shopping_cart',
  'flight',
  'book',
  'fitness_center',
  'restaurant',
  'school',
  'payments',
  'event',
  'pets',
];

router.use(requireAuth);
router.param('id', validateIntegerParam('id'));

router.get('/', (req, res) => {
  const activeTab = req.query.tab === 'tags' ? 'tags' : 'categories';

  res.render('categories/index', {
    title: 'Lists',
    activeTab,
    categories: CategoryModel.findByUserId(req.session.userId),
    tags: TagModel.findByUserId(req.session.userId),
    colorSwatches: COLOR_SWATCHES,
    categoryIcons: CATEGORY_ICONS,
  });
});

router.get('/:id', (req, res) => {
  const category = CategoryModel.findById(Number(req.params.id), req.session.userId);

  if (!category) {
    return res.status(404).json({
      message: 'Category not found.',
    });
  }

  return res.json({
    category,
  });
});

router.post('/', validateCreateCategory, (req, res) => {
  const category = createCategoryAction.execute(req.session.userId, req.body);

  return res.status(201).json({
    success: true,
    toast: toast('Category created'),
    category,
  });
});

router.patch('/:id', validateUpdateCategory, (req, res) => {
  const category = updateCategoryAction.execute(Number(req.params.id), req.session.userId, req.body);

  if (!category) {
    return res.status(404).json({
      message: 'Category not found.',
    });
  }

  return res.json({
    success: true,
    toast: toast('Category updated'),
    category,
  });
});

router.delete('/:id', validateDeleteCategory, (req, res) => {
  deleteCategoryAction.execute(req.category.id, req.session.userId);

  return res.json({
    success: true,
    toast: toast('Category deleted'),
  });
});

export default router;
