import CategoryModel from '../../models/CategoryModel.js';

export default class UpdateCategoryAction {
  execute(categoryId, userId, data) {
    return CategoryModel.update(categoryId, userId, {
      name: data.name,
      color: data.color,
      icon: data.icon,
    });
  }
}
