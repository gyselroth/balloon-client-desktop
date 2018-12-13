module.exports = function(view) {
  var $view = $(view);
  var $navigationItems = $view.find('.tab-navigation li');
  var $tabContents = $view.find('.tab-content');

  navigateTo($navigationItems.first().find('a').attr('href').substr(1));

  $navigationItems.bind('click', function(event) {
    event.preventDefault();
    navigateTo($(this).find('a').attr('href').substr(1));
  });

  function navigateTo(tab) {
    $navigationItems.removeClass('tab-navigation-active');
    $tabContents.addClass('tab-disable');

    $navigationItems.addBack().find('[href="#' + tab + '"]').parent('li').addClass('tab-navigation-active');
    $tabContents.addBack().find('#' + tab).removeClass('tab-disable');
  }
}
