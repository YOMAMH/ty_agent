#!/bin/bash
str=`uname -i`
bit='x64'
if [ "$str" != 'x86_64' ]; then
	bit='x86'
fi
cd `dirname $0`
./node/linux/$bit/node/bin/sys-node ./sys/daemon/stop.js