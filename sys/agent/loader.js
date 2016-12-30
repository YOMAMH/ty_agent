'use strict';
var json_util = require('./util/json');
var Downloader = require('./util/http_get');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var zip = require('./util/pkzip');

//初始化:
//  参数:
//     1. logger,
//     2. root path
function Loader(logger, config) {
    this.logger = logger;
    this.config = config;
    this.logger.info("loader start.");
}

var plugin_root = path.join(__dirname, '../plugins');
//初始化一个plugin
//删除root/plugin_name下的压缩包
//下载/copy plugin 压缩包，解压缩到root/plugin_name下
//1.get压缩包文件到template下,失败则每分钟重试
//2.校验压缩包
//3.解压缩文件到plugin文件夹下
//4.check文件
Loader.prototype.load = function(plugin_name, archive_path, md5sum, cb) {
    var ext = archive_path.substr(archive_path.lastIndexOf('.'));
    var save_path = plugin_root + '/' + plugin_name + ext;
    var on_file = function (error, md5) {
        if ( error ) return cb(error);
        if ( md5sum !== md5 ) return cb(new Error("check sum error"));
        //解压缩文件
        //删除文件
        //cb(null);
        var decoder = zip.decode(save_path, plugin_root, function(error){
            fs.unlink(save_path,function(){
                console.log(save_path + ' deleted');
            });
            decoder.destroy();
            cb(error);
        });
    }.bind(this);

    fs.exists(save_path, function(exist) {
        if ( exist ) {
            fs.readFile(save_path, function(err, data){
                if ( err ) return on_file(err);
                var hash = crypto.createHash('md5');
                hash.update(data);
                if ( md5sum === hash.digest('hex')) return on_file(null, md5sum);
                fs.unlink(save_path, do_load);
            });
        } else { do_load(); }
    });

    var do_load = function() {
        if ( archive_path.indexOf('http://') == 0 || archive_path.indexOf('https://') == 0 ) {
            this._http_load(archive_path, save_path, on_file);
        }
        else if ( archive_path.indexOf('file:///') == 0 ) {
            this._copy_file(archive_path.substr(7), save_path, on_file);
        }
        else if ( archive_path.indexOf('/') == 0 ) {
            this._copy_file(archive_path, save_path, on_file);
        }
        else {
            cb("plugin path error.");
        }
    }.bind(this);
};

Loader.prototype._http_load = function(url, save_path, cb) {
    var task = {};
    task.downloader = new Downloader(url, save_path, {}, function(error, md5) {
        task.downloader.destroy();
        delete task.downloader;
        cb(error, md5);
    });
};

Loader.prototype._copy_file = function (path, save_path, cb) {
    fs.readFile(path, function(err, data){
        if ( err ) return cb(err);
        var hash = crypto.createHash('md5');
        hash.update(data);
        var md5 = hash.digest('hex');
        fs.writeFile(save_path, data, {encoding:'binary'}, function(error){
            if ( error ) return cb(error);
            cb(null, md5);
        });
    });
};

module.exports = Loader;