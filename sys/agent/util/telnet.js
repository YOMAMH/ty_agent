'use strict';

var net = require('net');
var tls = require('tls');
var defaultOptions = {
  host: '127.0.0.1',
  family: 'IPv4'
};

function Telnet(options) {
  this.options = options || {};
}

Telnet.prototype.connect = function (callback) {
  this.connecting = true;
  var connectionOptions = {};

  var url = this.options.url;
  if (!url) {
    return callback('URL can not be empty.');
  }

  function parse(_url) {
    var u = _url.indexOf('http');
    if(u > -1 || _url.indexOf('https') > -1) {
        var arry = _url.split('//');
        url = arry[1];
    }
  }

  parse(url);
  var arr = url.split(':');
  var port = arr[1];
  var host = arr[0];
  
  if (!port) {
    return callback('Port can not be empty.');
  }
  if (port < 0 || port > 65536) {
    return callback('port should be >= 0 and < 65536');
  }
  connectionOptions.port = port;
  connectionOptions.host = host || defaultOptions.host;
  if (this.options.tls) {
    connectionOptions.tls = this.options.tls;
  }

  var _this = this;
  process.nextTick(function() {
    if (!_this.connecting) {
      callback(new Error('Connection not exist.'));
      return;
    }
    var stream;
    if (_this.options.tls) {
      stream = tls.connect(connectionOptions);
    } else {
      stream = net.createConnection(connectionOptions);
    }
    _this.stream = stream;
    callback(null, stream);
  })
};

Telnet.prototype.end = function() {
  this.connecting = false;
  if (this.stream) {
    this.stream.end();
  }
};

module.exports = Telnet;