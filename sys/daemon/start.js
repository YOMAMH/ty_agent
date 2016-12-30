var path = require('path')
var child_process = require('child_process');
child_process.fork(path.join(__dirname, './child.js'));
process.exit(0);