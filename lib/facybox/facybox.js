(function($) {
  //TODO refactor using data.content_klass
  $.facybox = function(data, klass) {
    $.facybox.loading();
    $.facybox.content_klass = klass;
    if (data.ajax) revealAjax(data.ajax);
    else if(data.image) revealImage(data.image);
    else if(data.images) revealGallery(data.images,data.initial);
    else if(data.div) revealHref(data.div);
    else if($.isFunction(data)) data.call($);
    else $.facybox.reveal(data);
  }

  /*
   * Public, $.facybox methods
   */

  $.extend($.facybox, {
    //possible option: noAutoload --- will build facybox only when it is needed
    settings: {
		opacity      : 0.3,
		overlay      : true,
		modal        : false,
		imageTypes   : [ 'png', 'jpg', 'jpeg', 'gif' ]
    },

    html : function(){
      return '\
		<div id="facybox" style="display:none;"> \
			<div class="popup"> \
				<table> \
					<tbody> \
						<tr> \
							<td class="nw"/><td class="n" /><td class="ne"/> \
						</tr> \
						<tr> \
							<td class="w" /> \
							<td class="body"> \
							<div class="footer"> </div> \
							<a href="#" class="close"></a>\
							<div class="content"> \
							</div> \
						</td> \
							<td class="e"/> \
						</tr> \
						<tr> \
							<td class="sw"/><td class="s"/><td class="se"/> \
						</tr> \
					</tbody> \
				</table> \
			</div> \
		</div> \
		<div class="loading"></div> \
	'
    },

    loading: function(){
      init();
      if($('.loading',$('#facybox'))[0]) return;//already in loading state...
      showOverlay();
      $.facybox.wait();
      if (!$.facybox.settings.modal) {
        $(document).bind('keydown.facybox', function(e) {
          if(e.keyCode == 27) $.facybox.close();//ESC
        });
      }
      $(document).trigger('loading.facybox');
    },

    wait: function(){
      var $f = $('#facybox');
      $('.content',$f).empty();//clear out old content
      $('.body',$f).children().hide().end().append('<div class="loading"></div>');
      $f.fadeIn('fast');
	  $.facybox.centralize();
      $(document).trigger('reveal.facybox').trigger('afterReveal.facybox');
    },

    centralize: function(){
		
		var $f = $('#facybox');
		var pos = $.facybox.getViewport();
		var wl = parseInt(pos[0]/2) - parseInt($f.find("table").width() / 2);
		var fh = parseInt($f.height());

		if(pos[1] > fh){
			var t = (pos[3] + (pos[1] - fh)/2);
			$f.css({ 'left': wl, 'top': t });
			// console.log('height smaller then window: '+fh, pos[1], pos[3])
		} else {
			var t = (pos[3] + (pos[1] /10));
			$f.css({ 'left': wl, 'top': t });
			// console.log('height bigger then window')
		}
    },

	getViewport: function() {
		//  [1009, 426, 0, 704]
		return [$(window).width(), $(window).height(), $(window).scrollLeft(), $(window).scrollTop()];
	},

    reveal: function(content){
	$(document).trigger('beforeReveal.facybox');
	var $f = $('#facybox');
	$('.content',$f)
		.attr('class',($.facybox.content_klass||'')+' content') //do not simply add the new class, since on the next call the old classes would remain
		.html(content);
	$('.loading',$f).remove();
	
	var $body 	= $('.body',$f);

	$body.children().fadeIn('fast');
	
	$.facybox.centralize();

	$(document).trigger('reveal.facybox').trigger('afterReveal.facybox');
    },

    close: function(){
      $(document).trigger('close.facybox');
      return false;
    }
  })

  /*
   * Bind to links, on click they open a facybox which
   * contains what their href points to
   */
  $.fn.facybox = function(settings) {
    var $this = $(this);
    if(!$this[0]) return $this;//called on empty elements, just stop and continue chain
    if(settings)$.extend($.facybox.settings, settings);
    if(!$.facybox.settings.noAutoload) init();

    $this.bind('click.facybox',function(){
      $.facybox.loading();
      // support for rel="facybox.inline_popup" syntax, to add a class
      // also supports deprecated "facybox[.inline_popup]" syntax
      var klass = this.rel.match(/facybox\[?\.(\w+)\]?/);
      $.facybox.content_klass = klass ? klass[1] : '';
      revealHref(this.href);
      return false;
    });
    return $this;//continue chain
  }

  /*
   * Private methods
   */
  // called one time to setup facybox on this page
  function init() {
    if($.facybox.settings.inited) return;
    else $.facybox.settings.inited = true;

    $(document).trigger('init.facybox');
    makeBackwardsCompatible();

    var imageTypes = $.facybox.settings.imageTypes.join('|');
    $.facybox.settings.imageTypesRegexp = new RegExp('\.(' + imageTypes + ')', 'i');

    $('body').append($.facybox.html());//insert facybox to dom

    //if we did not autoload, so the user has just clicked the facybox and pre-loading is useless
    if(! $.facybox.settings.noAutoload){
		preloadImages();
	}
        $('#facybox .close').click($.facybox.close);
  }

  //preloads all the static facybox images
  function preloadImages(){
    //TODO preload prev/next ?
    $('#facybox').find('.n, .close , .s, .w, .e, .nw, ne, sw, se').each(function() {
		var img = new Image();
		img.src = $(this).css('background-image').replace(/url\((.+)\)/, '$1');
    })
	var img = new Image();
	img.src = 'images/loading.gif';
  }

  function makeBackwardsCompatible() {
    var $s = $.facybox.settings;
    $s.imageTypes = $s.image_types || $s.imageTypes;
    $s.facyboxHtml = $s.facybox_html || $s.facyboxHtml;
  }

  // Figures out what you want to display and displays it
  // formats are:
  //     div: #id
  //   image: blah.extension
  //    ajax: anything else
  function revealHref(href) {
    // div
    if(href.match(/#/)) {
      var url    = window.location.href.split('#')[0];
      var target = href.replace(url,'');
      if (target == '#') return
      $.facybox.reveal($(target).html(), $.facybox.content_klass);
    // image
    } else if(href.match($.facybox.settings.imageTypesRegexp)) {
      revealImage(href);
    // ajax
    } else { revealAjax(href)}
  }

  function revealGallery(hrefs, initial) {
    //initial position
    var position = $.inArray(initial||0,hrefs);
    if(position ==-1){
		position = 0;
	}

    //build navigation and ensure it will be removed
	var $footer  = $('#facybox div.footer');
	
    $footer.append($('<div class="navigation"><a class="prev"/><a class="next"/><div class="counter"></div></div>'));
    var $nav = $('#facybox .navigation');

    $(document).bind('afterClose.facybox',function(){
		$nav.remove();
		nativeWindow.visible = false;
	});

    function change_image(diff){
      position = (position + diff + hrefs.length) % hrefs.length;
      revealImage(hrefs[position]);
      $nav.find('.counter').html(position +1+" / "+hrefs.length);
    }
    change_image(0);

    //bind events
    $('.prev',$nav).click(function(){change_image(-1)});
    $('.next',$nav).click(function(){change_image(1)});
    $(document).bind('keydown.facybox', function(e) {
      if(e.keyCode == 39)change_image(1);  // right
      if(e.keyCode == 37)change_image(-1); // left
    });
  }

  function revealImage(href){
	
	var $f = $("#facybox");
	
    $('#facybox .content').empty();
    $.facybox.loading();//TODO loading must be shown until image is loaded -> stopLoading() on onload
    var image = new Image();
    image.onload = function() {
		$.facybox.reveal('<div class="image"><img src="' + image.src + '" /></div>', $.facybox.content_klass);
		
		var $footer  	= $("div.footer",$f);
		var $content 	= $("div.content",$f);
		var $navigation	= $("div.navigation",$f);
		var $next		= $("a.next",$f);
		var $prev		= $("a.prev",$f);
		var $counter	= $("div.counter",$f);
		
		var size = [$content.width(), $content.height()];
		
		$footer.width(size[0]).height(size[1]);
		$navigation.width(size[0]).height(size[1]);
		$next.width(parseInt(size[0]/2)).height(size[1]).css({ left: (size[0]/2) });
		$prev.width(size[0]/2).height(size[1]);
		$counter.width(parseInt($f.width() -26)).css({'opacity' : 0.5, '-moz-border-radius' : '8px', '-webkit-border-radius' : '8px'})
		
    }
    image.src = href;
  }

  //TODO loading until content arrives
  function revealAjax(href) {
    $.get(href, function(data) { $.facybox.reveal(data) });
  }

  function skipOverlay() {
    return $.facybox.settings.overlay == false || $.facybox.settings.opacity === null
  }

  function showOverlay() {
    if(skipOverlay()) return;

    if($('#facybox_overlay').length == 0){
      $("body").append('<div id="facybox_overlay" class="facybox_hide"></div>');
    }

    $('#facybox_overlay').hide().addClass("facybox_overlayBG")
      .css('opacity', $.facybox.settings.opacity)
      .fadeIn(200);
    if(!$.facybox.settings.modal){
      $('#facybox_overlay').click(function(){ $(document).trigger('close.facybox')})
    }
  }

  function hideOverlay() {
    if(skipOverlay()) return;

    $('#facybox_overlay').fadeOut(200, function(){
      $("#facybox_overlay").removeClass("facybox_overlayBG").
        addClass("facybox_hide").
        remove();
    })
  }

  /*
   * Bindings
   */

  $(document).bind('close.facybox', function() {
    $(document).unbind('keydown.facybox');
    $('#facybox').fadeOut(function() {
      $('#facybox .content').removeClass().addClass('content');//revert changing class
      hideOverlay();
      $('#facybox .loading').remove();
    })
    $(document).trigger('afterClose.facybox');
  });

})(jQuery);