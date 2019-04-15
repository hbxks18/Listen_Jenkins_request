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
// const TIME_OUT = 300; // 超时时间，登录未使用，默认为5分钟后释放
// let timer = null;
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

const generateImageStream = (opt) => {
    const { width = 250, height = 250, bg = 'white', data = [] } = opt;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    data.forEach((item) => {
        const { text, x, y, color = 'black', font = '16px "Microsoft YaHei"' } = item;
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.fillText(text, x, y);
    });
    return canvas.createPNGStream();
}

const getUserName = async () => {
    const options = {
        method: 'GET',
        uri: `http://***/checklogin?SFTCUUAP=${user}&platform=jenkins`,
    };
    const result = await rp(options);
    const resultJson = JSON.parse(result);
    if (+resultJson.errno !== 0) {
        return '用户不存在'
    }
    return resultJson.data.name;
}

const getLoginImage = async (res) => {
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const port = await execPr(cmd);
    const options = {
        method: 'GET',
        uri: `http://127.0.0.1:${port}/login?format=image`,
        timeout: 10000,
    };
    request(options)
    .on('error', (err) => {
        console.log('【登录二维码获取失败】', err);
        const stream = generateImageStream({
            data: [
                {
                    text: '登录二维码获取失败',
                    x: 0,
                    y: 50,
                    color: 'red',
                    font: '24px "Microsoft YaHei"',
                },
                {
                    text: '请刷新本页面重试',
                    x: 0,
                    y: 130,
                    color: 'red',
                },
                {
                    text: '或联系管理员处理',
                    x: 0,
                    y: 150,
                    color: 'red',
                },
            ]
        });
        res.type("png");
        stream.pipe(res);
    })
    .pipe(res);
}

const getBusyImage = async (res) => {
    const name = await getUserName();
    const data = [
        {
            text: '当前容器正在使用中！',
            x: 0,
            y: 50,
            color: 'red',
            font: '24px "Microsoft YaHei"',
        },
        {
            text: `操作用户：${name}`,
            x: 0,
            y: 90,
            color: 'red',
            font: '22px "Microsoft YaHei"',
        },
        {
            text: '(稍等几分钟后刷新本页重试',
            x: 0,
            y: 130,
            color: 'red',
        },
        {
            text: '或联系当前操作用户)',
            x: 0,
            y: 150,
            color: 'red',
        },
    ];
    const stream = generateImageStream({
        data,
    });
    res.type("png");
    stream.pipe(res);
}

const timeout = (s) => {
    timer = setTimeout(() => {
        status = IS_FREE;
        user = null;
    }, 1000 * s);
}

app.get('/weixin/login', async (req, res) => {
    const curUser = req.cookies.SFTCUUAP;
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
            // timeout(TIME_OUT); 防止扫码登录之后，超过五分钟没有操作，他人登录后，又进行发布，导致串号
            getLoginImage(res);
        break;
        default:break;
    }
})

app.get('/weixin/free', async (req, res) => {
    // clearTimeout(timer);
    status = IS_FREE;
    user = null;
    res.json({
        code: 0,
        message: '上传容器释放成功，其他用户可正常使用！'
    });
})

app.post('/weixin/upload', async (req, res) => {
    const { version, job_name, desc } = req.body;
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const port = await execPr(cmd);
    const options = {
        method: 'GET',
        uri: `http://127.0.0.1:${port}/upload?version=${version}&desc=${desc}&projectpath=/projects`,
    }
    let code = 0;
    let message = '上传成功，请到小程序管理后台进行体验版设置！';
    try {
        await rp(options);
    } catch (error) {
        let err = {};
        try {
            err = JSON.parse(error.error);
        } catch (e) {
            err.code = -1;
            err.error = error;
        }

        code = err.code;
        message = err.error;
    }

    res.json({
        code,
        message,
    });

})

app.listen(8000, () => console.log('app listening on port 8000!'))
