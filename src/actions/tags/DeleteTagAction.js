import TagModel from '../../models/TagModel.js';

export default class DeleteTagAction {
  execute(tagId, userId) {
    TagModel.detachTagFromTasks(tagId, userId);
    TagModel.delete(tagId, userId);

    return true;
  }
}
