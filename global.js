var configure = require('./configure');

for (var f in configure) { global[f] = configure[f]; }
