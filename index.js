const express = require('express');
const app = express();
const request = require('request');
const exec = require('child_process').exec;

const cmdStr = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';

app.get('/', (req, res) => {
    exec(cmdStr, (err, stdout, stderr) => {
        if (err) {
            console.log('cmd执行错误', err);
        }
        if (!stdout) {
            console.log('端口号读取失败', stdout);
        }
        const prot = stdout;
        const options = {
            method: 'GET',
            uri: 'http://127.0.0.1:'+ prot +'/login?format=image',
        };
        request(options)
            .on('error', (err) => {
                console.log('登录二维码获取失败', err)
            })
            .pipe(res);
    })
})

app.listen(8000, () => console.log('app listening on port 8000!'))
