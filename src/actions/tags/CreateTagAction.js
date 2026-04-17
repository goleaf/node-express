import TrackEventAction from '../TrackEventAction.js';
import TagModel from '../../models/TagModel.js';

const trackEventAction = new TrackEventAction();

export default class CreateTagAction {
  execute(userId, data) {
    const tag = TagModel.create({
      user_id: userId,
      name: data.name,
      color: data.color,
    });

    trackEventAction.execute(userId, 'tag_created');

    return tag;
  }
}
