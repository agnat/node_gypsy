#!/usr/bin/env node
var configure = require('gypsy').configure
  ;

configure(require('./package.json'), function probe(t) {
  t.checkHeaderFile("string.h");
  t.checkSymbol("printf", ['stdio.h']);
});
