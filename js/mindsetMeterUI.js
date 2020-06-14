// JQUERY UI FUNCTIONS

$( function () {

  // Smooth scrolling for hash anchor tags
  $('a[href*=#]').on('click', function() {
    $('html, body').animate({
      // Get the bookmark from the link, query the DOM for it, and get its offset.
      scrollTop: $( $.attr(this, 'href') ).offset().top - 50
    }, 400);
    return false;
  });

});