const { app, Menu } = require('electron');

const i18n = require('./i18n.js');

module.exports = function() {
  if (process.platform === 'darwin') {

    const template = [
        {
        label: i18n.__('menu.app'),
        submenu: [
            { label: i18n.__('menu.app.about'), selector: 'orderFrontStandardAboutPanel:' },
            { type: 'separator' },
            { label: i18n.__('menu.app.quit'), accelerator: 'Command+Q', click: function() { app.quit(); }}
        ]}, {
        label: i18n.__('menu.edit'),
        submenu: [
            { label: i18n.__('menu.edit.undo'), accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
            { label: i18n.__('menu.edit.redo'), accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
            { type: 'separator' },
            { label: i18n.__('menu.edit.cut'), accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
            { label: i18n.__('menu.edit.copy'), accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
            { label: i18n.__('menu.edit.paste'), accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
            { label: i18n.__('menu.edit.select'), accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
        ]}
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}
