const ipc = require('node-ipc');

const MAIN_ID = 'balloon-desktop';
const CLIENT_ID = MAIN_ID + '-client';
ipc.config.retry = 1500;
ipc.config.silent = true;
ipc.config.retry = 5;

module.exports = {
  listen: (callback) => {
    ipc.config.id = MAIN_ID;
    ipc.serve(() => {
      ipc.server.on('message', (data, socket) => {
        callback(data);
      });
    });
    ipc.server.start();
  },

  send: (data) => {
    return new Promise((resolve, reject) => {
      ipc.config.id = CLIENT_ID;
      ipc.connectTo(MAIN_ID, () => {
        ipc.of[MAIN_ID].on('connect', () => {
          ipc.of[MAIN_ID].emit('message', data);
          ipc.disconnect(MAIN_ID);
          resolve();
        });
      });
    });
  }
};
