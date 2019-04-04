const express = require('express');
const fs = require('fs');
const app = express();
const request = require('request');
const exec = require('child_process').exec;


const IS_BUY = 1; // 有项目正在使用该容器
const IS_FREE = 0; // 该项目无人使用中
let timer = null;
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

const setStatus = async (status) => {
    const cmd = 'echo "' + status + '" >> .status';
    try {
        await execPr(cmd);
    } catch (error) {

    }
}

const getStatus = async () => {
    const cmd = 'cat ".status"';
    let status = '';
    try {
        status = await execPr(cmd);
    } catch (error) {

    }
    return status;
}

const getLoginImage = async (res) => {
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const port = await execPr(cmd);
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

const getBuyImage = async (res) => {
    fs.createReadStream('./image/buy.jpg').pipe(res);
}

const timeOut = (s) => {
    timer = setTimeout(() => {
        setStatus(IS_FREE)
    }, 1000 * s);
}


setStatus(IS_FREE);

app.get('/login', async (req, res) => {
    const status = await getStatus();
    switch (status) {
        case IS_BUY:
            getBuyImage(res);
            break;
        case IS_FREE:
            setStatus(IS_BUY);
            getLoginImage(res);
            timeOut(360);
        break;
        default:break;
    }
})

app.get('/free', async (req, res) => {
    clearTimeout(timer);
    setStatus(IS_FREE);
    res.sendStatus(200);
})
app.listen(8000, () => console.log('app listening on port 8000!'))
