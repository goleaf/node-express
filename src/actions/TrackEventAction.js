import db from '../config/database.js';

const insertEvent = db.prepare(`
  INSERT INTO user_events (user_id, event_name, payload)
  VALUES (?, ?, ?)
`);

export default class TrackEventAction {
  async execute(userId, eventName, payload = {}) {
    insertEvent.run(userId, eventName, JSON.stringify(payload));
    return true;
  }
}
