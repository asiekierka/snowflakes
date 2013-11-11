var _ = require("underscore")
  , fs = require("fs")
  , path = require("path");

exports.fileExt = function(name) {
  var ext = path.extname(name).split(".");
  return ext[ext.length-1];
}
