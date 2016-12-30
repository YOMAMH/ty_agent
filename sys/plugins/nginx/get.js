var util    = require('util');
var Url     = require('url');
var http    = require('http');
var https   = require('https');
var Stream  = require('stream');
var HttpGet = require('./get');

// 创建数据流
function createSink(callback) {
    function report() {
        if(callback) { 
            callback.apply(this, arguments); 
            callback = null; 
        } 
    };

    var sw = Stream.Writable();
    var res = '';
    sw.on('finish', function() {
        report(null, res);
    });

    sw._write = function(data, _, cb) {
        res += data.toString();
        if (cb) cb(null);
        return true;
    };
    return sw;
};

// 请求性能信息
function downloader(config, cb) {
    var _url = config.url;
    if (_url.indexOf('http') < 0) {
        _url = 'http://' + _url;
    }
    
    var hostinfo = Url.parse(_url);
    var options = {
        method : 'GET',
        setHost: false,
        host   : hostinfo.hostname || hostinfo.host,
        port   : hostinfo.port || ((hostinfo.protocol == 'https:') ? 443 : 80),
        path   : hostinfo.path,
        headers: {
            'Host': hostinfo.host,
            'User-Agent': util.format("TingYun-SystemAgent/%s (Node.js %s %s-%s)", '2.0.0', process.versions.node, process.platform, process.arch),
            'Connection': 'Keep-Alive'
        }
    };

    if(config.params && config.params.username && config.params.password){
        var user = config.params.username;
        var passwd = config.params.password;
        var auth = new Buffer(user + ':' + passwd).toString("base64");
        options.headers['Authorization'] = 'Basic '+auth;
    }

    if (hostinfo.protocol == 'https:') this.request = https.request(options);
    else this.request = http.request(options);

    var answer = function() {
        var callback = cb; cb = null;
        if (callback) callback.apply(this, arguments);
    };

    this.request.on('error', answer);
    this.request.on('response', function(response) {
        if (response.statusCode !== 200) return answer('Response ' + response.statusCode);
        var sink = createSink(answer);
        response.pipe(sink);
        response.on('end', function () {
            response.destroy();
            sink.end();
        })
    });
    this.request.end();
    this.destroy = function() {
        cb = null;
        if (!this.request) return;
        this.request.destroy();
        delete this.request;
    };
}

module.exports = downloader;