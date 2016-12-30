var json_util = require('../../agent/util/json');
var Event = require('../../agent/util/event');
var Telnet = require('../../agent/util/telnet');
var keys = require('./keys');
var endTok = '\r\n';

function MemcachedReader(logger, config) {
    Event(this, {error: false});
    this._config = json_util.clone(config);
    this.logger = logger;
}

function readVal(str, name, endTok) {
    var posAccess = str.indexOf(name);
    if ( posAccess == -1 ) return null;
    var posEnd = str.indexOf(endTok, posAccess + name.length);
    if ( posEnd == -1 ) return null;
    return str.slice(posAccess + name.length, posEnd);
}

function transform(metrics) {
    Object.keys(metrics).forEach(function(key) {
        if(keys.byteItems.indexOf(key) > -1) {
            metrics[key] = Math.round(metrics[key] / (1024 * 1024)) + '';
        }
    });
    return metrics;
}

function keyname(key) {
    return 'STAT ' + key + ' ';
}

function do_read(logger, time_out, config, cb) {
    function callBack() {
        var callback = cb; cb = null;
        if (callback) callback.apply(this, arguments);
    }
    
	var tn = new Telnet(config);
    tn.connect(function(err, client) {
        function retErr(err) {
            logger.error(err.toString());
            var msg = err.code || err.toString();
            return callBack({code: '1', msg: msg});
        }

        if (err) return retErr(err);
        client.on('error', function(error) {
            return retErr(error);
        })

        client.on('connect', function() {
            client.write('stats\n');
        })

        var chunks = [];
        var size = 0;
		client.on('data', function(data) {
            chunks.push(data);
            size += data.length;
            client.end();
		});
        
        client.on('end', function() {
            var buf = Buffer.concat(chunks, size);
            var str = buf.toString();
            var metrics = {};
            var keysAll = keys.all;
            for (var i = 0; i < keysAll.length; i++) {
                var key = keysAll[i];
                metrics[key] = readVal(str, keyname(key), endTok);
            }
            callBack(null, transform(metrics));
        });
    })
}

//配置有更新,uri变化,地址变化,则重新初始化数据
MemcachedReader.prototype.update = function (new_instances) {
    for (var i = 0; i < new_instances.length; i++) {
        var new_instance = new_instances[i];
        var bol = json_util.eq(this._config, new_instance);
        if (new_instance.id === this._config.id && !bol) {
            this._config = json_util.clone(new_instance);
        }
    }
};

//宿主每分钟调用一次read,模块开始异步采集数据过程，立即返回，数据采集结束后回调
MemcachedReader.prototype.read = function (cb) {
    //连接-->发数据->收数据->解析数据->回调
    do_read(this.logger, 4 * 1000, this._config, function (error, res) {
        if (error) return cb(error, null);
        return cb(null, res);
    }.bind(this));
}

module.exports = MemcachedReader;