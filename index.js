const express = require('express');
const fs = require('fs');
const app = express();
const request = require('request');
const exec = require('child_process').exec;


const IS_BUSY = 1; // 有项目正在使用该容器
const IS_FREE = 0; // 该项目无人使用中
const TIME_OUT = 360; // 超时时间，登录未使用，默认为5分钟后释放
let timer = null;
let user = null;
let status = IS_FREE;
const execPr = (cmdStr) => new Promise((resolve, reject) => {
    exec(cmdStr, (err, stdout) => {
        if (err) {
            console.log(`【exec 执行错误】`, err)
            reject(err);
        } else {
            resolve(stdout);
        }
    })
});

const getLoginImage = async (res) => {
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const port = await execPr(cmd);
    console.log('port', port)
    const options = {
        method: 'GET',
        uri: 'http://127.0.0.1:'+ port +'/login?format=image',
    };
    request(options)
    .on('error', (err) => {
        console.log('【登录二维码获取失败】', err)
    })
    .pipe(res);
}

const getBusyImage = (res) => {
    fs.createReadStream('./image/busy.jpg').pipe(res);
}

const timeout = (s) => {
    timer = setTimeout(() => {
        status = IS_FREE;
    }, 1000 * s);
}

app.get('/login', async (req, res) => {
    console.log('cookie', req.headers.cookie)
    console.log(status)
    switch (status) {
        case IS_BUSY:
            getBusyImage(res);
            break;
        case IS_FREE:
            status = IS_BUSY;
            timeout(TIME_OUT);
            console.log('IS_FREE')
            getLoginImage(res);
        break;
        default:break;
    }
})

app.get('/free', async (req, res) => {
    clearTimeout(timer);
    status = IS_FREE;
    res.sendStatus(200);
})

app.listen(8000, () => console.log('app listening on port 8000!'))
