var util    = require('util')
    , Url     = require('url')
    , http    = require('http')
    , https   = require('https')
    ;
var json_util = require('./json');
var Sink = require('./filesink');

function proxy_parse(proxy) {
    if ( ! proxy ) return null;
    if ( typeof proxy != 'object' ) return null;
    if ( ! proxy.hasOwnProperty('server') || typeof proxy.server != 'string' ) return null;
    proxyinfo = Url.parse(proxy.server);
    if ( ! proxyinfo.host ) return null;
    return json_util.clone(proxy);
}
function get_option(config, key, default_val) { return config.hasOwnProperty(key)?config[key]:default_val; }

function Downloader(url, save_path, config, cb) {

    var proxy = get_option(config, 'proxy', null);
    this.callback = cb;
    this.url = url;
    var proxyinfo = proxy_parse(proxy);
    var hostinfo = Url.parse(url);
    var requestOptions = {
        method           : 'GET',
        setHost          : false,
        host             : hostinfo.hostname || hostinfo.host,
        port             : hostinfo.port || ((hostinfo.protocol == 'https:')?443:80),
        path             : hostinfo.path,
        headers          : {
            'Host' : hostinfo.host,
            'User-Agent' : util.format("TingYun-SystemAgent/%s (Node.js %s %s-%s)", '2.0.0', process.versions.node, process.platform, process.arch),
            'Connection' : 'Keep-Alive'
        }
    };
    // console.log(requestOptions)
    // {   method: 'GET',
    //     setHost: false,
    //     host: '192.168.122.201',
    //     port: 80,
    //     path: '/x.zip',
    //     headers: 
    //             { Host: '192.168.122.201',
    //                 'User-Agent': 'TingYun-SystemAgent/2.0.0 (Node.js 5.3.0 linux-x64)',
    //                 Connection: 'Keep-Alive' } }

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
    var answer = function(err, res) {
        cb = this.callback; this.callback = null;
        if ( cb ) cb(err, res);
    }.bind(this);
    this.request.on('error', answer);

    this.request.on('response', function (response) {
        console.log(save_path)
        if ( response.statusCode != 200 ) return answer(new Error('Response ' + response.statusCode));
        // for ( var k in response.headers ) {
        //     console.log(k + ': ' + response.headers[k]);
        // }
        var sink = Sink.create(save_path, answer);
        response.pipe(sink);
        response.on('end', function () {
            response.destroy();
            sink.end();
        });
    });
    this.request.end();
}
Downloader.prototype.destroy = function (){
    if ( ! this.request ) return;
    this.request.destroy();
    delete this.request;
};
module.exports = Downloader;