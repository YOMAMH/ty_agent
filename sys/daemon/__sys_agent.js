var child_process = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path')

var arch = 'x86';
if (os.arch() == 'x64') arch = 'x64';

var node = path.join(__dirname, '../../node/linux/' + arch + '/node/bin/sys-node');
var index = path.join(__dirname, '../agent/index.js');
var _path = path.join(__dirname, './__sys_agent.pid');

function startAgent() {
    var pid = process.pid;
    var cmd = 'echo ' + pid + ' > ' + _path;
    if (pid) {
        child_process.execSync(cmd);
    }
    var options = {
        cwd: process.cwd(),
        env: process.env
    };
    var command = node + ' ' + index;

    while (true) {
        try {
            child_process.execSync(command, options);
        } catch(e) {};
    }
};

function readCmdline(pid) {
    if (!pid) return;
    pid = (pid).toString().trim();
    var cmdline_path =  '/proc/' + pid + '/cmdline';
    console.log(cmdline_path)
    try {
        var data = fs.readFileSync(cmdline_path)
        return data;
    } catch(e) {
        return;
    }
};

fs.readFile(_path, function(err, data) {
    if (err) return startAgent();
    var result = readCmdline(data.toString());
    if (!result || result.indexOf('__sys_agent') < 0) {
        return startAgent();
    }
});