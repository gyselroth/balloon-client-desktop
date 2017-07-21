const {app} = require('electron');

var openWindows = {};
var windowStates;

module.exports = function(env) {
  if(windowStates) return windowStates;

  function showDock() {
    if (process.platform === 'darwin' && app.dock && env.name === 'production') {
      app.dock.show();
    }
  }

  function hideDock() {
    if (process.platform === 'darwin' && app.dock && env.name === 'production') {
      app.dock.hide();
    }
  }

  windowStates = {
    closed: function(windowId) {
      var hasOpenWindow = false;
      openWindows[windowId] = false;

      Object.keys(openWindows).forEach((windowId) => {
        hasOpenWindow = hasOpenWindow || openWindows[windowId];
      });

      if(!hasOpenWindow) hideDock();
    },
    opened: function(windowId) {
      openWindows[windowId] = true;
      showDock();
    }
  }

  return windowStates;
}
