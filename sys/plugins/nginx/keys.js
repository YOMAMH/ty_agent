/**
 * Created by renminghe on 17/1/1.
 */
//自定义指标
var values = ['connect', 'success', 'request',];

//需要计算的
var calculate = [
    'handled_requests',
    'handled_connects',
    'handled_success',
];

//需要乘以10的
var handleTen = [
    'handled_requests',
    'handled_connects',
    'handled_success',
];

//需要乘以100的
var handleHun = [
    'conns_opened_percent',
    'connections_dropped_sec',
];

var umap = {
    B: 1,
    ms: 1000,
    hun:100,
    ten:10,
    kB: 1024,
    KB: 1024,
    mB: 1024 * 1024,
    MB: 1024 * 1024,
    gB: 1024 * 1024 * 1024,
    GB: 1024 * 1024 * 1024,
};

module.exports = {
    values: values,
    calculate: calculate,
    handleTen:handleTen,
    handleHun:handleHun,
    umap:umap
};