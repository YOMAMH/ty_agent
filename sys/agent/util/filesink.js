var Stream = require('stream');
var crypto = require('crypto');
var fs = require('fs');
module.exports = {
    create : function (save_path, callback) {
        var tasks = 0,  finished = false, hash = crypto.createHash('md5');
        function report() { if ( callback ) { callback.apply(this, arguments); callback = null; } }
        function finish() { if  ( hash && tasks == 0 ) { report(null, hash.digest('hex')); hash = null; } }
        var This = Stream.Writable();
        This.on('finish', function(){ finished = true;  finish(); });
        This._write = function(data, _, cb) {
            hash.update(data);
            tasks++;
            fs.appendFile(save_path, data, function(){
                tasks--;
                if ( cb ) cb.apply(this,arguments);
                if ( finished ) finish();
            });
            return true;
        };
        return This;
    }
};