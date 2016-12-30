//server关注配置项

//连接项:
//redirect地址
//proxy信息
//登录失败重试间隔
//actions:服务器action,分别对应 redirect服务器, login服务器, upload服务器
//cache项:
//cache_count_max
//cache_size_max
/*
server_options = {
    redirect :'https://redirect.networkbench.com',
    login_retry : 5,
    actions :'getRedirectHost:initSysAgent:uploadMetrics',
    proxy : {
        server: 'http://192.168.2.51:8200',
        auth:'tingyun:123456'
    },
    max_cachecount: 1440,
    max_cachesize:50
};
*/
var os = require('os');
var fs = require('fs');
var path = require('path')
var Request = require('./util/http_request');
var Event = require('./util/event');
var json_util = require('./util/json');
var CacheQueue = require('./cache');

function read_config(config) {
    var result = {};
    if ( config.server && typeof config.server == 'object' ) result = json_util.clone(config.server);
    if ( ! result.hasOwnProperty('redirect') ) result.redirect = 'https://redirect.networkbench.com';
    if ( (! result.hasOwnProperty('login_retry')) || (typeof result.login_retry != 'number') ) result.login_retry = 5;//秒,登录失败重试间隔
    if ( (! result.hasOwnProperty('actions')) || (typeof result.actions != 'string') ) {
        result.actions = 'getRedirectHost:initSysAgent:uploadMetrics:reportError';
    }
    return result;
}

function changed(old_config, new_config) {
    if ( ! json_util.eq(old_config.redirect, new_config.redirect) ) return true;
    // if ( ! json_util.eq(old_config.actions, new_config.actions) ) return true;
    if ( old_config.hasOwnProperty('license') ) {
        if ( new_config.hasOwnProperty('license') ) {
            return ! json_util.eq(old_config.license, new_config.license);
        }
        return true;
    }

    if ( old_config.hasOwnProperty('proxy') ) {
        if ( new_config.hasOwnProperty('proxy') ) {
            return ! json_util.eq(old_config.proxy, new_config.proxy);
        }
        return true;
    }
    return false;
}
var default_action = ['getRedirectHost', 'initSysAgent', 'uploadMetrics', 'reportError'];

function getPathname(actions_string, ac_id) {
    var actions = actions_string.split(':');
    if ( actions.length > ac_id && typeof actions[ac_id] == 'string' && actions[ac_id].length > 0 ) {
        return actions[ac_id];
    }
    if ( ac_id > 2 ) return null;
    return default_action[ac_id];
}

function MakeUrl(url, config, version, ac_id, session_key) {
    var action = getPathname(config.actions, ac_id);
    if (!action ) return null;
    // ?licenseKey=999-999-999&version=1.1.0
    var urlstring = url + '/' + action + '?licenseKey=' + config.license + '&version=' + version.protocol;
    if (ac_id === 2) {
        urlstring += '&appSessionKey=' + session_key + '&t=' + parseInt(Date.now() * 0.001);
    }
    return urlstring;
}

function Server(version, config, logger) {
    Event(this, {error: false, login: false, stop: false});
    this.version = version;
    this.logger = logger;
    Request.prototype.set_logger(logger.child("Request"));
    this.config = read_config(config);
    this.config.version = version;
    this.cache = new CacheQueue();
    this.login(function(err, res) {
        if (err) {
            this.logger.error(err);
            this.logger.info('system agent stop in 3 seconds.')
            setTimeout(function() {
                process.exit(1);
            }, 3000);
        }
    }.bind(this));
    this.state = '';
}

Server.prototype.update = function(config) {
    //初始化
    var new_conf = read_config(config);
    if (changed(this.config, new_conf)) {  
        this.config = new_conf; 
        this._emit('stop');
        this.on_result('restart');
    } else {
        this.config = new_conf;
    }
};

var platform_map = {'win32':'Win'};
var arch_map = {'ia32':'x86','ia64':'x64'};

function getOS() {
    function os_name() { 
        return platform_map.hasOwnProperty(process.platform) ? platform_map[process.platform] : process.platform;}
    function arch_name() {
        return arch_map.hasOwnProperty(process.arch)?arch_map[process.arch]: process.arch;}
    // "linux-3.13.0-24-generic-x64"
    return os_name() + '-' + os.release() + '-' + arch_name();
}

function generateDomainId() {
    return 'D' + Date.now() + parseInt(Math.random() * 10);
}

Server.prototype.login = function(cb) {
    if (!( this.config.hasOwnProperty('license') && typeof this.config.license == 'string')) {
        return cb('license not found.'); 
    }
    if (!(this.config.hasOwnProperty('domain') && typeof this.config.domain == 'string')) {
        this.config.domain = generateDomainId();
    }
    if (this.conn) { this.conn.destroy(); this.conn = null; }//停掉之前的所有连接
    if (!this.config || !this.config.redirect) return;
    this.upload_server = null;
    //生成login上行数据
    var login_info = function() {
        return {
            domain       : this.config.domain,
            host         : os.hostname(),
            os           : getOS(),
            agentVersion : this.version.code,
            nodeVersion  : process.version
        };
    }.bind(this);
    var on_result = this.on_result.bind(this);
    this.conn = new Request(MakeUrl(this.config.redirect, this.config, this.version, 0), this.config, {}, on_result(function(json) {
            if (!( json.status === 'success' && json.result && typeof json.result == 'string' && json.result.length )) return false;
            var login_server = this.config.redirect.split('://')[0] + "://" + json.result;

            this.conn = new Request(MakeUrl(login_server, this.config, this.version, 1), this.config, login_info(), on_result(function(json) {
                if ( !( json.status === 'success' && json.result && typeof json.result == 'object') ) return false;
                this.interval = json.result.dataSentInterval;
                this._session_key = json.result.appSessionKey;
                this.upload_server = login_server;
                this._emit('login', null, json);
                this.state = 'ready';
                return true;
            }.bind(this)));
            
            this.state = 'login';
            return true;
    }.bind(this)));
    this.state = 'redirect';
};

Server.prototype.on_result = function(handler) {
    var reLogin = function(interval) {
        this.state = '';
        setTimeout(function() {
            this.login();
        }.bind(this), interval);
    }.bind(this);

    if (handler === 'restart') {
        this.logger.info('agent restart.');
        return this.login();
    }
    return function (error, result) {
        if (!this.conn) return;
        this.conn.destroy(); 
        this.conn = null;
        var json = null

        if (!error) {
            try { 
                json = JSON.parse(result); 
            } catch (err) { 
                error = err;
            }

            if (!error && !handler(json)) error = json;
        }

        if (error) {
            this.logger.error(error)
            reLogin(this.config.login_retry * 1000)
        }
    }.bind(this);
};

var rmDir = function(dirPath) {
    try {
        var files = fs.readdirSync(dirPath);
    } catch(e) {
        return;
    }
    if (files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            var filePath = path.join(dirPath, files[i])
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            } else {
                rmDir(filePath);
            }
        };
    }
    fs.rmdirSync(dirPath);
}

//report不要回调，发送缓存在server内部做.
Server.prototype.report = function(data) {
    var uploadData = this.cache.merge(data);
    if (this.state != 'ready' || !this._session_key || !this.upload_server) return false;
    var url = MakeUrl(this.upload_server, this.config, this.version, 2, this._session_key);
    this.conn = new Request(url, this.config, uploadData, function(error, result) {
        var obj;
        if (!error) {
            try { 
                obj = JSON.parse(result); 
            } catch (err) {
                error = err;
            }
        }
        if (error) {
            if (!this.conn) return;
            this.conn.destroy(); 
            this.conn = null;
            this.logger.info('Connect error, the data cached.');
            return this.cache.enqueue(data);
        }
        if (obj.status === 'success') {
            this.cache.empty();
        } else {
            this.cache.enqueue(data);
            var code;
            if (obj.result && obj.result.errorCode) {
                code = obj.result.errorCode;
                this.cache.empty();
            };
            if (code === 471) {
                rmDir(path.join(__dirname, '../plugins'));
            };
            this._emit('stop');
            this.on_result('restart')
        }
    }.bind(this));
};

Server.prototype.reportError = function(error) {
    if (!error) return;
    var uploadData = {
        domain: this.config.domain,
        message: error.toString()
    };
    if (this.connection) {this.connection.destroy(); this.connection = null};
    if (!(this.config.hasOwnProperty('license') && typeof this.config.license == 'string')) {
        return this.logger('license not found.'); 
    }
    if (!this.config || !this.config.redirect) return;
    var url = MakeUrl(this.config.redirect, this.config, this.version, 3);
    this.connection = new Request(url, this.config, uploadData, function(error, result) {
        if (error) {
            if (!this.connection) return;
            this.connection.destroy(); 
            this.connection = null;
            this.logger.info('Report error faild' + error.toString());
        }
    }.bind(this));
}

module.exports = Server;