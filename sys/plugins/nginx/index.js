var json_util = require('../../agent/util/json');
var Event = require('../../agent/util/event');
var httpGet = require('./get');
var keys = require('./keys');
var flag = 0;
var prove = 0;
var nginxObj = {};
var time = 2;
var dif = 0;

function NginxReader(logger, config) {
    Event(this, {error: false});
    this.config = json_util.clone(config);
    this.logger = logger;
    time = config.time;
};

function handelStr() {

}
function readVal(str, name, endTok) {
    var argMap = keys.values;
    var posAccess = '';
    var posEnd = '';
    var strArr = str.split('\n');
    if(argMap.indexOf(endTok)!== -1) {
        var strTemp = strArr[2];
        var arrTemp = strTemp.split(' ');
        switch (endTok){
            case 'connect': return {value: arrTemp[1], end:str.indexOf(arrTemp[1]) };
                break;
            case  'success': return {value: arrTemp[2], end: str.indexOf(arrTemp[2]) };
                break;
            default: return {value: arrTemp[3], end : str.indexOf(arrTemp[3]) };
                break;
        }
    }
    posAccess = str.indexOf(name);
    if (posAccess == -1) return null;
    posEnd = str.indexOf(endTok, posAccess + name.length);
    if (posEnd == -1) return null;
    return {value: str.slice(posAccess + name.length, posEnd), end: posEnd + endTok.length };
};

// 获取nginx信息
// logger, time_out, config,
function readInfo(cb) {

    // 获取nginx运行信息
    httpGet(config, onGet);
    // 回调处理
    function callBack() {
        var callback = cb;
        cb = null;
        console.log(arguments);
        if (callback) callback.apply(this, arguments);
    }

    function onGet(error, result) {
        if (error) {
            logger.error(error.toString());
            var msg = error.code || error.toString();
            return callBack({code:'1', msg: msg});
        }
        // result = 
        // "Active connections: 1 \nserver accepts handled requests request_time\n 26 26 36 \n
        // Reading: 0 Writing: 1 Waiting: 0 \n"

        // 解析result, 生成json对象
        do {
            var active = readVal(result, 'Active connections: ', ' ');
            if (!active) break;
            var handledConnects = readVal(result,'','connect');
            if (!handledConnects) break;
            var handledSuccess = readVal(result,'','success');
            if (!handledSuccess) break;
            var handledRequests = readVal(result,'','request');
            if (!handledRequests) break;
            var reading = readVal(result, 'Reading: ',' ');
            if(!reading) break;
            var writing = readVal(result, 'Writing: ',' ');
            if(!writing) break;
            var waiting = readVal(result, 'Waiting: ',' ');
            if(!waiting) break;
            nginxObj = {
                active          : active.value,
                handled_connects: handledConnects.value,
                handled_success : handledSuccess.value,
                handled_requests: handledRequests.value,
                reading         : reading.value,
                writing         : writing.value,
                waiting         : waiting.value
            };

            if (flag < 1) {
                prove = handledConnects.value;
                flag++;
                nginxObj['handled_connects_balance'] = "0";
            } else {
                dif = parseInt((handledConnects.value - prove) / time) >= time ?
                    parseInt((handledConnects.value - prove) / time) : handledConnects.value - prove;
                nginxObj['handled_connects_balance'] = dif.toString();
                prove = handledConnects.value;
            }
            return callBack(null, nginxObj);
        } while (false);
        return callBack({code:'1', msg:'Unknown Server'});
    }
};

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

// 宿主每分钟调用一次read,模块开始异步采集数据过程，立即返回，数据采集结束后回调
NginxReader.prototype.read = function(ondata) {
    readInfo(this.logger, 4 * 1000, this.config, function (error, res) {
        if (error) return ondata(error);
        ondata(null, res);
    }.bind(this));
};

module.exports = NginxReader;