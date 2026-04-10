const https = require('https');
const fs = require('fs');
const path = require('path');

// 解析 .env 文件
function loadEnv() {
    const envPath = path.join(__dirname, '../.env');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    return content.split('\n').reduce((acc, line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return acc;
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            acc[key] = val;
        }
        return acc;
    }, {});
}

const env = loadEnv();

// 优先读系统环境变量（RClaw 平台注入），其次读 .env 文件（本地使用）
const API_KEY = process.env.VARIFLIGHT_API_KEY || env['VARIFLIGHT_API_KEY'];
const API_URL = 'https://ai.variflight.com/api/v1/mcp/data';

if (!API_KEY) {
    console.error('错误: 未找到 VARIFLIGHT_API_KEY。');
    console.error('  方式1 (RClaw): 在技能变量设置面板配置 VARIFLIGHT_API_KEY');
    console.error('  方式2 (本地): 在技能根目录创建 .env 文件，写入 VARIFLIGHT_API_KEY=your_key');
    console.error('  申请 Key: https://ai.variflight.com');
    process.exit(1);
}

// 参数校验
const args = process.argv.slice(2);
const mode = args[0];

if (!mode) {
    console.error('用法:');
    console.error('  node query.js flights <dep> <arr> <date>   # 按起降机场查航班列表');
    console.error('  node query.js flight  <fnum> <date>        # 按航班号查实时动态');
    console.error('示例:');
    console.error('  node query.js flights SZX XIY 2026-03-23');
    console.error('  node query.js flight  CA1202 2026-03-23');
    process.exit(1);
}

if (mode === 'flights' && args.length < 4) {
    console.error('flights 模式需要 3 个参数: <dep> <arr> <date>');
    console.error('示例: node query.js flights SZX XIY 2026-03-23');
    process.exit(1);
}

if (mode === 'flight' && args.length < 3) {
    console.error('flight 模式需要 2 个参数: <fnum> <date>');
    console.error('示例: node query.js flight CA1202 2026-03-23');
    process.exit(1);
}

// 发起 API 请求
function request(endpoint, params) {
    const data = JSON.stringify({ endpoint, params });
    const options = {
        method: 'POST',
        headers: {
            'X-VARIFLIGHT-KEY': API_KEY,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(API_URL, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.code !== 200) {
                        reject(new Error(json.message || 'API Error (code: ' + json.code + ')'));
                    } else {
                        resolve(json.data);
                    }
                } catch (e) {
                    reject(new Error('响应解析失败: ' + e.message));
                }
            });
        });
        req.on('error', (e) => reject(new Error('网络请求失败: ' + e.message)));
        req.write(data);
        req.end();
    });
}

// 执行查询
if (mode === 'flights') {
    const [, dep, arr, date] = args;
    request('flights', { dep, arr, date })
        .then(data => {
            if (!data || data.length === 0) {
                console.log(JSON.stringify([]));
                process.exit(0);
            }
            console.log(JSON.stringify(data.map(f => ({
                fnum:    f.FlightNo,
                company: f.FlightCompany,
                dep:     f.org_timezone_name || dep,
                arr:     f.dst_timezone_name || arr,
                depTime: (f.FlightDeptimePlanDate || '').split(' ')[1] || '',
                arrTime: (f.FlightArrtimePlanDate || '').split(' ')[1] || '',
                state:   f.FlightState,
                plane:   f.generic || f.ftype || '',
                ontime:  f.OntimeRate
            })), null, 2));
        })
        .catch(err => { console.error(err.message); process.exit(1); });

} else if (mode === 'flight') {
    const [, fnum, date] = args;
    request('flight', { fnum, date })
        .then(data => console.log(JSON.stringify(data, null, 2)))
        .catch(err => { console.error(err.message); process.exit(1); });

} else {
    console.error('未知模式: ' + mode + '，支持的模式: flights, flight');
    process.exit(1);
}
