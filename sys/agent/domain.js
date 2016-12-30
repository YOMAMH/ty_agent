var fs = require('fs');
var path = require('path');
var p = path.join(__dirname, '../../tingyun.json');
var tyconfig = require(p);

function writeDomainId() {
	if (tyconfig.server.domain) return;
	tyconfig.server.domain = generateDomainId();
	var data = JSON.stringify(tyconfig, null, "\t");
	fs.writeFileSync(p, data);
};

function generateDomainId() {
    return 'D' + Date.now() + parseInt(Math.random() * 10);
};

module.exports = writeDomainId();