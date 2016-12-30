'use strict';

var fs = require('fs');
var json_util = require('./util/json');
var Loader = require('./loader');
var path = require('path');
var Event = require('./util/event.js');
var time = 12;

function Tasks(logger, config) {
    Event(this, {error: false, data: false});
    this.logger = logger;
    this.config = json_util.clone(config);
    this.plugins = [];
    this.loader = new Loader(this.logger.child('Loader'), this.config);
    this.destroy = function() {
        if (this.hTimer) {
            clearInterval(this.hTimer);
            this.hTimer = null;
        }
    };
};

Tasks.prototype.start = function() {
    this.hTimer = setInterval(function () {
        this.run();
    }.bind(this), time * 1000);
    if (this.hTimer.unref) this.hTimer.unref();
    if (!this._lastTime) this._lastTime = parseInt(Date.now() * 0.001);
};

//采集数据,_emit出去
Tasks.prototype.run = function() {
    var task_count = 0;
    var data = {
        type: 'metrics',
        timeFrom: this._lastTime,
        timeTo: parseInt(Date.now() * 0.001),
        interval: this.interval,
        metrics: {},
        status: {}
    };
    this._lastTime = data.timeTo;

    var do_report = function() {
        this._emit('data', data);
    }.bind(this);

    var metrics = data.metrics;
    var status = data.status;

    var allInstances = [];
    for (var i = 0; i < this.plugins.length; i++) {
        var name = this.plugins[i].name;
        var instances = this.plugins[i].instances;
        allInstances.push(singlePlugin(name, instances));
    };

    Promise.all(allInstances).then(function(val) {
        do_report();
    });

    function singlePlugin(name, instances) {
        status[name] = [];
        metrics[name] = [];
        return new Promise(function(resolve) {
            var sub = [];
            Object.keys(instances).forEach(function(key) {
                sub.push(new Promise(function(res, rej) {
                    instances[key].read(function(err, result) {
                        if (err) {
                           status[name].push(formatError(key, err));
                        } else {
                            metrics[name].push(formatMetrics(name, key, result));
                            status[name].push(formatError(key, {code: '0', msg: ''}));
                        }
                        res();
                    })
                }));
            });
            Promise.all(sub).then(function(argument) {
                resolve();
            });
        })
    }
};

function formatError(instance_id, error) {
    return [instance_id, error.code.toString(), error.msg];
};

function formatMetrics(plugin_name, instance_id, metric_data) {
    var instance_metric_data = [];
    instance_metric_data.push(instance_id)
    var instance_metric_data_array = [];
    for(var k in metric_data) {
        var instance_metric_item = [];
        var kstr = plugin_name + '.' + k;
        instance_metric_item.push(kstr, metric_data[k])
        instance_metric_data_array.push(instance_metric_item)
    }
    instance_metric_data.push(instance_metric_data_array)
    return instance_metric_data;
};      

function unique(plugins) {
    var obj = {};
    var arr = [];
    for (var i = 0; i < plugins.length; i++) {
        var plugin = plugins[i];
        if (!(obj.hasOwnProperty(plugin.name))) {
            obj[plugin.name] = 1;
            arr.push(plugin);
        }
    }
    return arr;
};

//本地配置的plugin与server配置的plugin重名的,这个plugin下配置的monitor全部使用server端配置
//合并两个配置项,有相同的，以config2(server)中的值覆盖config1(local)中的值
function merge(local_plugins, server_plugins) {
    if (!local_plugins || (!Array.isArray(local_plugins))) local_plugins = [];
    if (!server_plugins || (!Array.isArray(server_plugins))) server_plugins = [];
    local_plugins = unique(local_plugins);
    server_plugins = unique(server_plugins);
    var arr = [];
    var o = {};
    for (var i = 0; i < server_plugins.length; i++) {
        var plugin = server_plugins[i];
        if (plugin && plugin.name && !(o.hasOwnProperty(plugin.name))) {
            o[plugin.name] = 1;
            arr.push(plugin);
        }
    };

    for (var i = 0; i < local_plugins.length; i++) {
        var local_plugin = local_plugins[i];
        if (local_plugin && local_plugin.name && !o.hasOwnProperty(local_plugin.name)) {
            o[local_plugin.name] = 1;
            arr.push(local_plugin);
        }
    };
    return arr;
};

function remove(c1, c2) {
    var config1 = json_util.clone(c1);
    var config2 = json_util.clone(c2);
    for (var i = 0; i < config1.length; i++) {
        for (var j = 0; j < config2.length; j++) {
            if (config1[i] && config1[i].name && config2[j].name === config1[i].name) {
                config1.splice(i, 1)
            }
        }
    }
    return config1;
};

function destroy_sub(obj, k) {
    if ( obj.hasOwnProperty(k) ) {
        obj[k].destroy(); delete obj[k];
        if ( obj.hasOwnProperty(k) ) obj[k] = null;
    }
};

var plugin_root = path.join(__dirname, '../plugins');

Tasks.prototype._start_monitors = function(start_plugins) {
    var isRuntime = function(plugin_name) {
        var ret = false;
        for (var i = 0; i < this.plugins.length; i++) {
            if (this.plugins[i].name === plugin_name) {
                ret = true;
                break;
            }
        }
        return ret;
    }.bind(this);

    var start_monitors = function(plugin_name, plugin_instances) {
        var cls = null;
        var tp;

        try {
            cls = require(plugin_root + '/' + plugin_name); 
        } catch (e) {
            this.logger.error('start ' + plugin_name + ' faild,' + e.toString());
            return false;
        }
        tp = {name: plugin_name, instances: {}, use: 0, Class: cls};
       
        for (var k = 0; k < plugin_instances.length; k++) {
            plugin_instances[k]['time'] = time;
            var tp_instance = new tp.Class(this.logger.child('Plugin.' + plugin_name + '.' + k),plugin_instances[k]);
            tp.use += 1;
            var instance_id = plugin_instances[k].id;
            tp.instances[instance_id] = tp_instance;
        }
        this.plugins.push(tp);
    }.bind(this);

    function isLocal(plugin_name) {
        try {
            fs.statSync(plugin_root);
        } catch (e) {
            fs.mkdirSync(plugin_root);
        }

        try { 
            require(plugin_root + '/' + plugin_name); 
        } catch (e) { return false; }
        return true;
    };

    var do_report_error = function(error) {
        this._emit('error', error);
    }.bind(this);

    for(var i = 0; i < start_plugins.length; i++) {
        var plugin_name = start_plugins[i].name;
        var plugin_instances = start_plugins[i].instances;

        if(plugin_name && plugin_instances && plugin_instances.length) {
            if (isLocal(plugin_name)) {
                start_monitors(plugin_name, plugin_instances);
            } else {
                (function(plugin_name, plugin_instances, _this) {
                    var plugin_src = start_plugins[i].src;
                    _this.loader.load(plugin_name, start_plugins[i].src, start_plugins[i].md5, function(error) {
                        if (!error) {
                            start_monitors(plugin_name, plugin_instances);
                        } else {
                            var errstr = plugin_name + " plugin load error from " + plugin_src;
                            do_report_error(errstr);
                            _this.logger.error(errstr);
                        }
                    })
                })(plugin_name, plugin_instances, this); 
            }
        } else {
            this.logger.error('Plugin name and instances cannot be empty.')
        }
    }
};

Tasks.prototype._stop_monitors = function(plugins) {
    for (var i = 0; i < plugins.length; i++) {
        for (var j = 0; j < this.plugins.length; j++) {
            if (plugins[i].name === this.plugins[j].name) {
                var instances = this.plugins[j].instances;
                // delete instances
                for ( var k in instances ) {
                    // instances[k].destroy();
                    delete instances[k];
                    this.plugins[j].use--;
                    // delete plugin
                    if (this.plugins[j].use < 1) {
                        delete this.plugins[j];
                        break;
                    };
                }
            }
        };
    }
};

Tasks.prototype._update_monitors = function(plugins) {
    for (var i = 0; i < plugins.length; i++) {
        var plugin_instances = plugins[i].instances;
        for (var j = 0; j < this.plugins.length; j++) {
            if (plugins[i].name === this.plugins[j].name) {
                var instances = this.plugins[j].instances;
                for (var k in instances) {
                    instances[k].update(plugin_instances);
                }
            };            
        }
    }
};

//模块的load
//1,从local_config和server_param中取任务数据
//2,筛选出未解包的plugin
//3,下载&&解包每个plugin,失败的调用回调
//新配置与旧配置的交集不动，旧配置中不在交集中的，停掉,新配置不在交集中的，要创建
//4,筛选出未启动的monitor
//5,筛选出已经启动的，但是未在新配置中出现的monitor,停止
//6,require plugin模块
//7,new monitor对象
Tasks.prototype.update = function (local_config, server_param) {
    if (typeof server_param === 'object' && server_param.dataSentInterval) {
        this.interval = server_param.dataSentInterval;
    }
    if (!server_param) server_param = {};
    // 保持plugins缓存保持为空
    this.plugins.length = 0;
    var plugins = merge(local_config.plugins, server_param.plugins);
    // var stop_plugins   = remove(this.plugins, plugins);
    var start_plugins  = remove(plugins, this.plugins);
    // var update_plugins = remove(plugins, start_plugins);
    //     update_plugins = remove(update_plugins, stop_plugins);
    this._start_monitors(start_plugins);
    // this._stop_monitors(stop_plugins);
    // this._update_monitors(update_plugins);
};
//数据采集
//1,setInterval做数据采集
//2,onTime事件时,调用每个plugin下的每个monitor.read,读取数据,数据全部回调结束后，开始向上返回数据

module.exports = Tasks; 