'use strict';
//功能:
//1.login.init.upload
//2.upload cache
//3.get package. load package
//4.log module
require('./domain');
var Server = require("./server");
//配置信息模块,负责配置信息的自动更新
var Config = require("./config");
//tasks 接口
var Tasks = require("./tasks");
var Logger = require("./util/logger");
var serverConfig = require('../../tingyun.json').server;
var logger = null;
//agent实例4个对象成员
//1.config ==>本地配置文件读取，3个事件: load, change, error.
//2.server ==>服务器通信，2个事件: login,error. 1个method: report(json)
//3.log
//4.tasks
function Agent() {
    this.version = serverConfig.version;
    this.inited = false;
    this._config = new Config();
    this.configuration = function() { return this._config.value(); };
    this.log = new Logger(Logger.prototype.config(this.configuration()));
    logger = this.log.child('Agent');
    this._config.on('load', this.init.bind(this));
    this._config.on('error', function(error) {
        logger.error(error);
        console.log(error);
        if (!this.inited) setTimeout(function(){process.exit(0);}, 1000);
    }.bind(this));
}

Agent.prototype.init = function() {
    console.log('agent starting.');
    logger.info('Tingyun system agent start.');
    this.tasks = new Tasks(logger.child('tasks'), this.configuration());
    //有数据上来，交给server,发送到服务器.
    this.tasks.on('data', function(report) {
        if (this.local_port) this.local_port.push(report);//本地提供的数据浏览服务。
        this.server.report(report);
    }.bind(this));

    this.tasks.on('error', function(error) {
        this.server.reportError(error);
    }.bind(this));

    this.server = new Server(this.version, this.configuration(), this.log.child('server'));
    //server登录后，更新tasks
    this.server.on("login", function(error, result) {
        if ( error ) logger.error(error);
        this.tasks.start();
        console.log('tasks starting.');
        this.tasks.update(this.configuration(), result.result);
    }.bind(this));

    this.server.on('stop', function() {
        this.tasks.destroy();
    }.bind(this));

    this._config.on('change', function() {
        var config = this.configuration();
        this.server.update(config);
        // this.tasks.update(config);
    }.bind(this));
    this.inited = true;
};
var agent = new Agent();