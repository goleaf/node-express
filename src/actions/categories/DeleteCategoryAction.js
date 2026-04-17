import CategoryModel from '../../models/CategoryModel.js';

export default class DeleteCategoryAction {
  execute(categoryId, userId) {
    CategoryModel.detachCategoryFromTasks(categoryId, userId);
    CategoryModel.delete(categoryId, userId);

    return true;
  }
}
