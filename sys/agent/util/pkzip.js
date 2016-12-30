'use strict';
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');
var Event = require('./event');
var Stream = require('stream');

function InputStream(file_path) {
    var _fd = null, inited = false;
    this.destroy = function(){ if ( _fd ) {fs.close(_fd); _fd = null;} };
    this.read = function(buffer, len, cb) {
        function do_read(){
            try {  fs.read(_fd, buffer, 0, len, null, function(error, size){
                cb(error, size);
            }); }catch ( e ) { console.log(e.toString()); cb(e); }
        }
        if ( ! inited ) {  inited = true;
            fs.open(file_path, 'r', function(error, fd){
                if ( error ) return cb(error);
                _fd = fd;  do_read();
            });
        }
        else if ( _fd != null ) return do_read();
        else process.nextTick(function(){ cb(new Error('open wrong.')); });
    };
}
function ModifyTime(mod_time, mod_date) {
    var date = new Date();
    date.setSeconds((mod_time & 0x1f) * 2);
    date.setMinutes((mod_time >> 5) & 0x3f);
    date.setHours((mod_time >> 11) & 0x1f);
    date.setDate(mod_date & 0x1f);
    date.setMonth(((mod_date >> 5) & 0x0f) - 1);
    date.setYear(((mod_date >> 9) & 0x7f) + 1980);
    return date.getTime() / 1000;
}
function ChangeTime(file_path, ctime) {
    fs.utimes(file_path, ctime, ctime,function(error){
        if (error) return console.log(error.toString());
    });
}
function OutHandler(rootDir) {
    //deep create dir
    function create_dir(mpath, cb) {
        while ( mpath.length > 1 && (mpath.charAt(mpath.length) == '/' || mpath.charAt(mpath.length) == '\\' )) mpath = mpath.slice(0, mpath.length - 1);
        fs.exists(mpath, function(exist){
            function report(error) { var cbx = cb; cb = null; if ( cbx ) cbx(error); }
            if ( exist ) return report(null);
            create_dir(path.join(mpath + '/', '../'), function(error){ return error? report(error): fs.mkdir(mpath, report); });
        });
    }
    //end,解压缩结束通知
    this.destroy = this.end = function(){};
    //参数:{path:'相对路径', modifyTime:'最后修改时间', modifyDate:'最后修改日期'}
    this.createDir = function(param, oncreate){
        var dir_path = path.join(rootDir, './' + param.path);
        create_dir(dir_path,function(error){
            if ( oncreate ) oncreate.apply(this,arguments);
            if ( ! error ) ChangeTime(dir_path, ModifyTime(param.modifyTime, param.modifyDate));
        });
    };
    //参数:{path:'相对路径', modifyTime:'最后修改时间', modifyDate:'最后修改日期',file_size:'未压缩大小', compress_size:'压缩大小",compress_type:'压缩类型'}
    this.createFile = function(param) { return new FileHandler(path.join(rootDir , './' + param.path), ModifyTime(param.modifyTime, param.modifyDate)); }
}
function FileHandler(file_path, ctime) {
    this.write = function(data, cb) { fs.appendFile(file_path, data, cb); };
    this.end = function(){ if ( this.write ) { ChangeTime(file_path, ctime); this.write = null; } };
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//crc32 校验
var t__ = [0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f, 0xe963a535, 0x9e6495a3, 0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9, 0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59, 0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924, 0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190, 0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433, 0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01, 0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950, 0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65, 0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa, 0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f, 0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683, 0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1, 0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb, 0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e, 0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b, 0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236, 0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d, 0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f, 0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242, 0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777, 0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45, 0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc, 0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9, 0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693, 0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94, 0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d];
if (typeof Uint32Array !== 'undefined') t__ = new Uint32Array(t__);
function Crc32() {
    var crc = 0xFFFFFFFF;
    this.update = function(chunk) {
        var i = 0;
        while ( i < chunk.length ) crc = t__[(crc ^ chunk[i++]) & 0xff] ^ (crc >>> 8);//from zlib: crc = crc_table[0][((int)crc ^ (*buf++)) & 0xff] ^ (crc >> 8)
    };
    this.value = function() { var r = crc ^ 0xFFFFFFFF; return (r < 0)?r + 0x100000000: r; };
}
function MinNumber(a, b) { return (a < b)?a:b; }

function createWriteStream(outSink, callback) {
    var tasks = 0,  finished = false;
    function report() { if ( callback ) { callback.apply(this, arguments); callback = null; } }
    var crc = new Crc32();
    function finish() { if  ( tasks == 0 ) { outSink.end(); report(null, crc.value()); } }
    var This = Stream.Writable();
    This.on('finish', function(){ finished = true;  finish(); });
    This._write = function(data, _, cb) {
        crc.update(data);
        tasks++;
        outSink.write(data, function(){
            tasks--;
            if ( cb ) cb.apply(this,arguments);
            if ( finished ) finish();
        });
        return true;
    };
    return This;
}

//参数: {compress:true|false}
function ZipDecoder(params, outSink) {
    Event(this);
    var on_error = function(error) { this._emit('error', error); }.bind(this);
    var inflate = null;
    var writableSink = createWriteStream(outSink, function(error, crc32){
        if ( crc32 != params.crc32 ) console.log('crc32 error. 0x' + params.crc32.toString(16) + ' != 0x' + crc32.toString(16));
        console.log('crc: ' + params.crc32.toString(16));
        this._emit('end');
    }.bind(this));//Sink.create(params.path);
    writableSink.on('error', on_error);

    var write_cb = null;
    function answer_write(){
        var cb = write_cb; write_cb = null;
        if ( cb ) cb.apply(this, arguments);
    }
    var cache = {
        block : new Buffer(1024 * 20),
        begin : 0,
        len : 0,  //维持cache缓冲区有效数据的长度
        push : function (data) {
            if ( this.block.byteLength < data.byteLength ) {
                this.clear();
                this.block = new Buffer(data.byteLength);
            }
            data.copy(this.block, 0, 0, data.byteLength);
            this.len = data.byteLength;
        },
        pop : function(size) {
            size = MinNumber(this.len, size);
            this.len -= size; //维持cache缓冲区有效数据的长度
            var start = this.begin;
            this.begin = (this.len > 0)? (this.begin + size): 0;//维持cache_block中有效数据开始位置
            var result = new Buffer(size);
            this.block.copy(result, 0, start, start + size);
            return result;
        },
        clear : function () {
            if ( this.block ) delete this.block;
            this.begin = this.len = 0;
        }
    };
    var read_request = 0;//readable发出的读请求
    var readableStream = Stream.Readable();
    var readed = false;//_read调用过了，尚未push
    var data_ended  = false;//数据写完了,
    function end_data() {
        if ( ! data_ended || cache.len > 0 ) return;
        readableStream.push(null);
    }
    function push_data() {//向readableStream写数据
        if ( ! readed ) return;//push之后,read之前，不向readableStream写数据
        var size = MinNumber(cache.len, read_request);
        if ( size > 0 ) {
            readed = false; //读状态翻转,push数据
            read_request -= size;//维持读请求数据的长度
            readableStream.push(cache.pop(size));//一切就绪, do it.
            if ( cache.len == 0 ) answer_write();//缓冲区为空,调用write方法的callback函数，通知外部可以再次写入数据了.
        }
    }
    readableStream._read = function(size) {
        read_request = size? size: 1024 * 16;
        readed = true;  //可以push数据了
        push_data();
    };
    if ( params.compress_type != 0 ) {
        inflate = zlib.createInflateRaw();
        inflate.pipe(writableSink);
        inflate.on('error', on_error);
    }
    readableStream.pipe(inflate?inflate:writableSink);
    this.write = function(data, cb) {
        write_cb = cb;
        if ( cache.len > 0 ) throw new Error('some thing is wrong, cache not empty.');
        cache.push(data);
        push_data();
    };
    this.end = function() {
        data_ended = true;
        end_data();
    };
    this.close = function() {
        this.clearEvent();
        //设置文件创建和最后修改时间
        if ( readableStream ) { readableStream.unpipe(); readableStream = null; }
        if ( inflate ) {  inflate.unpipe(); inflate = null; }
        if ( writableSink ) { writableSink = null; }
    };
}
//input: zip input object or filename
//input object : {
//    destroy: function(){...},
//    read(buffer, len, cb){...}
// }
//output: output object or filename
//out object : {
//    destroy : function(){...},
//    createDir : function(path, cb){...},
//    //createFile return: { write : function(data, cb){...}, end(){...} }
//    createFile : function(options){...}
// }
function Decoder(input, output, cb) {
    if ( typeof input === 'string' ) input = new InputStream(input);
    if ( typeof output === 'string' ) output = new OutHandler(output);
    function report(error) {
        var handler = cb; cb = null;
        if ( handler ) handler(error);
    }
    var t = {
        block : new Buffer(20 * 1024),
        parse_end : false,
        readOffset : 0,
        reset : function() {this.readOffset = 0;},
        read_dword : function () {
            this.readOffset += 4;
            return this.block.readUInt32LE(this.readOffset - 4);
        },
        read_word : function () {
            this.readOffset += 2;
            return this.block.readUInt16LE(this.readOffset - 2);
        }
    };
    Event(this);
    this.destroy = function(){
        this.clearEvent();
        if ( input ) { input.destroy(); input = null; };
        if ( output ) { output.destroy(); output = null; };
        if ( t.block ) delete t.block;
    };
    parse_record();
    function parse_record() {
        input.read(t.block, 4, function(error, len){
            if ( error ) { report(t.parse_end?null:error); }
            var signature = t.block.readInt32LE(0);
            switch ( signature ) {
                case 0x04034b50 : return parse_file_header();
                case 0x02014b50 : return parse_dir_file_header();
                case 0x06054b50 : return parse_dir_file_end();
                case 0x08074b50 : return parse_data();
                default : return report(new Error('file format error. unknown signature ' + signature.toString(16)));
            }
        });
    }
    function writeFileData (file, size, cb) {
        function report(error){ var h = cb; cb = null; if ( h ) h(error); }
        file.on('error', report);
        file.on('end', report);
        function write(req) {
            if ( req == 0 ) return file.end();
            var wsize = MinNumber(req, 1024 * 20);
            input.read(t.block, wsize, function(error, len){
                if ( error ) return report(error);
                file.write(t.block.slice(0, len), function(error){
                    if ( error ) return report(error);
                    write(req - len);
                });
            });
        }
        write(size);
    }
    function parse_file_header() {
        input.read(t.block, 26, function(error, len){
            if ( error ) return report(t.parse_end?null:error);
            var record = {};
            record.versionNeedToExtract = t.read_word();
            record.flag = t.read_word();
            record.compressionMethod = t.read_word();
            record.modifyTime = t.read_word();
            record.modifyDate = t.read_word();
            record.crc32 = t.read_dword();
            record.compressSize = t.read_dword();
            record.rawSize = t.read_dword();
            record.nameLen = t.read_word();
            record.extLen = t.read_word();
            t.reset();
            input.read(t.block, record.nameLen, function(error, len){
                if ( error ) return report(t.parse_end?null:error);
                record.pathname = t.block.toString('utf8', 0, record.nameLen);
                record.type = (record.compressSize == 0 && record.pathname.lastIndexOf('/') == record.pathname.length - 1)?'dir':'file';
                console.log(record.pathname + ' :' + record.type);
                function do_next() {
                    if ( record.type == 'dir' ) {
                        return output.createDir({path : record.pathname, modifyTime : record.modifyTime, modifyDate: record.modifyDate }, function(error){
                            if ( error ) return report(t.parse_end?null:error);
                            parse_record();
                        });
                    }
                    if ( record.compressionMethod != 0 && record.compressSize > 0 ) {
                        var file_params = {path : record.pathname, modifyTime : record.modifyTime, crc32: record.crc32, modifyDate : record.modifyDate, file_size: record.rawSize, compress_size: record.compressSize, compress_type : record.compressionMethod};
                        var out_sink = output.createFile(file_params);
                        if ( ! out_sink ) return report(t.parse_end?null:new Error('createFile error.'));
                        var file = new ZipDecoder(file_params, out_sink);
                        writeFileData(file, record.compressSize, function(error){
                            file.close();
                            if ( error ) return report(t.parse_end?null:error);
                            if ( record.flag & 0x08 ) return input.read(t.block, 12, function(error, len){
                                parse_record();
                            });
                            parse_record();
                        });
                    }
                    else {
                        parse_record();
                    }
                }
                if ( record.extLen ) input.read(t.block, record.extLen, function (error, len) {
                    if ( error ) return report(t.parse_end?null:error);
                    do_next();
                });
                else do_next();
            });
        });
    }
    function parse_dir_file_header() {

        input.read(t.block, 42, function(error, len) {
            if (error) return report(t.parse_end ? null : error);
            var record = {};
            record.versionMadeBy = t.read_word();
            record.versionNeedToExtract = t.read_word();
            record.flag = t.read_word();
            record.compressionMethod = t.read_word();
            record.modifyTime = t.read_word();
            record.modifyDate = t.read_word();
            record.crc32 = t.read_dword();
            record.compressSize = t.read_dword();
            record.rawSize = t.read_dword();
            record.nameLen = t.read_word();
            record.extLen = t.read_word();
            record.commentLen = t.read_word();
            record.startDiskNum = t.read_word();
            record.internalAttribute = t.read_word();
            record.externalAttribute = t.read_dword();
            record.offsetOfHeader = t.read_dword();
            t.reset();
            input.read(t.block, record.nameLen, function(error, len){
                if ( error ) return report(t.parse_end?null:error);
                record.pathname = t.block.toString('utf8', 0, record.nameLen);
                record.type = (record.compressSize == 0 && record.pathname.lastIndexOf('/') == record.pathname.length - 1)?'dir':'file';
                if ( record.extLen ) input.read(t.block, record.extLen, function (error, len) {
                    if ( error ) return report(t.parse_end?null:error);
                    do_ext();
                });
                else do_ext();
                function do_ext() {
                    if ( record.commentLen ) input.read(t.block, record.commentLen, function(error, len){
                        if ( error ) return report(t.parse_end?null:error);
                        do_comment();
                    });
                    else do_comment();
                }
                function do_comment() {
                    record.file_comment = t.block.toString('utf8', 0, record.commentLen);
                    parse_record();
                }
            });

        });
    }
    function parse_data() {
        input.read(t.block, 12, function(error, len) {
            if (error) return report(t.parse_end ? null : error);
            var record = {};
            record.crc32 = t.read_dword();
            record.compressSize = t.read_dword();
            record.rawSize = t.read_dword();
            t.reset();
            parse_record();
        });
        console.log('parse_data');
    }
    function parse_dir_file_end() {
        input.read(t.block, 18, function(error, len) {
            if (error) return report(t.parse_end ? null : error);
            var record = {};
            record.diskNum = t.read_word();
            record.dirStartNum = t.read_word();
            record.dirCountOnDisk = t.read_word();
            record.dirCount = t.read_word();
            record.sizeOfDir = t.read_dword();
            record.offsetOfDir = t.read_dword();
            record.commentLen = t.read_word();
            t.reset();
            if ( record.commentLen ) input.read(t.block, record.commentLen, function(error, len){
                if ( error ) return report(t.parse_end?null:error);
                do_comment();
            });
            else do_comment();
            function do_comment() {
                record.file_comment = t.block.toString('utf8', 0, record.commentLen);
                t.parse_end = true;
                output.end();
                report(null);
            }
        });
    }
}
function zip_decode(zipfile_path, target_path, cb) { return new Decoder(zipfile_path, target_path, cb); }
function zip_encode(target_path, zipfile_path, cb) {

}
//decode(zip文件路径, 解压缩路径, 完成回调) => 解压缩对象
//encode(压缩路径/文件名, zip文件名, 完成回调) => 压缩对象
module.exports = {
    decode : zip_decode,
    encode : zip_encode
};