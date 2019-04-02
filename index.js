const express = require('express');
const app = express();
const request = require('request');
const exec = require('child_process').exec;

const cmdStr = 'cat "~/.config/wechat_web_devtools/Default/.ide"';

app.get('/', (req, res) => {
    exec(cmdStr, (err, stdout, stderr) => {
        const prot = stdout;
        const options = {
            method: 'GET',
            uri: 'http://127.0.0.1:'+ prot +'/login?format=image',
        };
        request(options)
            .on('error', (err) => {
                console.log(err)
            })
            .pipe(res);
    })
})

app.listen(8848, () => console.log('app listening on port 8848!'))
