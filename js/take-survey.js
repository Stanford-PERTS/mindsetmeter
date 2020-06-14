// Javascript for survey pages

/* global mm */

$(document).ready(function () {
  "use strict";

  var renderPage = function (pageNum) {
    var np = $(pageIds)[pageNum];
    if( typeof np === "undefined" ){
      //  this is the results page
       $('#submit_button').click();
       return true;
    }
    $('.page').hide();
    $("#"+pageIds[pageNum]).fadeIn(500);
    $(tabs).removeClass("active");
    $(tabs[pageNum] ).addClass("active");
    window.scrollTo(0,0);
  };

  var toNextPage = function (self) {
    var parentId = $(self).closest("div").attr("id");
    var i = $.inArray( parentId , pageIds ) + 1;
    renderPage(i);
  };

  var flipTab = function (self) {
    var target = $(self).attr("rel");
    var i = $.inArray( target, pageIds );
    renderPage(i);
  };

  //  discover the metric pages by cycling through the .tabs li rels
  var tabs = $(".tabs li");
  var pageIds = [];
  $(tabs).each( function (x) {
    pageIds.push($(tabs[x]).attr("rel"));
  });

  // Bind buttons to next page function
  $(".next_button").bind( 'click', function(){ toNextPage(this); });
  $(".tabs li").bind( 'click', function(){ flipTab(this); });

  //  call render the first page
  renderPage(0);

  //  check if they were invited and tell them if so
  var invited = ( mm.url_lookup("public_key").length > 0 );
  if( invited ){
    $('.invite_warning').show();
  }

  //  prevent enter from submitting the form
  $("#survey").keydown( function (event) {
    var e = e || event;
    return (e.keyCode || event.which || event.charCode || 0) !== 13;
  });

});