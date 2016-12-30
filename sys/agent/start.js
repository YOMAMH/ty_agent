var os = require('os');
var path = require('path');
var pm2 = require('../node_modules/pm2');

var arch = 'x86';
var platform = 'linux';
if (os.arch() == 'x64') {
	arch = 'x64';
};

var interpreter = path.join('./node/' + platform + '/' + arch + '/node/bin/node');
var script = path.join('./sys/agent/index.js');

pm2.connect(function(err) {
	if (err) return console.error(err);
	var opts = {
		name             : 'agent',
		script           : script,
		exec_interpreter : interpreter
	}
	pm2.start(opts, function(err, apps) {
		pm2.disconnect()
		if (err) throw err;
	})
});