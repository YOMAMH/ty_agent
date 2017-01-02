var json_util = require('../../agent/util/json');
var Event = require('../../agent/util/event');
var httpGet = require('./get');
var keys = require('./keys');
var flag = 0;
var prove = {};
var nginxObj = {};
var time = 2;
var dif = 0;
var metrics = {};

function NginxReader(logger, config) {
    Event(this, {error: false});
    this.config = json_util.clone(config);
    this.logger = logger;
    time = config.time;
}

function handleStr(item, val) {
    dif = parseInt(val);
    if (keys.handleHun.indexOf(item) != -1) dif = val * keys.umap.hun;
    if (keys.handleTen.indexOf(item) != -1) dif = val * keys.umap.ten;
    metrics[item] = parseInt(dif);
}

function readVal(str, name, endTok) {
    var argMap = keys.values;
    var posAccess = '';
    var posEnd = '';
    var strArr = str.split('\n');
    if (argMap.indexOf(endTok) !== -1) {
        var strTemp = strArr[2];
        var arrTemp = strTemp.split(' ');
        switch (endTok) {
            case 'connect':
                return {value: arrTemp[1], end: str.indexOf(arrTemp[1])};
                break;
            case  'success':
                return {value: arrTemp[2], end: str.indexOf(arrTemp[2])};
                break;
            case 'request':
                return {value: arrTemp[3], end: str.indexOf(arrTemp[3])};
                break;
            default :
                break;
        }
    }
    posAccess = str.indexOf(name);
    if (posAccess == -1) return null;
    posEnd = str.indexOf(endTok, posAccess + name.length);
    if (posEnd == -1) return null;
    return {value: str.slice(posAccess + name.length, posEnd), end: posEnd + endTok.length};
};

// 获取nginx信息
function readInfo(logger, time_out, config,cb) {

    // 获取nginx运行信息
    httpGet(config, onGet);
    // 回调处理
    function callBack() {
        var callback = cb;
        cb = null;
        if (callback) callback.apply(this, arguments);
    }

    function onGet(error, result) {
        if (error) {
            logger.error(error.toString());
            var msg = error.code || error.toString();
            return callBack({code: '1', msg: msg});
        }

        // 解析result, 生成json对象
        do {
            var active = readVal(result, 'Active connections: ', ' ');
            if (!active) break;
            var handledConnects = readVal(result, '', 'connect');
            if (!handledConnects) break;
            var handledSuccess = readVal(result, '', 'success');
            if (!handledSuccess) break;
            var handledRequests = readVal(result, '', 'request');
            if (!handledRequests) break;
            var reading = readVal(result, 'Reading: ', ' ');
            if (!reading) break;
            var writing = readVal(result, 'Writing: ', ' ');
            if (!writing) break;
            var waiting = readVal(result, 'Waiting: ', ' ');
            if (!waiting) break;
            nginxObj = {
                active: active.value,
                handled_connects: handledConnects.value,
                handled_success: handledSuccess.value,
                handled_requests: handledRequests.value,
                reading: reading.value,
                writing: writing.value,
                waiting: waiting.value
            };
            var k = '';
            for (k in nginxObj) {
                handleStr(k, nginxObj[k]);
            }
            if (flag < 1) {
                flag++;
                var item = 0;
                for (item in metrics) {
                    if (keys.calculate.indexOf(item) != -1) {
                        prove[item] = metrics[item];
                        metrics[item] = '0';
                    }
                }
                metrics['conns_opened_percent'] = '0';
                metrics['connections_dropped_sec'] = '0';
            } else {
                var c = 0;
                var res = 0;
                for (c in metrics) {
                    metrics[c] = parseInt(metrics[c]);
                    if (keys.calculate.indexOf(c) != -1) {
                        res = resultValue(metrics[c], prove[c], time);
                        prove[c] = metrics[c];
                        metrics[c] = res.toString();
                    }
                }
                var opened = parseInt(metrics['handled_success']/metrics['handled_requests']*100).toString();
                var dropped = parseInt((Math.abs(metrics['handled_requests'] - metrics['handled_success'])/metrics['handled_requests'])*100).toString();
                metrics['conns_opened_percent'] = opened;
                metrics['connections_dropped_sec'] = dropped;
            }
            return callBack(null, metrics);
        } while (false);
        return callBack({code: '1', msg: 'Unknown Server'});
    }
}


// 配置有更新,uri变化,地址变化,则重新初始化数据
NginxReader.prototype.update = function (new_instances) {
    for (var i = 0; i < new_instances.length; i++) {
        var new_instance = new_instances[i];
        var bol = json_util.eq(this.config, new_instance);
        if (new_instance.id === this.config.id && !bol) {
            this.config = json_util.clone(new_instance);
        }
    }
};

function resultValue(arg1, arg2, time) {
    var res = (parseInt(arg1) - parseInt(arg2));
    return (res / time) > time ? (res / time) : res;
}
// 宿主每分钟调用一次read,模块开始异步采集数据过程，立即返回，数据采集结束后回调
NginxReader.prototype.read = function (ondata) {
    readInfo(this.logger, 4 * 1000, this.config, function (error, res) {
        if (error) return ondata(error);
        ondata(null, res);
    }.bind(this));
};

module.exports = NginxReader;