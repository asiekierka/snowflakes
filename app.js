// sky conductor
// the universe creation toolkit
// (d) asie 2013

var express = require('express')
  , path = require('path')
  , fs = require('fs')
  , charm = require('charm')()
  , _ = require('underscore')
  , Canvas = require('canvas')
  , async = require('async')
  , Image = Canvas.Image
  , app = express()
  , server = require('http').createServer(app);

var io = require('socket.io').listen(server);

var config = require("./config.json");

var snowflakeSize = 512;

if(!fs.existsSync("./snowflakes")) fs.mkdirSync("./snowflakes");

charm.pipe(process.stdout);

fs.copyFile = function(src,dest) {
	fs.createReadStream(src).pipe(fs.createWriteStream(dest));
}

fs.size = function(name) {
	return fs.statSync(name).size;
}
var time = function(){ return Math.round(new Date().getTime() / 1000); }

function pReal(pos) {
	return (pos*snowflakeSize);
}
function pShard(pos) {
	return Math.floor(pos/snowflakeSize);
}
function pInShard(pos) {
	return pos%snowflakeSize;
}

var canvases = {};
var updatedCanvases = [];

function getShardAsCanvas(pos, cb, prefix) {
	prefix = prefix || "f";
	var size = snowflakeSize * (prefix == "r" ? 2 : 1);
	var canvas = new Canvas(size, size);
	var filename = "./snowflakes/"+prefix+pos[0]+","+pos[1]+".png";
	if(!_.contains(updatedCanvases, filename)) updatedCanvases.push(filename);
	if(canvases[filename] !== undefined) {
		cb(canvases[filename]);
	} else {
		canvases[filename] = canvas;
		if(!fs.existsSync(filename)) {
			cb(canvas);
		} else {
			var img = new Image();
			img.onload = function() {
				canvas.getContext("2d").drawImage(img, 0, 0, size, size);
				canvases[filename] = canvas;
				cb(canvas);
			}
			img.src = filename;
		}
	}
}

function sendUpdatesToClients() {
	var updates = [];
	_.each(updatedCanvases, function(filename) {
		var o = path.basename(filename).replace(/\.jpg/, "").replace(/\.png/, "").substr(1);
		if(!_.contains(updates, o)) updates.push(o);
	});
	io.sockets.emit("newSnowflakes", {"list": updates});
}

function saveCanvas(filename, cb) {
	console.log("> saving "+filename);

	var out = fs.createWriteStream(filename)
	  , stream = canvases[filename].createPNGStream();

	stream.on('data', function(chunk){
		out.write(chunk);
	});
	var mul = path.basename(filename).substr(0,1) == "r" ? 2 : 1;
	stream.on('end', function() {
		// let's also save as a jpeg, just in case
		var oldCanvas = canvases[filename];
		var whiteCanvas = new Canvas(snowflakeSize*mul, snowflakeSize*mul);
		var c = whiteCanvas.getContext("2d");
		c.fillStyle = "#FFFFFF";
		c.fillRect(0,0,snowflakeSize*2, snowflakeSize*2);
		c.drawImage(oldCanvas, 0, 0);
		out = fs.createWriteStream(filename.replace("png", "jpg"));
		stream = whiteCanvas.createJPEGStream({quality: 85});
	
		stream.on('data', function(chunk){
			out.write(chunk);
		});
		stream.on('end', function() {
			cb();
		});
	});
}

app.use('/snowflakes', express.static('snowflakes'));
app.use('/static', express.static('static'));

var editPrefix = "/colorfulFlyingHorses";
app.post(editPrefix+'/upload', express.bodyParser(), function(req,res) {
	if(_.isString(req.body.x)) req.body.x = parseInt(req.body.x);
	if(_.isString(req.body.y)) req.body.y = parseInt(req.body.y);
	if(_.isString(req.body.width)) req.body.width = parseInt(req.body.width);
	addShard(req.files.image.path, req.body.x, req.body.y, function() {
		console.log("new image uploaded");
		saveCanvases(function() {
			res.redirect(200, editPrefix);
		});
	}, req.body.width);
});

app.get(editPrefix, function(req, res) {
	res.sendfile("edit.html");
});
app.get('/', function(req, res) {
	res.sendfile("index.html");
});

prettyPrintMOTD();

function addShard(filename, x, y, cb, width, prefix) {
	width = width || 0;
	prefix = prefix || "f";
	console.log("found unparsed shard "+filename);
	var locStart = [x, y];
	var locType = prefix;
	var img = new Image();
	img.onload = function() {
		if(width == 0) width = img.width;
		var height = img.height * width / img.width;
		var locEnd = [locStart[0]+width-1, locStart[1]+height-1];
		if(locType == "R" || locType == "r") { // Top-right, bottom-right
			locEnd[0] -= width;
			locStart[0] -= width;
		}
		if(locType == "l" || locType == "r") { // Bottom-left, bottom-right
			locEnd[1] -= height;
			locStart[1] -= height;
		}
		var locString = "("+locStart[0]+", "+locStart[1]+" -> "+locEnd[0]+", "+locEnd[1]+")";
		console.log("> updating shards "+locString);
		var positions = [];
		for(var y = pShard(locStart[1]); y <= pShard(locEnd[1]); y++) {
			for(var x = pShard(locStart[0]); x <= pShard(locEnd[0]); x++) {
				positions.push([x,y]);
			}
		}
		async.each(positions, function(pos, cb) {
			var x = pos[0], y = pos[1];
			//console.log("> > "+x+", "+y);
			// x1, y1, x2, y2
			var shardSize = [pReal(x), pReal(y), pReal(x)+snowflakeSize-1, pReal(y)+snowflakeSize-1];
			var shardOffset = [pReal(x), pReal(y)];
			if(shardSize[0] < locStart[0]) shardSize[0] = locStart[0];
			if(shardSize[1] < locStart[1]) shardSize[1] = locStart[1];
			if(shardSize[2] > locEnd[0]) shardSize[2] = locEnd[0];
			if(shardSize[3] > locEnd[1]) shardSize[3] = locEnd[1];
			var shardPos = [shardSize[0] - shardOffset[0], shardSize[1] - shardOffset[1]];
			var imgPos = [shardSize[0] - locStart[0], shardSize[1] - locStart[1]];
			var imgSize = [shardSize[2] - shardSize[0] + 1, shardSize[3] - shardSize[1] + 1];
			// the image position and size will be using width and not img.width
			var origImgSize = [imgSize[0] * img.width / width, imgSize[1] * img.height / height];
			imgPos[0] = imgPos[0] * img.width / width;
			imgPos[1] = imgPos[1] * img.height / height;
			getShardAsCanvas([x, y], function(canvas) {
				console.log("> > drawing image "+imgPos[0]+", "+imgPos[1]+" -> "+shardPos[0]+", "+shardPos[1]+" ("+imgSize[0]+", "+imgSize[1]+")");
				canvas.getContext("2d").drawImage(img, imgPos[0], imgPos[1],
					origImgSize[0], origImgSize[1],
					shardPos[0], shardPos[1],
					imgSize[0], imgSize[1]);
				// retina
				getShardAsCanvas([x, y], function(canvas) {
					canvas.getContext("2d").drawImage(img, imgPos[0], imgPos[1],
						origImgSize[0], origImgSize[1],
						shardPos[0]*2, shardPos[1]*2,
						imgSize[0]*2, imgSize[1]*2);
					cb();
				}, "r");
			});
		}, function() {
			console.log("> updating shards "+locString+" complete");
			cb();
		});
	}
	img.src = filename;
}

function saveCanvases(cb) {
	async.each(updatedCanvases, saveCanvas, function() {
		console.log("all canvases saved");
		if(updatedCanvases.length > 0) {
			console.log("revision "+(config.revision+1)+" (from "+config.revision+")");
			config.revision++;
		} else {
			console.log("revision "+config.revision);
		}
		sendUpdatesToClients();
		updatedCanvases = [];
		cb();
	});
}

async.eachSeries(fs.readdirSync("./newShards/"), function(filename, nextShard) {
	var basename = path.basename(filename);
	var hasWidth = basename.substr(0,1) == "s";
	var width = hasWidth ? basename.split("-")[0].substr(1) : 0;
	if(hasWidth) basename = basename.split("-")[1];
	var locStart = _.map(basename.substr(1).replace("_", ",").split(','),
		function(locStr) { return parseInt(locStr); });
	var locType = basename.substr(0,1);
	addShard("./newShards/"+filename, locStart[0], locStart[1], function() {
		fs.rename("./newShards/"+filename, "./oldShards/"+filename);
		nextShard();
	}, width, locType);
}, function() {
	saveCanvases(function() {
		fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
		server.listen(9120);
	});
});

function prettyPrintMOTD() {
	var motd = fs.readFileSync("./motd.txt", {encoding: "utf8"}).toString().split('\n');
	var colors = [8, 8, 15, 15, "blue", 15];
	_.each(motd, function(line) {
		charm.foreground(colors.shift()).write(line+'\n');
	});
}
