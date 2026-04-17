const destroySession = (session) =>
  new Promise((resolve, reject) => {
    session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export default class LogoutUserAction {
  async execute(session) {
    await destroySession(session);
    return true;
  }
}
