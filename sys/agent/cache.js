var CACHE_SIZE_MAX = 2 * 1024 * 1024; // 2MB

function CacheQueue() {
	this.dataStore = [];
}

CacheQueue.prototype.front = function() {
	return this.dataStore[0];
}

CacheQueue.prototype.back = function() {
	return this.dataStore[this.dataStore.length - 1];
}

CacheQueue.prototype.checkSize = function() {
	var str = JSON.stringify(this.dataStore);
	if (str.length > CACHE_SIZE_MAX) {
		this.dequeue();
		return this.checkSize();
	}
}

CacheQueue.prototype.enqueue = function(element) {
	this.dataStore.push(element);
	this.checkSize();
}

CacheQueue.prototype.dequeue = function() {
	this.dataStore.shift();
}

CacheQueue.prototype.merge = function(data) {
	if (!this.dataStore.length) return [data];
	return this.dataStore.concat([data]);
}

CacheQueue.prototype.empty = function() {
	this.dataStore.length = 0;
}

module.exports = CacheQueue;

