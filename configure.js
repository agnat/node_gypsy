#!/usr/bin/env node
var configure = require('./index.js')
  ;

configure(function (t) {
  var optional = configure.optional;

  t.plan(3);

  t.headerFile("dns_sd.h");
  t.headerFile("bad.h", optional);
  t.headerFile("string.h", optional);
  
});
