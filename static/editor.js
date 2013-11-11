var flag = 0;

function loadMeAnImage(event) {
	var selectedFile = event.target.files[0];
	var reader = new FileReader();

	var imgtag = document.getElementById("editorPreview");
	imgtag.title = selectedFile.name;
	
	reader.onload = function(event) {
		flag |= 2;
		$("#editorPreview").css("left", "0px").css("top", "0px");
		imgtag.src = event.target.result;
		$("#editorPreview").css("left", "0px").css("top", "0px");
	};
	
 	reader.readAsDataURL(selectedFile);
}

$('<img id="editorPreview">').css("top", "0px").css("left", "0px").css("width", "300px").css("height", "auto").appendTo("#nightglider");

var startX = 0;
var startY = 0;

$("#editorPreview").on("mousedown", function(e) {
	flag |= 1;
	startX = e.screenX; startY = e.screenY;
	var parentOffset = $(this).offset(); 
	var relX = e.pageX - parentOffset.left;
	var relY = e.pageY - parentOffset.top;
	var resXP = $(this).width() - 24;
	var resYP = $(this).height() - 24;
	if(relX >= resXP && relY >= resYP) flag |= 4;
	return false;
});
$("*").on("mouseup", function(e) { flag &= 2; $("#editorPreview").css("opacity", 1); return false; });
$("body").on("mousemove", function(e){
	if((flag & 3) != 3) return false;
	if((flag & 4) == 0) { // Drag
		var pos = $("#editorPreview").position();
		$("#editorPreview").css("left", pos.left - startX + e.screenX)
			.css("top", pos.top - startY + e.screenY)
			.css("opacity", 0.65);
	} else { // Resize
		var xr = e.screenX - startX;
		var yr = e.screenY - startY;
		var rl = Math.min(xr, yr);
		var ep = $("#editorPreview");
		var newWidth = ep.width() + rl;
		ep.width(newWidth);		
	}
	startX = e.screenX; startY = e.screenY;
	return false;
});
$("#uploadButton").on("click", function(e) {
	e.preventDefault();
	var viewOffset = getViewOffset();
	var ep = $("#editorPreview");
	var position = ep.position();
	$("#fX").val(viewOffset[0]+position["left"]); $("#fY").val(viewOffset[1]+position["top"]);
	$("#fWidth").val(ep.width());
	$("#uploadForm").submit();
	return false;
});
