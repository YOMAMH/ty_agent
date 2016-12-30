// redis info
var all = [
	'aof_last_rewrite_time_sec',
	'aof_current_size',
	'aof_buffer_length',
	'connected_clients',
	'client_biggest_input_buf',
	'blocked_clients',
	'total_connections_received',
	'total_commands_processed',
	'instantaneous_input_kbps',
	'instantaneous_output_kbps',
	'rejected_connections',
	'connected_slaves',
	'repl_backlog_histlen',
	'master_link_down_since_seconds',
	'master_last_io_seconds_ago',
	'master_repl_offset',
	'slave_repl_offset',
	'used_cpu_sys',
	'used_cpu_user',
	'used_cpu_sys_children',
	'used_cpu_user_children',
	'expired_keys',
	'pubsub_patterns',
	'pubsub_channels',
	'latest_fork_usec',
	'used_memory',
	'used_memory_rss',
	'used_memory_peak',
	'used_memory_lua',
	'rdb_changes_since_last_save',
	'rdb_last_bgsave_time_sec',
];

// // sec to mili  
// redis.aof_last_rewrite_time_sec
// redis.used_cpu_user_children
// redis.used_cpu_sys
// redis.rdb_last_bgsave_time_sec

// // /(1024 * 1024)
// redis.client_biggest_input_buf
// redis.used_memory_lua
// redis.used_memory_peak
// redis.used_memory_rss
// redis.used_memory
// redis.repl_backlog_histlen


// 秒转换成毫秒
var timeItems = [
    //'aof_last_rewrite_time_sec',
    'used_cpu_user_children',
    'used_cpu_sys',
    'rdb_last_bgsave_time_sec'
];

// /(1024 * 1024) 字节转换成MB
var byteItems = [
    'client_biggest_input_buf',
    'used_memory_peak',
    'used_memory_rss',
    'used_memory',
    'repl_backlog_histlen'
];

// /1024 字节转KB
var otherItems = [
	'used_memory_lua'
]

//需要计算的指标
var calculateMap = {
	total_commands_processed:'command_qps',
    keyspace_hits:'keys_hits',
    keyspace_misses:'keys_misses'
};

module.exports = {
	all			: all,
	byteItems	: byteItems,
	timeItems	: timeItems,
	otherItems	: otherItems,
    calculateMap: calculateMap
};