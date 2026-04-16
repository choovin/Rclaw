---
name: wechat-assistant
description: 公众号助手完整工作技能。包含：凭证配置、智能文章创作（标题/改写）、AI去AI化润色、16:9横屏配图生成、HTML排版、封面生成、草稿发布完整流程。触发场景：用户需要创作/发布/管理公众号文章时使用。
---

# 公众号助手 — 完整工作流

## 工作流程总览

```
配置凭证 → 创作文章 → AI润色 → 生成配图 → HTML排版 → 推送草稿
```

---

## 阶段一：配置（首次使用）

### 凭证获取地址

| 凭证 | 获取地址 |
|------|----------|
| 微信公众号 AppID | https://mp.weixin.qq.com → 开发 → 基本配置 |
| 微信公众号 AppSecret | 同上（需管理员扫码重置） |
| runnode.cn API Key | https://api.runnode.cn → API Keys |

### 运行配置脚本

```bash
python scripts/guided_setup.py
```

脚本从环境变量读取凭证（`WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`RUNNODE_API_KEY`），验证有效性后保存。

### 备选：手动 .env 文件

```bash
cp .env.example .env
# 填入真实凭证后运行
```

---

## 阶段二：智能文章创作

### 模式一：基于标题创作（推荐）

用户给标题 → 搜索资料 → AI创作 → 输出文章

```
用户: 写一篇关于"AI提升工作效率"的文章
→ 使用 Tavily/DuckDuckGo 搜索相关资料
→ 根据资料创作1200-1500字文章
→ 进入润色阶段
```

### 模式二：基于参考文章改写

用户提供微信文章链接 → 提取内容 → 改写 → 输出

```
用户: 帮我改写这篇：https://mp.weixin.qq.com/s/xxx
→ python3 scripts/extract_to_markdown.py "URL"
→ AI改写文章（保持核心观点，改变表达）
→ 进入润色阶段
```

### 模式三：用户提供完整内容

用户直接给正文 → 润色 → 配图 → 排版

---

## 阶段三：AI去AI化润色（必做）

AI生成的文章必须经过润色才能用。核心原则：**AI写作的目标不是"完美"，而是"真实"**。

### 典型AI特征（必须消除）

- 句式结构过于规整，每段3-4句长度一致
- 过渡词机械重复："首先、其次、最后"
- 开头太正式："在当今社会"、"随着时代发展"
- 结尾太升华："让我们一起"、"相信未来"
- 用词过度正式："进行"、"实施"、"开展"
- 缺乏真实情感和个性表达

### 润色技巧

1. **打破句式规律**：混合短句/中句/长句，单句成段制造停顿感
2. **加入真实视角**：加入个人感受、"我"的经验，让文章有温度
3. **制造矛盾冲突**：不必每段都完美过渡，可以有转折和意外
4. **用口语化表达**：适当用"说实话"、"其实"等口头禅
5. **删减过渡词**：少用"首先其次最后"，用自然衔接替代

润色完成后文章应该读起来像真人写的，有瑕疵、有个性、有温度。

---

## 阶段四：配图生成

### 规则（必须遵守）

- **数量**：每篇文章至少3张文中配图
- **比例**：16:9 横屏构图
- **内容**：配图必须与文章内容相关，禁止无关图
- **prompt后缀**：必须加"16:9横屏构图"
- **API注意**：response_format 填 `b64_json`（不是 `json`）
- **检查**：生成后必须肉眼检查文字是否有乱码，有乱码必须重生成

### 生成方式

使用 runnode.cn 生成：

```python
import base64, requests

resp = requests.post(
    "https://api.runnode.cn/v1/images/generations",
    headers={"Authorization": "Bearer YOUR_RUNNODE_API_KEY"},
    json={
        "model": "Qwen/Qwen-Image-2512",
        "prompt": "你的prompt，16:9横屏构图",
        "response_format": "b64_json"  # 注意：不是 json
    }
)
b64 = resp.json()["data"][0]["b64_json"]
with open("output.png", "wb") as f:
    f.write(base64.b64decode(b64))
```

---

## 阶段五：HTML排版

### 排版元素

| 元素 | 样式 |
|------|------|
| 正文段落 | 16px，行高1.8，深色(#1a1a1a) |
| 辅助文字 | 灰色(#888或#555) |
| 小标题 | 19px，深蓝(#2c3e50)，顶部留白24px |
| 误区/警告卡片 | 浅灰背景 + 左侧4px红色边框 |
| 场景区块 | 浅蓝背景(#f0f4ff) + 1px边框 + 圆角 |
| 结尾总结区 | 深色背景(#1a1a1a) + 白色/金色字 |
| 配图 | width:100% + border-radius:8px |
| 表格表头 | 深色背景(#2c3e50) + 白色字 |

### 规范

- 表头：深色背景(#2c3e50) + 白色字，不用浅蓝背景
- 表格：markdown转HTML后手动删除分割线 `|------|` 行
- 分隔符：清理 `<hr style="margin: 24px 8px..." />`
- 嵌套p标签：插入图片后检查是否有 `<p>...<p>img</p>text</p>` 嵌套

---

## 阶段六：封面生成

封面建议分辨率：1664×928（16:9），大小不超过2MB。

```bash
python3 scripts/generate_cover.py --prompt "封面描述" --provider qwen
```

---

## 阶段七：发布草稿

### 完整流程

**关键：草稿图片必须用永久素材库的 URL，临时 media_id 在编辑器里不显示图片。**

```bash
# 1. 上传封面到微信永久素材库
python3 scripts/upload_material.py \
  --app_id YOUR_WECHAT_APPID \
  --app_secret YOUR_WECHAT_APPSECRET \
  --image_path cover.jpg
# → 返回 thumb_media_id（永久素材ID）

# 2. 上传文中配图到永久素材库，获取 URL
# （3张配图分别上传，用返回的 url 填入 HTML）

# 3. 创建草稿
python3 scripts/create_draft.py \
  --app_id YOUR_WECHAT_APPID \
  --app_secret YOUR_WECHAT_APPSECRET \
  --title "文章标题" \
  --content "HTML内容" \
  --thumb_media_id "上传后返回的永久素材ID"
```

### 重要提醒

- **只创建草稿到草稿箱，发布需人工手动操作**
- 草稿箱地址：https://mp.weixin.qq.com → 内容与互动 → 草稿
- 草稿编辑器只认**永久素材 URL**（mmbiz.qpic.cn 开头），临时 media_id 会显示空白

---

## 脚本索引

- `scripts/guided_setup.py` — 凭证配置（非交互式，通过环境变量）
- `scripts/extract_to_markdown.py` — 提取微信公众号文章为Markdown（暂缺，需补充）
- `scripts/generate_cover.py` — 生成封面图片（暂缺，需补充）
- `scripts/upload_material.py` — 上传图片到微信服务器（暂缺，需补充）
- `scripts/create_draft.py` — 创建文章草稿（暂缺，需补充）

---

## 核心规范（必须记忆）

1. 科技/商业类文章必须先搜索核实，不能凭记忆直接写
2. 每篇文章至少3张文中配图，16:9横屏
3. AI生图后必须检查文字是否有乱码
4. 文章完成后先自查：内容、配图、格式
5. 只建草稿，发布需人工操作
6. 润色是必做步骤，不可跳过
7. **草稿图片必须用永久素材 URL，临时 media_id 不显示**
8. **runnode response_format 填 `b64_json`，不是 `json`**
