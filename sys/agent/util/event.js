'use strict';
var json_util = require('./json');
function makeEvent(obj, events) {
    var evts = (events && typeof events === 'object' ) ? json_util.clone(events) : {error: false, end: true};
    var handlers = {};
    obj.clearEvent = function() { for ( var k in evts ) handlers[k] = [];};
    obj.on = function(type, handler) { if ( handlers.hasOwnProperty(type) ) handlers[type].push(handler); };
    obj._emit = function() {
        if (arguments.length < 1 ) return;
        var args = [], type = arguments[0];
        if (!handlers.hasOwnProperty(type) ) return;
        for ( var i = 1; i < arguments.length; i++ ) args.push(arguments[i]);
        for ( var i = 0; i < handlers[type].length; i++ ) {
            handlers[type][i].apply(this, args);
        }
        if ( evts[type] ) handlers[type] = [];
    };
    obj.clearEvent();
}

module.exports = makeEvent;