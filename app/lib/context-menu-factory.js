const { Menu } = require('electron');
const i18n = require('./i18n.js');

module.exports = function contextMenuFactory (window) {
  const selectionMenu = Menu.buildFromTemplate([
    { label: i18n.__('menu.edit.copy'), role: 'copy' }
  ]);

  const inputMenu = Menu.buildFromTemplate([
    { label: i18n.__('menu.edit.undo'), role: 'undo' },
    { label: i18n.__('menu.edit.redo'), role: 'redo' },
    { type: 'separator'},
    { label: i18n.__('menu.edit.cut'), role: 'cut' },
    { label: i18n.__('menu.edit.copy'), role: 'copy' },
    { label: i18n.__('menu.edit.paste'), role: 'paste' }
  ]);

  window.webContents.on('context-menu', function contextMenu(event, props) {
    const { selectionText, isEditable } = props;

    if (isEditable) {
      inputMenu.popup(window);
    } else if (selectionText && selectionText.trim() !== '') {
      selectionMenu.popup(window);
    }
  });
}
