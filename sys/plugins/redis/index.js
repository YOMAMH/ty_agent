var json_util = require('../../agent/util/json');
var Event = require('../../agent/util/event');
var Telnet = require('../../agent/util/telnet');
var keys = require('./keys');
var endTok = '\r\n';
var msg = 'NOAUTH Authentication required';
var metrics = {};
var time = 0;
var flag = 0;
var prove = {};

function RedisReader(logger, config) {
    Event(this, {error: false});
    this._config = json_util.clone(config);
    this.logger = logger;
    time = config.time;
}


var umap = {
    kB: 1024, KB: 1024, mB: 1024 * 1024, MB: 1024 * 1024, B: 1, gB: 1024 * 1024 * 1024,
    GB: 1024 * 1024 * 1024, ms: 1000,hun:100
};

function handleStr(item, val) {
if (parseInt(val) > 0) {
    if (keys.all.indexOf(item) != -1) {
        val = parseInt(val);
        if (keys.byteItems.indexOf(item) != -1) val = val / (umap.MB);
        if (keys.timeItems.indexOf(item) != -1) val = val * (umap.ms);
        if (keys.otherItems.indexOf(item) != -1) val = val / (umap.KB);
        if (keys.hundredMap.indexOf(item) != -1) val = val / (umap.hun);
        metrics[item] = parseInt(val).toString();
    }
}

    if (keys.calculateMap.hasOwnProperty(item)) {
        if (keys.hundredMap.indexOf(item) != -1) val = val / (umap.hun);
        metrics[keys.calculateMap[item]] = val;
        console.log(metrics);
    }

    if (item == 'rdb_last_bgsave_time_sec') {
        metrics['rdb_last_bgsave_status'] = '0';
        if (val == 'ok') metrics['rdb_last_bgsave_status'] = '1';
    }
}


function handleDb0(redisArr, i) {
    var keysStr = redisArr[i].substring(redisArr[i].indexOf(':') + 1);
    var keys = keysStr.match(/\d+/g);
    metrics['keys_count'] = keys[0];
    metrics['expired_keys_sec'] = keys[1];

}

function do_read(logger, time_out, config,cb) {
    function callBack() {
        var callback = cb;
        cb = null;
        console.log(arguments);
        if (callback) callback.apply(this, arguments);
    }

    function writed() {
        var str = '';
        if (config.params && config.params.password) {
            str += 'auth ' + config.params.password + '\n';
        }
        str += '\tinfo\n';
        return str;
    }

    var tn = new Telnet({url: '127.0.0.1:6379'});
    tn.connect(function (err, client) {
        function retErr(err) {
            logger.error(err.toString());
            var msg = err.code || err.toString();
            return callBack({code: '1', msg: msg});
        }

        if (err) return retErr(err);
        client.on('error', function (error) {
            return retErr(error);
        })

        client.on('connect', function () {
            var str = writed();
            client.write(str);
        })
        var chunks = [];
        var size = 0;
        client.on('data', function (data) {
            chunks.push(data);
            size += data.length;
            client.end();
        });

        client.on('end', function () {
            var buf = Buffer.concat(chunks, size);
            var str = buf.toString();
            // -NOAUTH Authentication required.
            if (str.indexOf(msg) > 0) {
                // code 1 => error
                logger.error(msg);
                return callBack({code: '1', msg: msg});
            }
            var redisArr = str.split(/\r\n/);
            var i = 0;
            for (i; i < redisArr.length; i++) {
                if (redisArr[i].indexOf(':') != -1 && redisArr[i].indexOf('db0:') < 0) {
                    handleStr(redisArr[i].split(/:/)[0], redisArr[i].split(/:/)[1]);
                }
                if (redisArr[i].indexOf('db0:') != -1) handleDb0(redisArr, i);
            }
            if (flag == 0) {
                flag++;
                for (k in keys.calculateMap) {
                    prove[keys.calculateMap[k]] = metrics[keys.calculateMap[k]];
                    metrics[keys.calculateMap[k]] = '0';
                }
            } else {
                var f = 0;
                var res = 0;
                for (f in keys.calculateMap) {
                    res = (metrics[keys.calculateMap[f]] - prove[keys.calculateMap[f]]);
                    res = (res/time) > time ? (res/time) : res;
                    prove[keys.calculateMap[f]] = metrics[keys.calculateMap[f]];
                    metrics[keys.calculateMap[f]] = parseInt(res).toString();
                }
            }
            callBack(null, metrics);
        });
    })
}

//配置有更新,uri变化,地址变化,则重新初始化数据
RedisReader.prototype.update = function (new_instances) {
    for (var i = 0; i < new_instances.length; i++) {
        var new_instance = new_instances[i];
        var bol = json_util.eq(this._config, new_instance);
        if (new_instance.id === this._config.id && !bol) {
            this._config = json_util.clone(new_instance);
        }
    }
};

//宿主每分钟调用一次read,模块开始异步采集数据过程，立即返回，数据采集结do_read束后回调
RedisReader.prototype.read = function (cb) {
    //连接-->发数据->收数据->解析数据->回调
    do_read(this.logger, 4 * 1000, this._config, function (error, res) {
        if (error) return cb(error);
        return cb(null, res);
    }.bind(this));
}



module.exports = RedisReader;