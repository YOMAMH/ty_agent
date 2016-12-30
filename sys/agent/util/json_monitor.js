//检测文件更新时间，配置文件有更新时读取更新，发出change事件
var fa = require('./fa');
var json_util = require('./json');
function JsonMonitor(json_file) {
    this.monitor_file = json_file;
    this.checker = fa.createChecker(this.monitor_file);
    this.json = {};
    var handler = this.handler = {};
    //读，成功，starttimer
    this.on_error = function(error) {
        if ( this.handler['error'] ) {
            var handler = this.handler['error'];
            for ( var i = 0; i < handler.length; i++) handler[i](error);
        }
    };
    fa.readjson(this.monitor_file, function(error, json) {
        if ( error ) this.on_error(error);
        else {
            this.checker.init();
            this.json = json;
            this.hTimer = setInterval(this.check.bind(this), 5 * 1000);
            if (this.handler['load']) {
                var handler = this.handler['load'];
                for ( var i = 0; i < handler.length; i++ ) handler[i]();
            }
        }
    }.bind(this));
}

JsonMonitor.prototype.check = function() {
    var self = this;
    this.checker.check(function (error, modifyed) {
        if (error || !modifyed) return;
        fa.readjson(this.monitor_file, function on_json(error, json){
            if ( error ) return this.on_error(error);
            if ( json_util.eq(this.json, json) ) return;
            this.json = json;
            if ( this.handler['change']) {
                var handler = this.handler['change'];
                for ( var i = 0; i < handler.length; ++i ) {
                    handler[i]();
                }
            }
        }.bind(this));
    }.bind(this));
};

JsonMonitor.prototype.stop = function() {
    if (this.hTimer) {
        clearInterval(this.hTimer);
        this.hTimer = undefined;
    }
};

//load事件, change事件, error事件
JsonMonitor.prototype.on = function (event, cb) {
    if (this.handler[event]) {
        this.handler[event].push(cb);
    }
    else this.handler[event] = [cb];
};

module.exports = JsonMonitor;