var util    = require('util');
var Url     = require('url');
var http    = require('http');
var https   = require('https');
var deflate = require('zlib').deflate;
var EventEmitter = require('events').EventEmitter;

var logger = null;
var json_util = require('./json');

function Sink(callback) {
    EventEmitter.call(this);
    this.callback = callback;
    this.sink = '';
    this.writable = true;
    var sink = this;
    this.on('error', function (error) { sink.writable = false; callback(error); });
}

util.inherits(Sink, EventEmitter);
Sink.prototype.write = function write(string) {
    if (!this.writable) {
        this.emit('error', new Error("Sink no longer writable!"));
        return false;
    }
    this.sink += string.toString();
    return true;
};

Sink.prototype.end = function end() {
    this.writable = false;
    this.callback(null, this.sink);
};

Sink.prototype.destroy = function destroy() {
    this.emit('close');
    this.writable = false;
    delete this.sink;
};

function proxy_parse(proxy) {
    if ( ! proxy ) return null;
    if ( typeof proxy != 'object' ) return null;
    if ( ! proxy.hasOwnProperty('server') || typeof proxy.server != 'string' ) return null;
    proxyinfo = Url.parse(proxy.server);
    if ( ! proxyinfo.host ) return null;
    return json_util.clone(proxy);
}

function get_option(config, key, default_val) { 
    return config.hasOwnProperty(key)?config[key]:default_val; 
}

function encode_data(data, compressed, cb) {
    if ( ! compressed ) return cb(data, false);
    deflate(data, function cb_deflate(err, deflated) {
        if (err) {
            logger.warning(err, "zlib compressing failed, uncompressed data send.");
            cb(data, false);
        }
        else cb(deflated, true);
    });
}
//proxy: 代理服务器参数
//data: post数据
function Request(url, config, data, cb) {
    var proxy = get_option(config, 'proxy', null);
    this.callback = cb;
    this.url = url;
    this.data = data;
    var proxyinfo = proxy_parse(proxy);
    var hostinfo = Url.parse(url);
    encode_data(JSON.stringify(data), get_option(config, 'compressed', true), function(data, compressed) {

        var http_params = {
            'Host' : hostinfo.host,
            'User-Agent' : util.format("TingYun-SystemAgent/%s (Node.js %s %s-%s)", config.version.code, process.versions.node, process.platform, process.arch),
            'Connection' : 'Keep-Alive',
            'Content-Length' : ( ( data instanceof Buffer ) ? data.length: Buffer.byteLength(data, 'utf8') ),
            'Content-Encoding' : compressed ? "deflate": 'identity',
            'Content-Type' : 'Application/json;charset=UTF-8'
        };
        var requestOptions = {
            method           : 'POST',
            setHost          : false,
            host             : hostinfo.hostname || hostinfo.host,
            port             : hostinfo.port || ((hostinfo.protocol == 'https:') ? 443 : 80),
            path             : hostinfo.path,
            headers          : http_params
        };
        if ( hostinfo.protocol == 'https:' ) this.request = https.request(requestOptions);
        else {
            if ( proxyinfo && proxyinfo.server ) {
                requestOptions.path = url;
                requestOptions.hostname = proxyinfo.hostname;
                requestOptions.port = proxyinfo.port;
                if ( proxyinfo.auth ) requestOptions.headers['Proxy-Authorization'] = 'Basic ' + new Buffer(proxyinfo.auth).toString('base64');
                this.request = http.request(requestOptions);
            }
            else {
                this.request = http.request(requestOptions);
            }
        }

        logger.info('Post %s\n', requestOptions.path);
        // if (hostinfo.pathname === '/uploadMetrics') {
            logger.info(this.data);
        // };

        this.answer = function(err, res) {
            cb = this.callback;
            this.callback = null;
            if (cb) cb(err, res);
        }.bind(this);

        this.request.on('error', function(error) { 
            this.answer(error); 
        }.bind(this));

        // this.request.on('socket', function(socket) {
        //     console.log(123456)
        //     socket.setTimeout(2000);
        //     socket.on('timeout', function() {
        //         console.log('time out wooooooooooooo')
        //         this.request.abort();
        //     }.bind(this));
        // }.bind(this));

        this.request.on('response', function (response) {
            response.on('end', function () { response.destroy()});

            response.setEncoding('utf8');
            response.pipe(new Sink(function(error, result){
                var code = response.statusCode;
                var json;
                if (error) {
                    error.statusCode = code;
                    return this.answer(error, result);
                }
                var http_code = (code - code % 100) / 100;
                if (result && http_code === 2) {
                    var loged;
                    logger.info('Response from %s\n\t%s', hostinfo.pathname, result);
                    if ( config.audit_mode === true && logger.enabled('info') ) {
                        loged = logger.append(result);
                    }
                    if ( (! loged) && logger.enabled('debug') ) {
                        loged = logger.append(result);
                    }
                    try {
                        json = JSON.parse(result);
                    } catch (err) { error = err; }
                    if ( json.status !== 'success' && !loged ) {
                        loged = logger.append(result);
                    }
                }
                else {
                    logger.error('%s returned http %s .', requestOptions.method, code, (http_code === 2)?result:'');
                    error = new Error(util.format('http %s Error on %s.', code, requestOptions.method));
                }
                if (error) error.statusCode = code;
                this.answer(error, result);
            }.bind(this)));
        }.bind(this));

        this.request.end(data);
    }.bind(this));
}

Request.prototype.request = function(data) {

};
Request.prototype.set_logger = function (log) { logger = log; };
Request.prototype.destroy = function (){

};
module.exports = Request;