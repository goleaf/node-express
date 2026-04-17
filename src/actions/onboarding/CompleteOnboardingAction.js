import UserModel from '../../models/UserModel.js';

export default class CompleteOnboardingAction {
  execute(userId) {
    return UserModel.update(userId, {
      onboarding_completed: 1,
    });
  }
}
