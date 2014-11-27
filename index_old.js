var slide = require('slide')
  , chain = slide.chain
  , asyncMap = slide.asyncMap
  , path = require('path')
  , fs = require('fs')
  , mkdirp = require('mkdirp')
  , spawn = require('child_process').spawn
  , tap = require('tap')
  , log = require('npmlog')
  , temp = require('temp')
  ;


var configure = module.exports = function configure(f) {
  f(t);
};

var required = configure.required = function required(msg) {
  return function (error, t, title) {
    if (error) {
      log.error(title, msg + error); 
    } else {
      log.info(title, 'found');
    }
  }
}

var optional = configure.optional = function optional(callback) {
  return function (error, t, title) {
    callback(error ? false : true);
  }
}
var t = {};

t.config = {};


function gyp(name, sources) {
  var g = { 'targets': [
    { 'target_name': name
    , 'type': 'executable' 
    , 'sources': sources 
    }
  ]};
  return JSON.stringify(g, null, 2) + '\n';
}

function runGyp(command, directory, cb) {
  spawn('node-gyp', [command], { 'cwd': directory, 'stdio': 'inherit'})
      . on('close', function(code) { cb(code ? new Error('node-gyp failed: ' + code): undefined); })
      ;
}

function makeTestProject(root, code, gyp, cb) {

  function writeProjectFiles(dir, cb) {
    var projectFiles = [ { 'name': path.join(dir, "test.cpp"), 'content': code }
                       , { 'name': path.join(dir, "binding.gyp"), 'content': gyp }
                       ];

    asyncMap(projectFiles, function(file, cb) {
      fs.writeFile(file.name, file.content, cb)
    }, cb);
  }
  chain([ [ mkdirp, root ]
        , [ writeProjectFiles, root]
        ], cb);
}

function testProject(dirname, code, options) {
  return [ [ makeTestProject, path.join("build", "configure"), code, gyp("test", ["test.cpp"]) ]
         , [ runGyp, 'configure', chain.last ]
         , [ runGyp, 'build', chain.last ]
         ];
}

t.cxx = function cxx(title, code, options, callback) {
  var cb = typeof options == 'function' ? options : (callback || required("failed"));
  var opts = typeof options == 'object' ? options : (callback || {});
  if (cb === required) {
    cb = required();
  } else if (cb === optional) {
    cb = optional(function () {});
  }
  chain(testProject("ttt", code, options), function (error, result) { cb(error, t, title)});
}
