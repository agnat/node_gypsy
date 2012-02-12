var spawn = require('child_process').spawn
  , path  = require('path')
  , nopt  = require('nopt')

  , knownOptions =
    { 'help'      : Boolean
    , 'gyp-help'  : Boolean
    , 'node-tree' : path
    }
  , help =
    { 'help'      : 'print this text and exit'
    , 'gyp-help'  : 'print gyp help'
    , 'node-tree' : ['directory', 'configure using node found in directory']
    }
  ;


exports.configure = function configure(checks) {
  var config = new Configuration(knownOptions);
  if (config.options.help) {
      console.log('called for help.');
  } else if (config.options['gyp-help']) {
    config.gyp.args = ['--help'];
    console.log('gyp help:')
    gyp_addon(config);
  } else {
    function done(error) {
      console.log('configuration done.');
      console.log('running gyp ...')
      gyp_addon(config) 
    }
    config.node = require('build_configuration');
    checks(config, done);
  }
}

exports.options = function options(f) {
  f(knownOptions, help)
}

function gyp_addon(config) {
  var args = gyp_arguments(config.gyp)
    , gyp = spawn(path.join(config.node.buildTree, 'tools', 'gyp_addon'), args)
    ;
  
  console.log('gyp args:', args)
  function log(buffer) { console.log(buffer.toString()) }
  gyp.stdout.on('data', log);
  gyp.stderr.on('data', log);
  gyp.on('exit', function(code) {
    if (code) {
      console.log('gyp_addon exited with code', code);
      process.exit(code)
    } else {
      console.log('gyp done.')
    }
  });
}

function gyp_arguments(gyp_config) {
  return gyp_config.args;
}


var Configuration = function Configuration(options) {
  this.gyp = { args: [] }
  this.options = nopt(options);
  for (var o in this.options) {
    if (o !== 'argv' && options[o] === undefined) {
      this.gyp.args.push((o.length === 1 ? '-' : '--') + o);
      if (typeof this.options[o] !== 'boolean') {
        this.gyp.args.push(this.options[o]);
      }
      delete this.options[o];
    }
  }
};

Configuration.prototype =
{ gyp: null
}

