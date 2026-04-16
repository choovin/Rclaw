#!/usr/bin/env python3
"""
公众号助手 - 非交互式配置脚本（不含 Tavily）
适用于无 stdin 的 Agent 环境，从环境变量读取凭证
"""

import os
import sys
import json
import urllib.request
import urllib.error

APP_ID = os.environ.get("WECHAT_APP_ID", "")
APP_SECRET = os.environ.get("WECHAT_APP_SECRET", "")
RUNNODE_KEY = os.environ.get("RUNNODE_API_KEY", "")

MEMORY_PATH = os.path.expanduser("~/.openclaw/workspace-agent-wechat-assistant/MEMORY.md")


def load_memory():
    if os.path.exists(MEMORY_PATH):
        with open(MEMORY_PATH, "r") as f:
            return f.read()
    return ""


def save_memory(content):
    os.makedirs(os.path.dirname(MEMORY_PATH), exist_ok=True)
    with open(MEMORY_PATH, "w") as f:
        f.write(content)


def update_credential(content, service, field, value):
    if not value:
        return content
    lines = content.split("\n")
    prefix = f"| {service} | {field} |"
    updated = False
    for i, line in enumerate(lines):
        if line.startswith(prefix):
            lines[i] = f"| {service} | {field} | {value} |"
            updated = True
            break
    if not updated:
        insert_pos = len(lines)
        for i, line in enumerate(lines):
            if line.strip() == "---" and i > 5:
                insert_pos = i
                break
        lines.insert(insert_pos, f"| {service} | {field} | {value} |")
    return "\n".join(lines)


def verify_wechat(app_id, app_secret):
    url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={app_id}&secret={app_secret}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if "access_token" in data:
                return True, "✅ 微信公众号凭证有效"
            if "errcode" in data:
                return False, f"❌ 错误码 {data['errcode']}：{data.get('errmsg', '')}"
            return False, f"❌ 未知响应：{data}"
    except Exception as e:
        return False, f"❌ 连接失败：{e}"


def verify_image(api_key):
    try:
        req = urllib.request.Request(
            "https://api.runnode.cn/v1/models",
            headers={"Authorization": f"Bearer {api_key}"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if "data" in data:
                return True, "✅ runnode.cn 凭证有效"
            return False, f"❌ 未知响应：{data}"
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return False, f"❌ HTTP {e.code}：{body[:100]}"
    except Exception as e:
        return False, f"❌ 连接失败：{e}"


def main():
    results = []

    if APP_ID and APP_SECRET:
        ok, msg = verify_wechat(APP_ID, APP_SECRET)
        results.append(msg)
    else:
        results.append("⏭️ 跳过微信公众号验证（缺少 WECHAT_APP_ID / WECHAT_APP_SECRET）")

    if RUNNODE_KEY:
        ok, msg = verify_image(RUNNODE_KEY)
        results.append(msg)
    else:
        results.append("⏭️ 跳过 runnode.cn 验证（缺少 RUNNODE_API_KEY）")

    memory = load_memory()

    memory = update_credential(memory, "微信公众号", "AppID", APP_ID)
    memory = update_credential(memory, "微信公众号", "AppSecret", APP_SECRET)
    memory = update_credential(memory, "图像生成(首选)", "API Base", "https://api.runnode.cn/v1")
    memory = update_credential(memory, "图像生成(首选)", "API Key", RUNNODE_KEY)
    memory = update_credential(memory, "图像生成(首选)", "模型", "Qwen/Qwen-Image-2512")

    save_memory(memory)

    print("=" * 50)
    print("  公众号助手 - 配置结果")
    print("=" * 50)
    for r in results:
        print(f"  {r}")
    print("=" * 50)
    print(f"  ✅ 凭证已保存到：{MEMORY_PATH}")
    print("=" * 50)


if __name__ == "__main__":
    main()
