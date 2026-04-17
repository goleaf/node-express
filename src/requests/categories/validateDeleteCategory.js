import db from '../../config/database.js';

const validateDeleteCategory = (req, res, next) => {
  const categoryId = Number(req.params.id);

  if (!Number.isInteger(categoryId) || categoryId < 1) {
    return res.status(404).json({
      message: 'Category not found.',
    });
  }

  const category = db
    .prepare(
      `
        SELECT id, user_id, name, color, icon, created_at, updated_at
        FROM categories
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(categoryId);

  if (!category) {
    return res.status(404).json({
      message: 'Category not found.',
    });
  }

  if (category.user_id !== req.session.userId) {
    return res.status(403).json({
      message: 'You do not have permission to delete this category.',
    });
  }

  req.category = category;

  return next();
};

export default validateDeleteCategory;
