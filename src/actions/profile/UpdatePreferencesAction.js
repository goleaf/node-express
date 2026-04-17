import UserModel from '../../models/UserModel.js';

export default class UpdatePreferencesAction {
  execute(userId, preferences) {
    return UserModel.update(userId, {
      theme_preference: preferences.theme,
      default_priority: preferences.default_priority,
      default_view: preferences.default_view,
    });
  }
}
