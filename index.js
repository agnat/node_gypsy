var path = require('path')
  , fs = require('fs')
  , spawn = require('child_process').spawn
  , slide = require('slide')
  , tap = require('tap')
  , mkdirp = require('mkdirp')
  , log = require('npmlog')
  , temp = require('temp')
  , chain = slide.chain
  , asyncMap = slide.asyncMap
  ;

temp.track();

var configure = module.exports = function configure(cfg) {
  tap.test(function(t) {
    t.cxx = cxx;
    t.headerFile = headerFile;
    cfg(t);
  });
}

function gyp(name, sources, type) {
  return JSON.stringify(
      { 'targets': [
        { 'target_name': name
        , 'type': type || 'executable' 
        , 'sources': sources 
        }
      ]}, null, 2) + '\n';
}

function runGyp(command, directory, cb) {
  function onClose(code) {
    cb(code ? new Error('node-gyp ' + command + ' failed: ' + code) : undefined);
  }
  spawn('node-gyp', [command], { 'cwd': directory, 'stdio': 'ignore'})
      . on('close', onClose)
      ;
}

function writeProjectFiles(dir, code, type, cb) {
  var projectFiles = [ { 'name': path.join(dir, "test.cpp"), 'content': code }
                     , { 'name': path.join(dir, "binding.gyp"), 'content': gyp("test", ["test.cpp"]) }
                     ];

  asyncMap( projectFiles
          , function(file, cb) { fs.writeFile(file.name, file.content, cb) }
          , cb);
}

function compile(t, code, options, resultPolicy) {
}

var required = configure.required = function required(t, title) {
  return function(error) {
    t.ok( ! error, title + '... ' + (error ? 'not found' : 'found'));
  }
}

var optional = configure.optional = function optional(t, title) {
  return function(error) { t.pass(title + '... ' + (error ? 'not found' : 'found')) }
}

function cxx(title, code, options, resultPolicy) {
  var policy = typeof options == 'function' ? options : (resultPolicy || required)
    , opts = typeof options == 'object' ? options : (resultPolicy || {})
    , callback = policy(this, title);
  
  temp.mkdir('node-configure', function(error, directory) {
    if (error) { return callback(error) }
    chain( [ [ writeProjectFiles, directory, code, 'executable' ]
           , [ runGyp, 'configure', directory ]
           , [ runGyp, 'build', directory ]
           ], callback);

  });
}

function headerFile(name, options, resultPolicy) {
  this.cxx("Checking for header file '" + name + "'", "#include <" + name + ">", options, resultPolicy);
}
