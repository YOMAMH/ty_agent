var child_process = require('child_process');

try {
    child_process.execSync('killall sys-node');
} catch(e) {
    console.log(e);
};