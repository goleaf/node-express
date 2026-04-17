import TagModel from '../../models/TagModel.js';

export default class UpdateTagAction {
  execute(tagId, userId, data) {
    return TagModel.update(tagId, userId, {
      name: data.name,
      color: data.color,
    });
  }
}
