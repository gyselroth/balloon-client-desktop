
const i18n = require('../../lib/i18n.js');

let Menu, MenuItem, emit;
if(!process || process.type === 'renderer') {
  const {ipcRenderer, remote} = require('electron');
  Menu = remote.Menu;
  MenuItem = remote.MenuItem;
  emit = function() {
    ipcRenderer.send(...arguments);
  }

} else {
  const electron = require('electron');
  const ipcMain = electron.ipcMain;
  Menu = electron.Menu;
  MenuItem = electron.MenuItem;

  emit = function() {
    ipcMain.emit(...arguments);
  }
}

module.exports = function menuFactory(loadMenu, clientConfig, showLogin=true, syncStatus=true) {
  var label;
  const menu = new Menu()

  if(showLogin === false && clientConfig.get('username')) {
    menu.append(new MenuItem({label: clientConfig.get('username'), enabled: false}))
  }

  if(showLogin === true) {
    label = i18n.__('tray.menu.link');
    menu.append(new MenuItem({label: label, click: function(){
      emit('link-account');
      emit('tray-hide');
    }}))
  } else {
    label = i18n.__('tray.menu.unlink');
    menu.append(new MenuItem({label: label, click: function(){
      emit('unlink-account');
      emit('tray-hide');
    }}))
  }

  menu.append(new MenuItem({type: 'separator', enabled: false}))

  if(clientConfig.get('loggedin') === true) {
    if(syncStatus === true) {
      label = i18n.__('tray.menu.pauseSync');
    } else {
      label = i18n.__('tray.menu.continueSync');
    }
    menu.append(new MenuItem({label: label, click:function(){
      emit('sync-toggle-pause');
      emit('tray-hide');
    }}))

    menu.append(new MenuItem({type: 'separator', enabled: false}))
  }

  label = i18n.__('tray.menu.status');
  menu.append(new MenuItem({label: label, click: function(){
    loadMenu('status');
  }}))

  label = i18n.__('tray.menu.settings');
  menu.append(new MenuItem({label: label, click: function(){
    loadMenu('settings');
  }}))

  label = i18n.__('tray.menu.feedback');
  menu.append(new MenuItem({label: label, click: function(){
    loadMenu('feedback');
  }}))

  label = i18n.__('tray.menu.about');
  menu.append(new MenuItem({label: label, click: function(){
    loadMenu('about');
  }}))

  menu.append(new MenuItem({type: 'separator', enabled: false}))

  label = i18n.__('tray.menu.close');
  menu.append(new MenuItem({label: label, click: function(){
    emit('quit');
  }}))

  return menu;
}
