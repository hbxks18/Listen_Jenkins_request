const express = require('express');
const fs = require('fs');
const request = require('request');
const bodyParser = require('body-parser')
const cookieParser = require("cookie-parser");
const exec = require('child_process').exec;
const app = express();


app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));



const IS_BUSY = 1; // 有项目正在使用该容器
const IS_FREE = 0; // 该项目无人使用中
const TIME_OUT = 300; // 超时时间，登录未使用，默认为5分钟后释放
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
        user = null;
    }, 1000 * s);
}

app.get('/login', async (req, res) => {
    const curUser = req.cookies.STOKEN;
    if (user && curUser === user) {
        getLoginImage(res);
        return;
    }
    switch (status) {
        case IS_BUSY:
            getBusyImage(res);
            break;
        case IS_FREE:
            status = IS_BUSY;
            user = curUser;
            timeout(TIME_OUT);
            getLoginImage(res);
        break;
        default:break;
    }
})

app.get('/free', async (req, res) => {
    clearTimeout(timer);
    status = IS_FREE;
    user = null;
    res.sendStatus(200);
})

app.post('/upload', async (req, res) => {
    const { version } = req.body;
    console.log(version)
    console.log(req.body, req.query)
    res.json({
        code: -1,
        message: '错误'
    });
})

app.listen(8000, () => console.log('app listening on port 8000!'))
