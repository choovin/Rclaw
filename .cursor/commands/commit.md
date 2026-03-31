---
name: commit
description: 按 Conventional Commits（feat/fix 等）与中文描述审阅差异并提交
---

# Git 提交（Conventional Commits + 中文说明）

执行一次规范的本地提交。标题必须遵循 **[Conventional Commits](https://www.conventionalcommits.org/)**：**类型前缀使用英文小写**（`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert` 等），**冒号后的概括说明使用中文**；专有名词、路径、API、命令可保留英文。正文与 `AGENTS.md`「Git 提交信息」一致时，以中文为主。

## 标题格式

- 基本：`<type>: <中文简短描述>`  
  例：`feat: 侧边栏支持折叠状态记忆`、`fix: 修复 Gateway 重连后消息丢失`
- 可选范围：`<type>(<scope>): <中文描述>`，scope 用小写英文（模块或区域名）。  
  例：`feat(electron): 预加载脚本增加宿主 API 封装`
- **类型选择（常见）**：
  - `feat`：新功能
  - `fix`：缺陷修复
  - `docs`：仅文档
  - `style`：格式/分号等不影响行为的改动
  - `refactor`：重构（无新功能、无修 bug）
  - `perf`：性能优化
  - `test`：测试相关
  - `build` / `ci`：构建或 CI 配置
  - `chore`：杂项（依赖升级、工具脚本等）
- 若有破坏性变更，在标题加 `!`：`feat!: …` 或 `feat(api)!: …`，并在正文或页脚用 `BREAKING CHANGE:` 说明（说明可用中文）。

## 执行步骤

1. **确认范围**：在仓库根目录运行 `git status`；需要时用 `git diff` 与 `git diff --staged` 看清差异。
2. **暂存文件**：对本次要纳入提交的路径执行 `git add`。不要暂存密钥、环境文件、仅本地调试产物或明显误改的文件。
3. **撰写提交说明**：
   - **标题**：按上文格式，**必须**含合法 `type`（及可选 `scope`），描述部分为中文。
   - **正文**（可选）：标题下空一行，中文分条写动机、主要变更、风险或后续工作。
4. **创建提交**：使用 `git commit`；多段正文可用多次 `-m`。
5. **自检**：提交后可用 `git log -1` 确认格式与内容。

若当前没有可提交的有效变更、或范围不明，先说明情况并询问，不要猜测性 `git add -A` 后强行提交。
