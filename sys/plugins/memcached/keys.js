// memcached stats
var all = [
	'uptime',
	'pointer_size',
	'cmd_get',
	'cmd_set',
	'cmd_flush',
	'cmd_touch',
	'get_hits',
	'get_misses',
	'delete_misses',
	'delete_hits',
	'incr_misses',
	'incr_hits',
	'decr_misses',
	'decr_hits',
	'cas_misses',
	'cas_hits',
	'cas_badval',
	'touch_hits',
	'touch_misses',
	'auth_cmds',
	'auth_errors',
	'bytes_read',
	'bytes_written',
	'limit_maxbytes',
	'accepting_conns',
	'listen_disabled_num',
	'threads',
	'conn_yields',
	'hash_power_level',
	'hash_bytes',
	'hash_is_expanding',
	'expired_unfetched',
	'evicted_unfetched',
	'bytes',
	'total_items',
	'evictions',
	'reclaimed'
];

var byteItems = [
	'bytes_read',
    'bytes_written',
    'limit_maxbytes',
    'time_in_listen_disabled_us',
    'hash_bytes',
	'bytes'
];

module.exports = {
	all: all,
	byteItems: byteItems
}

// origin
// memcached.bytes_read
// memcached.bytes_written
// memcached.limit_maxbytes
// memcached.time_in_listen_disabled_us
// memcached.hash_bytes
// memcached.bytes