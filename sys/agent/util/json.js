function json_eq(t, s) {
    if ( typeof t != typeof s ) return false;
    if ( s instanceof Array && t instanceof  Array ) {
        if (s.length != t.length ) return false;
        for (var i = 0;i < s.length; i++ ) {
            if ( ! json_eq(t[i], s[i]) ) return false;
        }
        return true;
    }
    if ( s instanceof Array || t instanceof Array ) return false;
    if ( typeof t == 'object' ) {
        for ( k in s ) {
            if (! t.hasOwnProperty(k) ) return false;
            if ( !json_eq(t[k], s[k]) ) return false;
        }
        for ( k in t ) {
            if ( ! s.hasOwnProperty(k) ) return false;
        }
        return true;
    }
    return t == s;
}
function json_clone(obj) {
    switch(typeof obj) {
        case 'string':
        case 'null':
        case 'boolean':
        case 'number':
            return obj;
        case 'object':
            if ( obj instanceof Array ) {
                var res = [];
                for ( var i = 0; i < obj.length; i++ ) res[i] = json_clone(obj[i]);
                return res;
            }
            var result = {};
            for (k in obj ) result[k] = json_clone(obj[k]);
            return result;
        default:
            return null;
    }
}
module.exports = {
    eq : json_eq,
    clone : json_clone
};