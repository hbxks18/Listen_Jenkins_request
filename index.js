const express = require('express');
const request = require('request');
const bodyParser = require('body-parser')
const cookieParser = require("cookie-parser");
// const exec = require('child_process').exec;
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const rp = require('request-promise');
const { createCanvas } = require('canvas')
const app = express();


app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));



const IS_BUSY = 1; // 容器正在使用中
const IS_FREE = 0; // 容器无人使用

let user = null; // 使用者
let status = IS_FREE; // 容器状态


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

const getImageByDate = async (res, opt) => {
    const stream = generateImageStream(opt);
    res.type("png");
    stream.pipe(res);
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
    const { stdout: port, stderr } = await exec(cmd);
    const options = {
        method: 'GET',
        uri: `http://127.0.0.1:${port}/login?format=image`,
        timeout: 10000,
    };
    request(options)
    .on('error', (err) => {
        console.log('【登录二维码获取失败】', err);
        getImageByDate(res, {
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
    getImageByDate(res, {
        data,
    });
}



const freeContainer = async () => {
    status = IS_FREE;
    user = null;
    // 清空目录
    const cmd = 'rm -fr "/projects/*"';
    const { stdout, stderr } = await exec(cmd);
    console.log(`【freeContainer】stdout：${stdout}`)
    console.log(`【freeContainer】stderr：${stderr}`)
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
            getLoginImage(res);
        break;
        default:break;
    }
})

app.get('/weixin/free', async (req, res) => {
    const curUser = req.cookies.SFTCUUAP;
    const { check } = req.query;
    if (check) { // 构建页面的手动释放按钮，需校验身份为创建者才释放
        if (curUser === user) {
            await freeContainer();
            getImageByDate(res, {
                width: 500,
                height: 100,
                data: [{
                    text: '释放容器成功，其他用户刷新后可正常使用！',
                    x: 0,
                    y: 50,
                    color: 'red',
                    font: '24px "Microsoft YaHei"',
                }]
            })
        } else {
            getImageByDate(res, {
                width: 500,
                height: 100,
                data: [{
                    text: '当前容器不是您创建，只能有当前操作人释放，请联系当前操作人释放。',
                    x: 0,
                    y: 50,
                    color: 'red',
                    font: '24px "Microsoft YaHei"',
                }]
            });
        }
    } else {
        await freeContainer();
        res.json({
            code: 0,
            message: '上传容器释放成功，其他用户可正常使用！'
        });
    }

})

app.post('/weixin/upload', async (req, res) => {
    const { version, desc } = req.body;
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const { stdout: port, stderr } = await exec(cmd);
    const options = {
        method: 'GET',
        uri: `http://127.0.0.1:${port}/upload?version=${version}&desc=${desc}&projectpath=/projects/output`,
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
    // 不管成功失败都会释放容器和删除output
    await freeContainer();

    res.json({
        code,
        message,
    });

})

app.listen(8000, () => console.log('app listening on port 8000!'))
