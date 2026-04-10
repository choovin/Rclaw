---
name: wechat-article
description: 微信公众号一站式创作技能 — 写文章、AI生成封面图和正文配图、API发布到公众号。当用户提到写公众号文章、生成封面、发布公众号时激活。
metadata: { "openclaw": { "emoji": "📝", "requires": { "bins": ["python"] } } }
---

# 微信公众号一站式创作技能

集成写作、AI配图、API发布的完整公众号工作流。

## 语言

**跟随用户语言**：用户用中文就中文回复，用英文就英文回复。

## 脚本目录

以本 SKILL.md 所在目录为 `SKILL_DIR`：

| 脚本 | 用途 |
|------|------|
| `scripts/generate_image.py` | AI 生成图片（RunNode） |
| `scripts/wechat-api.ts` | API 方式发布到公众号（内置 Markdown→HTML 转换） |

## 前置依赖

首次使用前检查 Python 依赖：

```bash
python -c "import PIL; print('ok')"
```

失败则安装：

```bash
python -m pip install pillow
```

---

## 工作模式

收到写作需求后，在策划阶段让用户选择工作模式：

```
请选择本次工作模式：

A) 仅写作 — 只生成文章
B) 写作 + 配图 — 生成文章 + 封面图 + 正文配图
C) 全流程 — 写作 + 配图 + 发布到公众号
```

| 模式 | 执行步骤 |
|------|---------|
| A 仅写作 | 策划 → 写作 → 排版 → 保存 Markdown |
| B 写作+配图 | 策划 → 写作(含图片占位符) → AI生图 → 替换占位符 → 保存 Markdown |
| C 全流程 | 策划 → 写作 → AI生图 → 转HTML → API发布 → 报告 |

如果用户的意图很明确（如"帮我把这篇文章发布到公众号"），不用问模式，直接执行对应环节。

---

## Step 1: 偏好配置（EXTEND.md）

首次使用时检查是否有 EXTEND.md：

```bash
# 项目级
test -f .baoyu-skills/baoyu-post-to-wechat/EXTEND.md && echo "project"

# 用户级
test -f "$HOME/.baoyu-skills/baoyu-post-to-wechat/EXTEND.md" && echo "user"
```

| 结果 | 操作 |
|------|------|
| 找到 | 读取配置，继续 |
| 未找到 | 执行首次配置（见下方） |

### 首次配置

**阻塞操作**：必须完成配置后才能继续其他步骤。

一次性询问以下问题：

1. **默认主题**：`default`（经典）/ `grace`（优雅）/ `simple`（简洁）
2. **默认作者**：留空或填写
3. **保存位置**：项目级 `.baoyu-skills/` / 用户级 `~/.baoyu-skills/`

配置保存为 EXTEND.md：

```md
default_theme: default
default_author:
```

**配置优先级**：CLI 参数 > Frontmatter > EXTEND.md > 默认值

---

## Step 2: 策划

收到写作需求后，询问：

```
我帮你策划一下这篇文章，先问几个问题：

1. 主题是什么？（用1句话说）
2. 目标读者是谁？
3. 你想表达什么核心观点或故事？
4. 有哪些数据或案例可以用？
```

### 标题策略

- ✅ **悬念式**：「我为什么放弃了年薪 50W 的工作」
- ✅ **反问式**：「你真的了解 AI 吗？」
- ✅ **数字式**：「50% 的人都误解了这个道理」
- ✅ **对比式**：「BAT vs 创业公司，差在哪里」
- ❌ **结论式**：「XX 的 3 个方法」（太平淡）

收集完信息后，在 `drafts/` 创建策划文档 `drafts/plan_[主题].md`。

---

## Step 3: 写作

### 写作风格

遵循**傅盛写作风格**：
- **口语化**：像跟朋友聊天，不是学术论文
- **故事感**：用具体事例代替空洞理论
- **有态度**：表达观点，不做和稀泥
- **简化复杂**：善用类比让难懂的东西变简单

### 写作要点

**1. 用故事代替说教**

❌ "风险管理很重要，应该制定应急预案"

✅ "去年我创业的团队就是因为没有备选方案，一个核心员工离职就差点垮掉。从那以后，我学会了给每个岗位预留 backup。"

**2. 善用类比**

❌ "分布式系统很复杂"

✅ "分布式系统就像一家连锁餐厅，每个分店要相互协作又要独立运营，稍微一个环节没协调好，整个体验就崩了。"

**3. 数据支撑但不堆砌**

❌ "根据 IDC 报告，全球 AI 市场 2023 年增长 45%..."

✅ "AI 市场在疯狂增长——每年翻番。但这个增长背后，真正赚钱的公司不超过 5 家。"

**4. 直接说观点**

❌ "有人认为...也有人认为...各有各的道理"

✅ "老实说，我觉得 XX 这个做法是错的，原因是..."

**5. 用短句和换行**

❌ "今天我想和大家分享一个非常重要的观点，那就是在创业的过程中，我们需要不断地学习和适应市场变化..."

✅ "今天我想说一个观点。\n\n创业最怕的不是失败。\n是失败后还不知道为什么失败。"

### 文章结构

```markdown
---
title: 文章标题
author: 作者名
cover: C:/Users/xxx/.openclaw/skills/wechat-article/output/covers/cover_xxx.jpg
---

# 标题

## [开头] (100-150 字)
[用故事、数据或问题勾起兴趣]

---

## [主体] (800-1500 字)

### 观点 1 小标题
[具体案例或故事]
[解释观点]

### 观点 2 小标题
[具体案例或故事]
[解释观点]

### 观点 3 小标题
[具体案例或故事]
[解释观点]

---

## [结尾] (100-150 字)
[总结核心观点]
[留下思考或行动建议]
```

### 图片占位符（模式B和C）

在需要配图的位置插入占位符：

```markdown
## 创业最怕的不是失败

[IMG: 一个创业者站在分岔路口，一侧光明一侧黑暗，现代插画风格]

创业最怕的不是失败，是失败后还不知道为什么失败...
```

**占位符格式**：`[IMG: 图片描述prompt]`

prompt 编写指引：
- 描述画面内容、构图、风格
- 使用英文或中文均可
- 避免包含文字内容（AI生图不擅长渲染文字）
- 示例：`[IMG: A laptop on a wooden desk with a cup of coffee, warm morning light, minimalist photography style]`

文章保存为 `drafts/article_[主题].md`。

---

## Step 4: AI 生成图片

**仅模式 B 和 C 执行此步骤。**

### 4.1 生成封面图

根据文章标题和主题，生成 prompt 并调用。`--filename` 必须使用**绝对路径**：

```bash
python ${SKILL_DIR}/scripts/generate_image.py \
  --prompt "封面图描述prompt" \
  --filename "${SKILL_DIR}/output/covers/cover_[slug].jpg" \
  --aspect-ratio 16:9
```

> `${SKILL_DIR}` 展开后是绝对路径，确保生成的图片路径也是绝对路径。

封面图 prompt 指引：
- 体现文章核心主题
- 视觉冲击力强，适合缩略图展示
- 避免画面中出现文字
- 风格建议：现代、简洁、有质感

生成后更新 frontmatter 中的 `cover` 字段（使用绝对路径）。

### 4.2 生成正文配图

提取文章中所有 `[IMG: ...]` 占位符，逐个生成。`--filename` 必须使用**绝对路径**：

```bash
python ${SKILL_DIR}/scripts/generate_image.py \
  --prompt "占位符中的描述" \
  --filename "${SKILL_DIR}/output/images/img_001.jpg" \
  --aspect-ratio 16:9
```

### 4.3 替换占位符

将所有 `[IMG: 描述]` 替换为标准 Markdown 图片语法。

**重要**：
1. **必须使用绝对路径**，因为文章保存在 `drafts/` 目录，而图片在 `output/` 目录，相对路径会导致发布时找不到图片。
2. **路径必须使用正斜杠 `/`**，不能用反斜杠 `\`。Markdown 渲染时反斜杠会被当作转义字符，导致路径错误（如 `\.openclaw` 变成 `.openclaw`）。

```markdown
# 替换前
[IMG: 一个创业者站在分岔路口]

# ✅ 正确（正斜杠 + 绝对路径）
![一个创业者站在分岔路口](C:/Users/ADMIN/.openclaw/skills/wechat-article/output/images/img_001.jpg)

# ❌ 错误（反斜杠会被转义）
![一个创业者站在分岔路口](C:\Users\ADMIN\.openclaw\skills\wechat-article\output\images\img_001.jpg)
```

同样，frontmatter 中的 `cover` 字段也必须使用正斜杠的绝对路径：

```yaml
cover: C:/Users/ADMIN/.openclaw/skills/wechat-article/output/covers/cover_xxx.jpg
```

### AI 生图参数说明

- **分辨率**：`2K`（默认）或 `3K`
- **宽高比**：封面固定 `16:9`，正文配图默认 `16:9`
- **输出格式**：自动检测 PNG/JPEG
- **模型**：默认 `runnode/z_image_turbo_bf16`
- 只报告保存路径，不回读图片内容

---

## Step 5: 排版检查

使用以下清单自检：

- [ ] 标题能引起好奇心或共鸣吗？
- [ ] 开头 100 字能抓住读者吗？
- [ ] 有 2-3 个清晰观点吗？
- [ ] 用了故事而非说教吗？
- [ ] 段落长度合适吗？（3-5 行）
- [ ] 封面图专业且匹配内容吗？（模式B/C）
- [ ] 有错别字或语病吗？

### 排版建议

- **段落长度**：3-5 行为宜
- **标题层级**：最多用 2 层（##），不要嵌套太深
- **加粗**：只强调 1-2 个最重要的词
- **引用**：用于数据、金句或重要观点
- **列表**：最多 5 项，太多改成段落
- 公众号偏好短句 + 多换行

---

## Step 6: 发布到公众号

**仅模式 C 执行此步骤。**

### 6.1 检查凭证

```bash
# 项目级
test -f .baoyu-skills/.env && grep -q "WECHAT_APP_ID" .baoyu-skills/.env && echo "project"

# 用户级
test -f "$HOME/.baoyu-skills/.env" && grep -q "WECHAT_APP_ID" "$HOME/.baoyu-skills/.env" && echo "user"
```

**凭证缺失时引导设置**：

```
微信 API 凭证未找到。

获取方式：
1. 访问 https://mp.weixin.qq.com
2. 进入：开发 → 基本配置
3. 复制 AppID 和 AppSecret

保存位置：
A) 项目级：.baoyu-skills/.env（仅当前项目）
B) 用户级：~/.baoyu-skills/.env（所有项目）
```

保存为 `.env` 文件：

```
WECHAT_APP_ID=<用户输入>
WECHAT_APP_SECRET=<用户输入>
```

### 6.2 验证元数据

| 字段 | 缺失时 |
|------|--------|
| Title | 提示输入或从H1/H2自动提取 |
| Summary | 提示输入或从首段自动截取（120字内） |
| Author | 回退链：CLI → frontmatter → EXTEND.md `default_author` |
| Cover | 回退链：frontmatter `cover` → 首张正文配图 → 停止并请求 |

### 6.3 API 发布

```bash
npx -y bun ${SKILL_DIR}/scripts/wechat-api.ts <文件路径> \
  [--title <标题>] \
  [--summary <摘要>] \
  [--author <作者>] \
  [--cover <封面图路径>] \
  [--theme <主题>]
```

支持 Markdown 或 HTML 文件输入。脚本会自动：
- 转换 Markdown 为 HTML（如输入为 .md，内置 `md/render.ts` 渲染引擎）
- 上传正文中的图片到微信素材库
- 上传封面图
- 创建草稿

评论默认开放，所有用户可评论（脚本内置默认值）。

### 6.4 完成报告

```
发布完成！

输入：[类型] - [路径]
主题：[主题名]

文章信息：
• 标题：[标题]
• 摘要：[摘要]
• 配图：[N] 张

结果：
✓ 草稿已保存到微信公众号
• media_id: [media_id]

下一步：
→ 管理草稿：https://mp.weixin.qq.com（登录后进入「内容管理」→「草稿箱」）

生成的文件：
• drafts/article_xxx.md
• output/covers/cover_xxx.jpg
• output/images/img_001.jpg ~ img_00N.jpg
```

---

## 目录结构

```
wechat-article/
├── SKILL.md                    # 本文件
├── .rclaw-metadata.json
├── scripts/
│   ├── generate_image.py       # AI生图（RunNode 图片生成）
│   ├── wechat-api.ts           # API发布（内置Markdown→HTML转换）
│   ├── md-to-wechat.ts         # 辅助：Markdown转HTML + 图片占位符提取
│   └── md/
│       ├── render.ts           # Markdown渲染引擎
│       ├── extensions/         # 扩展（alert/footnotes/katex等）
│       ├── themes/             # 主题样式
│       │   ├── base.css
│       │   ├── default.css
│       │   ├── grace.css
│       │   └── simple.css
│       ├── utils/
│       └── LICENSE
├── drafts/                     # 草稿和策划文档
│   ├── plan_*.md               # 文章策划
│   └── article_*.md            # 文章正文
└── output/
    ├── covers/                 # 封面图
    └── images/                 # 正文配图
```

---

## 配置文件

### EXTEND.md

偏好配置，路径优先级：
1. `.baoyu-skills/baoyu-post-to-wechat/EXTEND.md`（项目级）
2. `~/.baoyu-skills/baoyu-post-to-wechat/EXTEND.md`（用户级）

| 键 | 默认值 | 说明 |
|----|--------|------|
| `default_theme` | `default` | 文章主题（default/grace/simple） |
| `default_author` | 空 | 默认作者名 |

### API 凭证

存放于 `.baoyu-skills/.env`，优先级：
1. 环境变量
2. `<cwd>/.baoyu-skills/.env`（项目级）
3. `~/.baoyu-skills/.env`（用户级）

| 变量 | 用途 |
|------|------|
| `WECHAT_APP_ID` | 公众号 AppID |
| `WECHAT_APP_SECRET` | 公众号 AppSecret |

---

## 主题预览

| 主题 | 风格 |
|------|------|
| `default` | 经典 — 标题居中带底边，二级标题白字彩底 |
| `grace` | 优雅 — 文字阴影，圆角卡片，精致引用块 |
| `simple` | 简洁 — 现代极简，不对称圆角，清爽留白 |

---

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| API 凭证缺失 | 按 Step 6.1 引导配置 |
| Access Token 过期 | 脚本自动重新获取 |
| 封面图缺失 | 使用模式B/C 自动生成，或手动指定 `--cover` |
| 图片生成失败 | 检查 Python 依赖（pillow）是否安装 |
| 摘要超过 120 字 | 脚本自动截断（保留到最近标点或加...） |
| 标题/摘要缺失 | 自动从文章 H1/首段提取 |
| EXTEND.md 配置有误 | 删除文件重新触发首次配置 |
| Markdown 转 HTML 失败 | 检查 bun 是否可用（`npx -y bun --version`） |
| 正文配图上传失败 | 检查两点：①路径是否为绝对路径（文章在 `drafts/`，图片在 `output/`，相对路径会解析错误）；②Windows 路径必须用正斜杠 `/`，反斜杠 `\` 在Markdown 中会被转义 |

---

## 注意事项

1. **保持傅盛风格**：口语化、故事感、有态度、简化复杂
2. **质量优先**：不为完成任务写水文
3. **案例真实**：可用「我见过...」「有个朋友...」虚构，但要合理
4. **数据适度**：不堆砌数据，用故事包裹数字
5. **标题重要**：花时间打磨标题，它决定打开率
6. **AI 配图 prompt**：描述画面，避免文字内容，注重风格一致性
