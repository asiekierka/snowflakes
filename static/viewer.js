function ie(image) {
	$(image).css("display", "none")
		.css("visibility", "hidden");
}
var currentX = 125, currentY = -800;
var currentIX = 0, currentIY = 0;
function getViewOffset() {
	return [currentIX, currentIY];
}
$(window).on("load", function() {
	var currentJX = 0, currentJY = 0;
	var snowflakeSize = 512;
	var possibleSizes = [384, 512, 768, 1024];
	var currentLoadedSnowflakes = [];
	// Check hash for def. XY value
	var hash = location.hash.replace("#", "");
	if(hash.split("_").length == 2) {
		currentX = tp(hash)[0];
		currentY = tp(hash)[1];
		if(currentX == NaN) currentX = 0;
		if(currentY == NaN) currentY = 0;
	}
	function sp(pos) {
		return Math.floor(pos/snowflakeSize);
	}
	function rp(pos) {
		return pos*snowflakeSize;
	}
	function tp(name) {
		var o = name.split("_");
		return [parseInt(o[0]), parseInt(o[1])];
	}
	function unloadChunks() {
		_.each(currentLoadedSnowflakes, function(snowflake) {
			$("#"+snowflake).remove();
		});
		currentLoadedSnowflakes = [];
	}
	function zoom(v) {
		var i = possibleSizes.indexOf(snowflakeSize)+v;
		if(i < 0 || i >= possibleSizes.length) return;
		var oldSnowflakeSize = snowflakeSize;
		snowflakeSize = possibleSizes[i];
		var positionDifference = (snowflakeSize / oldSnowflakeSize);
		currentX *= positionDifference; currentY *= positionDifference;
		unloadChunks();
		setTimeout(reloadSnowflakes, 100);
	}
	var reallyPositionSnowflakes = function() {
		_.each(currentLoadedSnowflakes, function(snowflake) {
			var s = $("#"+snowflake);
			var pos = tp(snowflake);
			s.css("top", rp(pos[1]) - currentIY)
			 .css("left", rp(pos[0]) - currentIX);
		});
	};
	var positionSnowflakes = _.throttle(reallyPositionSnowflakes, 16);
	var loadNewSnowflakes = _.throttle(function() {
		var fprefix = snowflakeSize <= 256 ? "f" : (snowflakeSize > 512 ? "r" : (window.devicePixelRatio > 1.5 ? "r" : "f"));
		var shardIX = sp(currentIX), shardIY = sp(currentIY), shardJX = sp(currentJX), shardJY = sp(currentJY);
		var neededSnowflakes = [];
		for(var iy = shardIY; iy <= shardJY; iy++)
			for(var ix = shardIX; ix <= shardJX; ix++)
				neededSnowflakes.push(ix+"_"+iy);
		// Unload unnecessary snowflakes
		_.each(_.difference(currentLoadedSnowflakes, neededSnowflakes), function(snowflake) {
			$("#"+snowflake).remove();
		});
		// Load necessary snowflakes
		_.each(_.difference(neededSnowflakes, currentLoadedSnowflakes), function(snowflake) {
			$('<img src="/snowflakes/'+fprefix+snowflake.replace("_",",")+'.jpg" id="'+snowflake+'" onerror="ie(this);">')
				.width(snowflakeSize).height(snowflakeSize).css("position", "absolute")
				.appendTo("#nightglider");
		});
		currentLoadedSnowflakes = neededSnowflakes;
	}, 50);
	var updateXYValue = _.debounce(function() {
		location.hash = currentX+"_"+currentY;
	}, 200);
	var reloadSnowflakes = function() {
		var w = $(window);
		currentIX = currentX - Math.floor(w.width()/2) - 400; // 256 is load offset
		currentIY = currentY - Math.floor(w.height()/2) - 400; 
		currentJX = currentX + Math.floor(w.width()/2) + 400; 
		currentJY = currentY + Math.floor(w.height()/2) + 400; 
		loadNewSnowflakes();
		positionSnowflakes();
	};
	$(window).on("resize", reloadSnowflakes);

	var flag = 0;
	var startX = 0;
	var startY = 0;
	var hasMoved = false;
	$("#nightglider").on("mousedown", function(e) { flag = 1; startX = e.screenX; startY = e.screenY; hasMoved = false; return false; });
	$("#nightglider").on("mouseup", function(e) {
		flag = 0;
		if(!hasMoved) {
			reloadSnowflakes();
			console.log("This point is " + (currentIX + e.clientX) + ", " + (currentIY + e.clientY));
		}
		return false;
	});
	$("#nightglider").on("mouseleave", function(e) { flag = 0; });
	$("body").on("mousemove", function(e){
		if(flag == 0) return false;
		// EDITOR CODE
		var ep = $("#editorPreview");
		if(ep !== undefined) {
			var pos = ep.position();
			if(pos !== undefined) {
				ep.css("left", pos.left - startX + e.screenX)
					.css("top", pos.top - startY + e.screenY);
			}
		}
		// END EDITOR CODE
		hasMoved = true;
		currentX = currentX - e.screenX + startX;
		currentY = currentY - e.screenY + startY;
		updateXYValue();
		startX = e.screenX; startY = e.screenY;
		reloadSnowflakes();
		return false;
	});
	var isWebkit = 'webkitRequestAnimationFrame' in window;
	function checkDelta() {
		var maxD = isWebkit ? 350 : 250;
		return Math.abs(window.pageXOffset - 500) > maxD
			|| Math.abs(window.pageYOffset - 500) > maxD;
	}
	var isRendering = false;
	var render = function(pXO, pYO) {
			currentX = currentX + pXO - 500;
			currentY = currentY + pYO - 500;
			window.scrollTo(500,500);
			reallyPositionSnowflakes();
			reloadSnowflakes();
			updateXYValue();
			isRendering = false;
		}
	function scroller(e) {
		if(isRendering) return;
		isRendering = true;
		render(window.pageXOffset, window.pageYOffset);
	}
	var lazyScroller = _.debounce(scroller, 500);
	$(window).on("scroll", scroller);
	window.scrollTo(500,500);
	$("#zoomPlus").on("click", function(e) { e.preventDefault(); zoom(1); });
	$("#zoomMinus").on("click", function(e) { e.preventDefault(); zoom(-1); });
	setTimeout(reloadSnowflakes, 100);
	var socket = io.connect('http://asie.pl:9120');
	socket.on('newSnowflakes', function (data) {
		_.each(data.list, function(chunk) {
			var chunkID = chunk.replace(",", "_");
			$("#"+chunkID).remove();
			currentLoadedSnowflakes = _.without(currentLoadedSnowflakes, chunkID);
		});
		reloadSnowflakes();
	});
});

