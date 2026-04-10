---
name: image-gen
description: AI 图片生成与编辑，支持文生图和图生图。
metadata:
  {
    "openclaw":
      {
        "emoji": "🍌",
        "requires": { "bins": ["python"] },
      },
  }
---

# AI 图片生成与编辑

通过内置 Python 脚本，调用 Doubao 图像 API 生成或编辑图片。



## 文生图

```bash
python {baseDir}/scripts/generate_image.py --prompt "画面描述" --filename "output.jpg" --resolution 2K
```

## 单图编辑

```bash
python {baseDir}/scripts/generate_image.py --prompt "编辑要求" --filename "output.jpg" -i "/path/in.png" --resolution 2K
```

## 多图融合

```bash
python {baseDir}/scripts/generate_image.py --prompt "融合要求" --filename "output.jpg" -i img1.png -i img2.png -i img3.png
```

## 指定比例（可选）

```bash
python {baseDir}/scripts/generate_image.py --prompt "竖版人像" --filename "output.jpg" --aspect-ratio 9:16
```

## 注意事项

- 输出格式固定为 **JPEG**，`--filename` 必须以 `.jpg` 或 `.jpeg` 结尾
- 分辨率：`2K`（默认）或 `3K`
- 支持的比例：`1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`9:16`、`16:9`、`21:9`
- 未指定 `--resolution` 时默认使用 `2K`
- 只记录保存路径，不读取图片内容

---

## 生图质量提升指南

好的提示词 = 主体 + 风格 + 光线 + 构图 + 细节修饰。**避免模糊词**（好看、漂亮），改用具体描述。

### Prompt 构建公式

```
[主体描述], [动作/状态], [场景环境], [风格], [光线], [构图], [质量修饰]
```

**示例**：
- 简单版：`一只橘猫坐在窗边`
- 优化版：`an orange tabby cat sitting on a windowsill, looking outside, warm afternoon sunlight, soft bokeh background, watercolor illustration style, highly detailed`

### 风格关键词

| 风格 | 关键词示例 |
|-----|-----------|
| 摄影写实 | `realistic photography, DSLR, 85mm lens, bokeh` |
| 电影感 | `cinematic, film grain, anamorphic lens, dramatic lighting` |
| 插画/水彩 | `watercolor illustration, soft edges, pastel colors` |
| 赛博朋克 | `cyberpunk, neon lights, rain-soaked streets, dark atmosphere` |
| 宫崎骏 | `Studio Ghibli style, warm colors, hand-drawn, whimsical` |
| 极简商业 | `minimalist, clean background, product photography, studio lighting` |

### 光线关键词

| 光线 | 关键词 |
|-----|--------|
| 黄金时刻 | `golden hour, warm sunlight, long shadows` |
| 柔和自然光 | `soft natural light, diffused, overcast` |
| 轮廓光 | `rim light, backlit, silhouette` |
| 体积光 | `volumetric light, god rays, fog` |
| 工作室光 | `studio lighting, softbox, catchlight` |

### 质量修饰词

可在 prompt 末尾添加以提升整体质量：

```
highly detailed, sharp focus, 8K resolution, professional photography, award-winning
```

### 图生图提示词技巧

- **描述变化**而非重复描述原图内容
- 明确保留部分：`keep the person, change the background to...`
- 风格迁移：`transform to oil painting style, preserve the composition`
- 局部编辑：`replace the sky with dramatic sunset clouds, keep everything else`

