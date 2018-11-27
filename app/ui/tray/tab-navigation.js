module.exports = function(view) {
  var $view = $(view);
  var $navigationItems = $view.find('.tab-navigation li a');
  var $tabContents = $view.find('.tab-content');

  navigateTo($navigationItems.first().attr('href').substr(1));

  $navigationItems.bind('click', function(event) {
    event.preventDefault();
    navigateTo($(this).attr('href').substr(1));
  });

  function navigateTo(tab) {
    $navigationItems.parent('li').removeClass('tab-navigation-active');
    $tabContents.removeClass('tab-active');

    $navigationItems.addBack().find('[href="#' + tab + '"]').parent('li').addClass('tab-navigation-active');
    $tabContents.addBack().find('#' + tab).addClass('tab-active');
  }
}
