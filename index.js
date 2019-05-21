const express = require('express');
const request = require('request');
const bodyParser = require('body-parser')
const cookieParser = require("cookie-parser");
// const exec = require('child_process').exec;
const util = require('util');
const log4js = require('log4js');
const exec = util.promisify(require('child_process').exec);
const rp = require('request-promise');
const { createCanvas } = require('canvas')
const app = express();

const logger = log4js.getLogger();
logger.level = 'trace';

// logger.trace('Entering cheese testing');
// logger.debug('Got cheese.');
// logger.info('Cheese is Comté.');
// logger.warn('Cheese is quite smelly.');
// logger.error('Cheese is too ripe!');
// logger.fatal('Cheese was breeding ground for listeria.');

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));



const IS_BUSY = 1; // 容器正在使用中
const IS_FREE = 0; // 容器无人使用

let user = null; // 使用者
let status = IS_FREE; // 容器状态
let timer = null;

const setTimer = () => {
    timer && clearTimeout(timer);
    timer = setTimeout(() => {
        freeContainer();
    }, 1000 * 60 * 30);
}

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
        json: true, // opt 自动转换为json
    };
    let result;
    try {
        result = await rp(options);
    } catch (error) {
        logger.fatal('【获取UUAP用户信息错误】', error);
    }
    // const resultJson = JSON.parse(result);
    if (+result.errno !== 0) {
        return '用户不存在'
    }
    return result.data.name;
}

const getLoginImage = async (res) => {
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const { stdout: port, stderr } = await exec(cmd);
    const options = {
        method: 'GET',
        uri: `http://127.0.0.1:${port}/login?format=image`,
        timeout: 10000,
    };
    setTimer();
    request(options)
    .on('error', (err) => {
        logger.fatal('【登录二维码获取错误】', err);
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
    logger.info('【释放容器】');
    status = IS_FREE;
    user = null;
    // 清空目录
    // const cmd = `rm -fr /projects/*`;
    // const { stdout, stderr } = await exec(cmd);
}

const delOutput = async () => {
    // 清空目录
    const cmd = `rm -fr /projects/*`;
    const { stdout, stderr } = await exec(cmd);
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

app.get('/weixin/del', async (req, res) => {
    let code = 0;
    let message = '删除output目录成功';
    try {
        await delOutput();
    } catch (error) {
        logger.fatal('【删除output目录错误】', error);
        code = -1;
        message = error;
    }
    res.json({
        code,
        message,
    });
});

app.post('/weixin/upload', async (req, res) => {
    const { version, desc } = req.body;
    const cmd = 'cat "/root/.config/wechat_web_devtools/Default/.ide"';
    const { stdout: port, stderr } = await exec(cmd);
    const options = {
        method: 'GET',
        uri: `http://127.0.0.1:${port}/upload`,
        qs: { // fix uri中如果有中文字符rp会报错
            version,
            desc,
            projectpath: '/projects/output'
        },
    }
    let code = 0;
    let message = '上传成功，请到小程序管理后台进行体验版设置！';
    try {
        await rp(options);
    } catch (error) {
        logger.fatal('【上传小程序错误】', error);
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
    // 不管成功失败都会释放容器
    await freeContainer();
    res.json({
        code,
        message,
    });
});

app.get('/weixin/check', async (req, res) => {
    let code = 0;
    let message = '开始构建';
    switch (status) {
        case IS_BUSY:
            code = -1;
            message = '构建失败，当前容器已被其他用户使用！'
            break;
        case IS_FREE:break;
        default:break;
    }
    res.json({
        code,
        message,
    });
})

app.listen(8000, () => console.log('app listening on port 8000!'))
