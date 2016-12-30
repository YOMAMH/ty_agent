var child_process = require('child_process');
var path = require('path')
child_process.fork(path.join(__dirname, './__sys_agent.js'));
process.exit(0);