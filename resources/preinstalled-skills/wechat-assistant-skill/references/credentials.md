# 凭证详细说明

## 1. 微信公众号 AppID / AppSecret

**获取地址**：https://mp.weixin.qq.com → 登录 → 开发 → 基本配置

**字段说明**：
- AppID：公众号的全局唯一标识，不可变更
- AppSecret：调用微信 API 的密钥，泄漏后请立即重置

**用途**：获取 access_token，用于所有微信 API 调用（创建草稿、上传素材等）

**验证方式**：
```bash
curl "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=YOUR_APPID&secret=YOUR_SECRET"
```
返回包含 `access_token` 即为有效。

---

## 2. runnode.cn 图像生成

**API Base**：`https://api.runnode.cn/v1`

**API Key**：在 runnode.cn 平台获取

**模型**：`Qwen/Qwen-Image-2512`

**调用示例**：
```python
import base64, requests

resp = requests.post(
    "https://api.runnode.cn/v1/images/generations",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "model": "Qwen/Qwen-Image-2512",
        "prompt": "你的prompt，16:9横屏构图",
        "response_format": "b64_json"  # 注意：不是 json，是 b64_json
    }
)
b64 = resp.json()["data"][0]["b64_json"]
with open("output.png", "wb") as f:
    f.write(base64.b64decode(b64))
```

> ⚠️ 常见错误：`response_format` 填 `json` 会返回 HTTP 400，正确值是 `b64_json`。

---

## 3. 备选：ai.t8star.cn（不推荐）

**问题**：返回的阿里云 OSS 链接会被代理拦截，无法下载图片。

如需使用，API Base 为 `https://ai.t8star.cn/v1`，API Key 同样在平台获取。

---

## 凭证保存位置

优先顺序：
1. `memory/*.md` 或 `MEMORY.md`（本助手记忆系统）
2. `~/.openclaw/workspace-agent-wechat-assistant/MEMORY.md`
3. `USER.md`
4. `.env` 配置文件
