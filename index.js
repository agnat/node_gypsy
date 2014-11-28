var path = require('path')
  , fs = require('fs')
  , spawn = require('child_process').spawn
  , slide = require('slide')
  , tap = require('tap')
  , mkdirp = require('mkdirp')
  , log = require('npmlog')
  , temp = require('temp')
  , fire = require('fire-ts')
  , chain = slide.chain
  , asyncMap = slide.asyncMap
  ;

temp.track();

var configure = exports.configure = function configure(json, cfg) {
  tap.test(function(t) {
    t.cxx = cxx;
    t.checkHeaderFile = checkHeaderFile;
    t.checkSymbol = checkSymbol;
    t.checks_ = [];
    t.package_ = json;
    t.config_ =
      { defines: {}
      , include_dirs: []
      , libraries: []
      , cflags: []
      , ldflags: []
      };

    cfg(t);

    var this_ = this;

    chain(t.checks_, function (error) {
      t.end();
      if (error) {
        log.error(error);
      } else {
        var configHeader = path.join('build', this_.package_.name + "_config.h")
          , install = process.env.npm_lifecycle_event == 'install'
          , installOpts = {stdio: 'inherit'}
          , params = 
            { includeGuard: (this_.package_.name + '_config_h').toUpperCase()
            , defines: this_.config_.defines
            }
          ;
        chain( [ [ mkdirp, 'build' ]
               , [ fs, "writeFile", configHeader, configTemplate(params) ]
               , install && [ runGyp, ['configure'], installOpts]
               , install && [ runGyp, ['build'], installOpts]
               ], function(error) { if (error) { log.error(error)}});
      }
    });
  });
}

function gyp(name, sources, type) {
  return JSON.stringify(
      { 'targets': [
        { 'target_name': name
        , 'type': type || 'executable' 
        , 'sources': sources
        , 'conditions': [['OS=="mac"', {'libraries!': ['-undefined dynamic_lookup']}]]
        }
      ]}, null, 2) + '\n';
}

function runGyp(args, options, cb) {
  function onClose(code) {
    cb(code ? new Error('node-gyp ' + args[0] + ' failed: ' + code) : undefined);
  }
  if ( ! cb) {
    cb = options;
    options = { stdio: 'ignore' };
  }
  spawn('node-gyp', args, options).on('close', onClose);
}

function writeProjectFiles(dir, code, type, cb) {
  var files = [ { name: path.join(dir, "test.cpp"), content: code }
              , { name: path.join(dir, "binding.gyp"), content: gyp("test", ["test.cpp"]) }
              ];

  asyncMap( files
          , function(file, cb) { fs.writeFile(file.name, file.content, cb) }
          , cb);
}

function compile(code, options, callback) {
  temp.mkdir('node-configure', function(error, directory) {
    if (error) { return callback(error) }
    var gypOpts = {cwd: directory};
    chain( [ [ writeProjectFiles, directory, code, 'executable' ]
           , [ runGyp, ['configure'], gypOpts ]
           , [ runGyp, ['build'], gypOpts ]
           ], callback);

  });
}

//==============================================================================

function cxx(code, options, resultHandler) {
  
  function cc(code, options, callback) {
    compile(code, options, function (error) {
      resultHandler(error);
      callback(error);
    });
  }
  this.checks_.push([ cc, code, options ]);
}

var required = configure.required = function required(t, title) {
  return function(error) {
    t.ok( ! error, title + '... ' + (error ? 'not found' : 'found'));
  }
}

var optional = configure.optional = function optional(t, title) {
  return function(error) { t.pass(title + '... ' + (error ? 'not found' : 'found')) }
}

function checkHeaderFile(name, options, resultPolicy) {
  var policy = typeof options == 'function' ? options : (resultPolicy || required)
    , opts   = typeof options == 'object'   ? options : (resultPolicy || {})
    , title  =  "Checking for header '" + name + "'"
    , handler = policy(this, title);
    ;
  this.cxx( program({ headers: [name] })
          , options
          , handler
          );
}

function checkSymbol(symbol, headers, options, resultPolicy) {
  var policy = typeof options == 'function' ? options : (resultPolicy || required)
    , opts   = typeof options == 'object'   ? options : (resultPolicy || {})
    , title = "Checking for symbol '" + symbol + "'"
    , handler = policy(this, title)
    , define = (this.package_.name + '_have_' + symbol).toUpperCase()
    , this_ = this;
    ;


  function addResult(error) {
    if ( ! error) {
      this_.config_.defines[define] = null;
    }
    handler(error);
  }

  this.cxx( program({body: "(void)" +  symbol + ";", headers: headers})
          , options
          , addResult
          );
}

function program(options) {
  options.body = options.body || '';
  options.headers = options.headers || [];
  options.exit = options.exit || 0;
  return programTemplate(options);
}

var programTemplate = fire.compile(function() {/*
//==============================================================================
<% for (var i in headers) { %>
#include <<%= headers[i] %>>
<% } %>

int main(int argc, char const* argv[]) {
    <%= body %>
    return <%= exit %>;
}
//==============================================================================
*/}.toString().split(/\n/).slice(2, -2).join("\n") + '\n');


var configTemplate = fire.compile(function() {/*
//==============================================================================
#ifndef <%= includeGuard %>
# define <%= includeGuard %>

<% for (var symbol in defines) { %>
# define <%= defines[symbol] ? symbol + ' = ' + defines[symbol] : symbol %>

<% } %>
#endif // <%= includeGuard %>
//==============================================================================
*/}.toString().split(/\n/).slice(2, -2).join("\n") + '\n');
