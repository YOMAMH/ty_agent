//检测文件更新时间，配置文件有更新时读取更新，发出change事件
var JsonMonitor = require('./util/json_monitor');
var file = require('path').join(__dirname, '../../tingyun.json');

function Config() {
    this.monitor = new JsonMonitor(file);
}

Config.prototype.value = function() { return this.monitor.json;};
Config.prototype.stop = function() { this.monitor.stop(); };

//load事件, change事件, error事件
Config.prototype.on = function (event, cb) { this.monitor.on(event, cb); };

module.exports = Config;