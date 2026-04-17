import TrackEventAction from '../TrackEventAction.js';
import CategoryModel from '../../models/CategoryModel.js';

const trackEventAction = new TrackEventAction();

export default class CreateCategoryAction {
  execute(userId, data) {
    const category = CategoryModel.create({
      user_id: userId,
      name: data.name,
      color: data.color,
      icon: data.icon,
    });

    trackEventAction.execute(userId, 'category_created');

    return category;
  }
}
