---
name: canvas-design
description: Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations.
license: Complete terms in LICENSE.txt
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["python"] },
      },
  }
---

These are instructions for creating design philosophies - aesthetic movements that are then EXPRESSED VISUALLY via AI image generation. Output .md files and .jpg image files.

Complete this in two steps:
1. Design Philosophy Creation (.md file)
2. Express by generating it as an image using the bundled RunNode image generator

---

## IMAGE GENERATION SETUP

This skill uses the bundled RunNode Python script. No external API key needed — it reads credentials directly from the local RClaw config (`~/.openclaw/openclaw.json`).

### Prerequisites check (run once)

```bash
python -c "import PIL; print('ok')"
```

If the check fails, install dependencies:

```bash
python -m pip install pillow
```

### Generate command template

```bash
python {skillDir}/scripts/generate_image.py --prompt "your detailed visual prompt" --filename "output.png" --resolution 2K --aspect-ratio 3:4
```

- `{skillDir}` = `C:\Users\username\.openclaw\skills\canvas-design`
- Output format is **auto-detected** PNG or JPEG
- Resolutions: `2K` (default) or `3K`
- Aspect ratios: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `9:16`, `16:9`, `21:9`
- Image-to-image: pass `--input-image <ref.png>` (uses `/v1/images/edits`, primary: `runnode/flux-2-klein-9b`, fallback: `runnode/qwen_image_edit_2511_fp8mixed`)
- Text-to-image: omit `--input-image` (uses `/v1/images/generations`, model: `runnode/z_image_turbo_bf16`)
- Only report the saved path, **do not read the image content back**

---

## STEP 1 · DESIGN PHILOSOPHY CREATION

To begin, create a VISUAL PHILOSOPHY (not layouts or templates) that will be interpreted through:
- Form, space, color, composition
- Images, graphics, shapes, patterns
- Minimal text as visual accent

### THE CRITICAL UNDERSTANDING
- What is received: Some subtle input or instructions by the user that should be taken into account, but used as a foundation; it should not constrain creative freedom.
- What is created: A design philosophy/aesthetic movement.
- What happens next: The philosophy is translated into a rich image generation prompt and rendered via RunNode.

Consider this approach:
- Write a manifesto for an art movement
- The next phase turns that manifesto into a precise image prompt

The philosophy must emphasize: Visual expression. Spatial communication. Artistic interpretation. Minimal words.

### HOW TO GENERATE A VISUAL PHILOSOPHY

**Name the movement** (1-2 words): "Brutalist Joy" / "Chromatic Silence" / "Metabolist Dreams"

**Articulate the philosophy** (4-6 paragraphs - concise but complete):

To capture the VISUAL essence, express how the philosophy manifests through:
- Space and form
- Color and material
- Scale and rhythm
- Composition and balance
- Visual hierarchy

**CRITICAL GUIDELINES:**
- **Avoid redundancy**: Each design aspect should be mentioned once.
- **Emphasize craftsmanship REPEATEDLY**: The philosophy MUST stress multiple times that the final work should appear as though it took countless hours to create, was labored over with care, and comes from someone at the absolute top of their field. Repeat phrases like "meticulously crafted," "the product of deep expertise," "painstaking attention," "master-level execution."
- **Leave creative space**: Remain specific about the aesthetic direction, but concise enough that the image prompt has room to make interpretive choices at an extremely high level of craftsmanship.

The philosophy must guide the image to express ideas VISUALLY, not through text. Information lives in design, not paragraphs.

### PHILOSOPHY EXAMPLES

**"Concrete Poetry"**
Philosophy: Communication through monumental form and bold geometry.
Visual expression: Massive color blocks, sculptural typography (huge single words, tiny labels), Brutalist spatial divisions, Polish poster energy meets Le Corbusier.

**"Chromatic Language"**
Philosophy: Color as the primary information system.
Visual expression: Geometric precision where color zones create meaning. Think Josef Albers' interaction meets data visualization.

**"Analog Meditation"**
Philosophy: Quiet visual contemplation through texture and breathing room.
Visual expression: Paper grain, ink bleeds, vast negative space. Japanese photobook aesthetic.

*These are condensed examples. The actual design philosophy should be 4-6 substantial paragraphs.*

Output the design philosophy as a `.md` file before proceeding.

---

## STEP 2 · IMAGE PROMPT CONSTRUCTION

### DEDUCING THE SUBTLE REFERENCE

**CRITICAL STEP**: Before generating the image, identify the subtle conceptual thread from the original request.

The topic is a **subtle, niche reference embedded within the art itself** — not always literal, always sophisticated. Someone familiar with the subject should feel it intuitively, while others simply experience a masterful abstract composition. Think like a jazz musician quoting another song — only those who know will catch it, but everyone appreciates the music.

### TRANSLATING PHILOSOPHY → IMAGE PROMPT

Construct a rich, detailed image generation prompt from the design philosophy. The prompt must:

1. **Describe visual elements concretely**: colors (use specific hex-like descriptions or named tones), shapes, textures, composition layout, lighting, atmosphere
2. **Specify art style**: e.g., "photorealistic fine art print", "high-contrast editorial photography", "geometric abstract illustration", "brutalist poster design"
3. **Include craftsmanship language**: "museum quality", "studio lighting", "meticulously composed", "master-level execution", "award-winning design"
4. **Reference the subtle conceptual thread**: weave the deduced reference into visual metaphors without stating it literally
5. **Specify typography handling**: since RunNode image models render text as part of the image, either (a) request minimal/no text, or (b) specify exact short phrases to render as visual elements integrated into the composition
6. **Available local fonts for reference** (use these names in your prompt as stylistic descriptors if helpful): Crimson Pro, IBM Plex Mono, Work Sans, Lora, Gloock, Italiana, Jura, Boldonse, Outfit, GeistMono

**Prompt structure template:**
```
[Art movement / style descriptor]. [Primary composition description]. [Color palette with specific tones]. 
[Key visual elements and their spatial arrangement]. [Texture and material quality]. 
[Typography treatment if any — short phrases only]. [Lighting and atmosphere]. 
[Craftsmanship / quality descriptors]. [Aspect ratio / framing intent].
```

**Example prompt:**
```
Brutalist graphic design poster, high contrast editorial composition. Dominant field of deep indigo #0D1B2A 
occupying two thirds of the frame, intersected by a single razor-thin horizontal band of oxidized gold. 
Dense grid of precisely spaced small golden squares in the upper left quadrant, dissolving into isolated 
points toward the right edge — entropy as visual language. Paper grain texture overlay throughout. 
Minimal sans-serif text "t → ∞" anchored bottom center in platinum, 8pt scale. Dramatic directional 
lighting from upper left, deep shadow volumes. Museum quality print, painstakingly composed, 
master-level typographic restraint, award-winning design. Portrait 3:4 framing.
```

---

## STEP 3 · GENERATE THE IMAGE

Run the generate script with the constructed prompt:

```bash
python C:\Users\username\.openclaw\skills\canvas-design\scripts\generate_image.py \
  --prompt "<your constructed prompt here>" \
  --filename "<output-name>.png" \
  --resolution 2K \
  --aspect-ratio 3:4
```

Choose the aspect ratio to best suit the design intent:
- Portrait art / posters → `3:4` or `9:16`
- Landscape / panoramic → `16:9` or `21:9`
- Square / balanced → `1:1`

**After generation**: report the saved file path to the user. Do not read the image back.

---

## REFINEMENT PASS

**IMPORTANT**: After generating, the user has implicitly said: "It must be pristine, a masterpiece of craftsmanship, as if it were about to be displayed in a museum."

If a second pass is requested, refine the **prompt** — sharpen descriptors, add more specific material qualities, tighten the color palette, deepen the conceptual reference — then regenerate. Do not add unrelated elements; refine what the philosophy already defines.

---

## MULTI-IMAGE OPTION

When the user requests a series or multiple pages, generate additional images with:
- The same design philosophy as the aesthetic foundation
- Distinctly different compositions, viewpoints, or color variations
- A narrative or thematic arc across the series — like pages of a coffee table book

Use separate `--filename` calls for each image.

---

## ESSENTIAL PRINCIPLES
- **VISUAL PHILOSOPHY**: Create an aesthetic worldview, then express it through a precise image prompt
- **MINIMAL TEXT IN IMAGE**: Request sparse, essential-only text as visual elements — never lengthy copy
- **SPATIAL EXPRESSION**: Ideas communicate through space, form, color, composition — not paragraphs
- **SELF-CONTAINED**: All generation is done via the bundled script at `{skillDir}/scripts/generate_image.py` — no external skill dependency, no extra API key
- **EXPERT CRAFTSMANSHIP**: The final prompt must convey that the work is meticulously crafted, labored over with care, the product of countless hours by someone at the top of their field
