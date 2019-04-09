const express = require('express');
const fs = require('fs');
const request = require('request');
const bodyParser = require('body-parser')
const cookieParser = require("cookie-parser");
const exec = require('child_process').exec;
const rp = require('request-promise');
const { createCanvas } = require('canvas')
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
        uri: `http://127.0.0.1:${port}/login?format=image`,
    };
    request(options)
    .on('error', (err) => {
        console.log('【登录二维码获取失败】', err)
    })
    .pipe(res);
}

const getBusyImage = (res) => {
    const canvas = createCanvas(250, 250);
    const ctx = canvas.getContext('2d');
    ctx.fillText('Hellow', 84, 24, 204)
    // fs.createReadStream('./image/busy.jpg').pipe(res);
    // const out = fs.createReadStream('./image/busy.jpeg');
    const stream = canvas.createPNGStream();
    res.type("png");
    stream.pipe(res)
    // out.on('finish', () =>  console.log('The JPEG file was created.'))

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
    res.json({
        code: 0,
        message: '上传容器释放成功，其他用户可正常使用！'
    });
})

app.post('/upload', async (req, res) => {
    const { version, job_name, desc } = req.body;
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const port = await execPr(cmd);
    const options = {
        method: 'GET',
        uri: `http://127.0.0.1:${port}/upload?projectpath=${`/projects/${job_name}/output`}&version=${version}&desc=${desc}`,
    }
    let code = 0;
    let message = '上传成功，请到小程序管理后台进行体验版设置！';
    try {
        await rp(options);
    } catch (error) {
        const err = JSON.parse(error.error);
        code = err.code;
        message = err.error;
    }

    res.json({
        code,
        message,
    });

})

app.listen(8000, () => console.log('app listening on port 8000!'))
