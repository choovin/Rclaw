---
name: "variflight"
description: "基于飞常准 (VariFlight) Aviation MCP Server 官方接口的专业民航数据工具。支持实时航班动态及 OD 对航班查询。"
vm0_secrets:
  - VARIFLIGHT_API_KEY
---

# 飞常准航班查询

通过飞常准官方接口查询实时航班数据，支持两种查询模式：按起降机场查航班列表、按航班号查实时动态。

## 前置条件

### 1. Node.js 安装（需已安装）

| 平台 | 安装方式 |
|------|---------|
| macOS | `brew install node` |
| Windows | `winget install OpenJS.NodeJS` |
| Linux | `sudo apt install nodejs` |

验证：`node --version`

### 2. API Key 获取与配置

#### 2.1 获取 API Key（如无 Key，按以下步骤操作）

1. 打开 https://ai.variflight.com
2. 选择 **Aviation MCP** 方案，点击「立即接入」
3. 登录账号（如无账号，先注册并完成邮箱激活）
4. 登录后进入 https://ai.variflight.com/keys
5. 点击「创建 Key」，复制生成的 Key 备用

#### 2.2 配置 Key

将你的 Key 告诉模型，模型会自动将 Key 写入技能根目录的 `.env` 文件：

```
VARIFLIGHT_API_KEY=your_key_here
```

也可以参考 `.env.example` 自行创建该文件并填入 Key。

## 工作流

### Step 1：检查前置条件

确认以下两项就绪后再执行查询：

- Node.js 可用：`node --version`
- API Key 已配置（`.env` 文件存在且含有效的 `VARIFLIGHT_API_KEY`）

若 Key 未配置，脚本会输出具体错误提示，按提示操作后重试。

### Step 2：识别查询意图

根据用户输入确定查询模式和参数：

| 用户需求 | 模式 | 所需参数 |
|---------|------|---------|
| "深圳飞西安今天有哪些航班" | `flights` | 出发机场代码、到达机场代码、日期 |
| "CA1202 今天的动态" | `flight` | 航班号、日期 |

**日期格式：** `YYYY-MM-DD`（如 `2026-03-23`）

**常用机场代码：**

| 代码 | 机场 | 代码 | 机场 |
|------|------|------|------|
| PEK | 北京首都 | CAN | 广州白云 |
| PKX | 北京大兴 | SZX | 深圳 |
| SHA | 上海虹桥 | CTU | 成都天府 |
| PVG | 上海浦东 | XIY | 西安咸阳 |
| HGH | 杭州萧山 | WUH | 武汉天河 |

若用户只说城市名未给代码，根据上表自动转换；常见城市不在表中时，询问用户确认。

### Step 3：执行查询脚本

**查询航班列表（flights 模式）：**

```bash
node ${SKILL_DIR}/scripts/query.js flights <dep> <arr> <date>
```

示例：
```bash
node ${SKILL_DIR}/scripts/query.js flights SZX XIY 2026-03-23
```

**查询航班实时动态（flight 模式）：**

```bash
node ${SKILL_DIR}/scripts/query.js flight <fnum> <date>
```

示例：
```bash
node ${SKILL_DIR}/scripts/query.js flight CA1202 2026-03-23
```

### Step 4：整理并呈现结果

脚本输出 JSON，不要直接展示原始数据，按以下规则整理后呈现给用户。

## 数据呈现

### flights 模式 — 呈现为表格

| 航班 | 航司 | 计划起飞 | 计划到达 | 状态 | 机型 | 准点率 |
|------|------|---------|---------|------|------|------|
| CA1202 | 中国国际航空 | 08:00 | 10:30 | 正常 | 波音737 | 82% |

**航班状态说明：**

| 状态值 | 含义 |
|--------|------|
| 计划 | 航班计划中，未起飞 |
| 起飞 | 已离港 |
| 到达 | 已落地 |
| 取消 | 航班取消 |
| 延误 | 延误出发 |

若返回空列表，告知用户该日期该航线无航班数据。

### flight 模式 — 呈现关键动态

提取并展示：实际/计划起降时间、当前状态、所在位置（如有）、延误原因（如有），用简洁文字描述，不要把完整JSON 堆给用户。

## 故障排查

| 错误信息 | 原因 | 解决方式 |
|---------|------|---------|
| 未找到 VARIFLIGHT_API_KEY | Key 未配置 | 按前置条件2配置 |
| API Error | Key 无效或过期 | 登录飞常准控制台检查 Key |
| 网络请求失败 | 网络问题 | 检查网络连接，飞常准为国内服务 |
| 参数不足 | 命令参数有误 | 参考 Step 3 的示例命令 |
