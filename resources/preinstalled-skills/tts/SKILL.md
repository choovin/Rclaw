---
name: Runnode_tts
description: >
  文字转语音（TTS）工具。使用 RunNode 平台 /v1/audio/speech 接口。
  触发词：text-to-speech、voice generation、语音合成、文字转语音，配音、朗读、TTS。
---

# TTS（文字转语音）

使用 RunNode 平台 `ST/audio/speech` 接口将文本转为音频，无需额外配置 API Key（自动读取 `~/.openclaw/openclaw.json`）。

---

## 快速使用

```bash
python <skill_path>/scripts/generate_tts.py --text "你好，欢迎使用语音合成服务" --output hello.mp3
```

---

## 参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--text`, `-t` | ✅ | — | 要合成的文本 |
| `--model`, `-m` | — | `runnode/Qwen3-TTS-1.7B` | 模型 ID |
| `--voice`, `-v` | — | `alloy` | 音色 ID |
| `--format`, `-f` | — | `mp3` | 音频格式：mp3 / wav / ogg / opus / aac / flac |
| `--speed`, `-s` | — | `1.0` | 语速（> 0） |
| `--output`, `-o` | — | 自动生成 | 输出文件路径 |

---

## 可用音色（voice）

| voice_id | 风格 |
|----------|------|
| `alloy` | 中性质感（默认） |
| `echo` | 回声感 |
| `fable` | 叙事感 |
| `onyx` | 低沉男声 |
| `nova` | 清亮女声 |
| `shimmer` | 柔和女声 |
| `ash` | 沉稳中性 |
| `ballad` | 抒情男声 |
| `coral` | 活泼女声 |
| `floyd` | 电子男声 |
| `sage` | 知性女声 |

---

## 工作流程

1. `POST /v1/audio/speech` — 提交 TTS 任务，获取 `newapi_task_id`
2. `GET /api/runnode/task/self` — 轮询任务状态（每 5 秒）
3. `status == 2` 时，`result_url` 包含音频下载链接
4. 下载音频文件并保存

---

## 使用示例

```bash
# 基础用法
python <skill_path>/scripts/generate_tts.py -t "今天天气真好" -o greeting.mp3

# 指定音色和语速
python <skill_path>/scripts/generate_tts.py -t "欢迎收听今天的科技资讯" -v nova -s 1.2 -o news.mp3

# WAV 格式
python <skill_path>/scripts/generate_tts.py -t "音频演示" -f wav -o demo.wav
```

---

## 输出处理

脚本成功后会打印：
```
Audio saved: D:\path\to\output.mp3 (82010 bytes)

MEDIA:D:\path\to\output.mp3
```

**Agent 必须**：解析 `MEDIA:` 行，提取文件路径告知用户。
