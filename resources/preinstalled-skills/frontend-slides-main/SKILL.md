---
name: frontend-slides
description: Generate HTML web-based presentations (single-file, browser-runnable). For online demos, animations, technical talks, output is .html NOT .pptx! Need traditional PPT? Use ppt-nano.
---

# Frontend Slides - HTML Web Presentation Generator

**⚠️ Important Scope Definition:**
- Generates **standalone HTML files** for web presentation, supports rich animations and online sharing.
- **NOT for PowerPoint (.pptx) files** — If user needs .pptx format → use `ppt-nano`
- **NOT for whiteboard/handwritten style** — For whiteboard aesthetics → use `ppt-nano`

**✅ Use `frontend-slides` when:**
- User wants **HTML web pages** (browser-runnable, shareable via link)
- User needs **rich animations**, CSS effects, or interactive elements
- User wants **online demos**, technical talks, or portfolio presentations
- Output format: `.html` file (single self-contained file)

**⚠️ Use `ppt-nano` when:**
- User explicitly requests **PowerPoint (.pptx) format**
- User wants **whiteboard/handwritten/marker style**
- User needs **offline editing** in PowerPoint/Keynote
- Output format: `.pptx` file

---

Create zero-dependency, animation-rich HTML presentations that run entirely in the browser.

## Core Principles

1. **Zero Dependencies** — Single HTML files with inline CSS/JS. No npm, no build tools.
2. **Show, Don't Tell** — Generate visual previews, not abstract choices. People discover what they want by seeing it.
3. **Distinctive Design** — No generic "AI slop." Every presentation must feel custom-crafted.
4. **Viewport Fitting (NON-NEGOTIABLE)** — Every slide MUST fit exactly within 100vh. No scrolling within slides, ever. Content overflows? Split into multiple slides.

## Design Aesthetics

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight.

Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Cliched color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!

## Viewport Fitting Rules

These invariants apply to EVERY slide in EVERY presentation:

- Every `.slide` must have `height: 100vh; height: 100dvh; overflow: hidden;`
- ALL font sizes and spacing must use `clamp(min, preferred, max)` — never fixed px/rem
- Content containers need `max-height` constraints
- Images: `max-height: min(50vh, 400px)`
- Breakpoints required for heights: 700px, 600px, 500px
- Include `prefers-reduced-motion` support
- Never negate CSS functions directly (`-clamp()`, `-min()`, `-max()` are silently ignored) — use `calc(-1 * clamp(...))` instead

**When generating, read `viewport-base.css` and include its full contents in every presentation.**

### Content Density Limits Per Slide

| Slide Type | Maximum Content | Target Viewport Usage |
|------------|-----------------|----------------------|
| Title slide | 1 heading + 1 subtitle + tagline + optional decorative elements | 50-60% |
| Content slide | 1 heading + **6-8 bullet points** OR 1 heading + **3-4 paragraphs** + optional callouts | 60-75% |
| Feature grid | 1 heading + **6-9 cards** maximum (2x3 or 3x3) + optional descriptions | 65-75% |
| Code slide | 1 heading + **12-15 lines** of code + optional annotations | 60-70% |
| Quote slide | 1 quote (max 4 lines) + attribution + optional context box | 45-55% |
| Image slide | 1 heading + 1 image (max 60vh height) + caption + optional annotation | 60-70% |

**Target: Aim for 60-75% viewport utilization with meaningful content.**

**Content exceeds limits? Split into multiple slides. Never cram, never scroll.**

---

## Phase 0: Detect Mode

Determine what the user wants:

- **Mode A: New Presentation** — Create from scratch. Go to Phase 1.
- **Mode B: PPT Conversion** — Convert a .pptx file. Go to Phase 4.
- **Mode C: Enhancement** — Improve an existing HTML presentation. Read it, understand it, enhance. **Follow Mode C modification rules below.**

### Mode C: Modification Rules

When enhancing existing presentations, viewport fitting is the biggest risk:

1. **Before adding content:** Count existing elements, check against density limits (6-8 bullets, 3-4 paragraphs)
2. **Adding images:** Must have `max-height: min(50vh, 400px)`. If slide already has max content, split into two slides
3. **Adding text:** Max 6-8 bullets per slide (or 3-4 paragraphs). Exceeds limits? Split into continuation slides
4. **Enhancing sparse slides:** If existing slide has <5 bullets, consider adding examples, context, or callouts to reach 60-75% viewport usage
5. **After ANY modification, verify:** `.slide` has `overflow: hidden`, new elements use `clamp()`, images have viewport-relative max-height, content fits at 1280x720
6. **Proactively reorganize:** If modifications will cause overflow, automatically split content and inform the user. Don't wait to be asked

**When adding images to existing slides:** Move image to new slide or reduce other content first. Never add images without checking if existing content already fills the viewport.

---

## Phase 1: Content Discovery (New Presentations)

**Ask ALL questions in a single AskUserQuestion call** so the user fills everything out at once:

**Question 1 — Purpose** (header: "Purpose"):
What is this presentation for? Options: Pitch deck / Teaching-Tutorial / Conference talk / Internal presentation

**Question 2 — Length** (header: "Length"):
Approximately how many slides? Options: Short 5-10 / Medium 10-20 / Long 20+

**Question 3 — Content** (header: "Content"):
Do you have content ready? Options: All content ready / Rough notes / Topic only

**Question 4 — Inline Editing** (header: "Editing"):
Do you need to edit text directly in the browser after generation? Options:
- "Yes (Recommended)" — Can edit text in-browser, auto-save to localStorage, export file
- "No" — Presentation only, keeps file smaller

**Remember the user's editing choice — it determines whether edit-related code is included in Phase 3.**

If user has content, ask them to share it.

### Step 1.2: Image Evaluation (if images provided)

If user selected "No images" → skip to Phase 2.

If user provides an image folder:
1. **Scan** — List all image files (.png, .jpg, .svg, .webp, etc.)
2. **View each image** — Use the Read tool (Claude is multimodal)
3. **Evaluate** — For each: what it shows, USABLE or NOT USABLE (with reason), what concept it represents, dominant colors
4. **Co-design the outline** — Curated images inform slide structure alongside text. This is NOT "plan slides then add images" — design around both from the start (e.g., 3 screenshots → 3 feature slides, 1 logo → title/closing slide)
5. **Confirm via AskUserQuestion** (header: "Outline"): "Does this slide outline and image selection look right?" Options: Looks good / Adjust images / Adjust outline

**Logo in previews:** If a usable logo was identified, embed it (base64) into each style preview in Phase 2 — the user sees their brand styled three different ways.

---

## Phase 2: Style Discovery

**This is the "show, don't tell" phase.** Most people can't articulate design preferences in words.

### Step 2.0: Style Path

Ask how they want to choose (header: "Style"):
- "Show me options" (recommended) — Generate 3 previews based on mood
- "I know what I want" — Pick from preset list directly

**If direct selection:** Show preset picker and skip to Phase 3. Available presets are defined in [STYLE_PRESETS.md](STYLE_PRESETS.md).

### Step 2.1: Mood Selection (Guided Discovery)

Ask (header: "Vibe", multiSelect: true, max 2):
What feeling should the audience have? Options:
- Impressed/Confident — Professional, trustworthy
- Excited/Energized — Innovative, bold
- Calm/Focused — Clear, thoughtful
- Inspired/Moved — Emotional, memorable

### Step 2.2: Generate 3 Style Previews

Based on mood, generate 3 distinct single-slide HTML previews showing typography, colors, animation, and overall aesthetic. Read [STYLE_PRESETS.md](STYLE_PRESETS.md) for available presets and their specifications.

| Mood | Suggested Presets |
|------|-------------------|
| Impressed/Confident | Bold Signal, Electric Studio, Dark Botanical |
| Excited/Energized | Creative Voltage, Neon Cyber, Split Pastel |
| Calm/Focused | Notebook Tabs, Paper & Ink, Swiss Modern |
| Inspired/Moved | Dark Botanical, Vintage Editorial, Pastel Geometry |

Save previews to `.claude-design/slide-previews/` (style-a.html, style-b.html, style-c.html). Each should be self-contained, ~50-100 lines, showing one animated title slide.

Open each preview automatically for the user.

### Step 2.3: User Picks

Ask (header: "Style"):
Which style preview do you prefer? Options: Style A: [Name] / Style B: [Name] / Style C: [Name] / Mix elements

If "Mix elements", ask for specifics.

---

## Content Richness Guidelines

**Viewport Utilization Target: 60-75% for most slides**

Every slide should feel substantial and information-rich without being cramped. Apply these techniques:

### 1. Visual Information Hierarchy

Use color coding and typography to layer information:

- **Primary content** (main heading, key points): Dominant color, largest font
- **Supporting details** (sub-points, examples): Accent color, medium font
- **Annotations** (tips, context, notes): Muted color, smaller font
- **Emphasis** (key words, numbers, CTAs): Highlight color or bold

**Example structure:**
```
Main Heading (large, primary color)
├─ Key Point 1 (medium, primary color)
│  └─ Supporting detail (small, accent color)
├─ Key Point 2 with inline stat: +250% ← (highlight)
│  └─ Example: "..." (small, muted color)
└─ Pro Tip: ... (callout box, accent background)
```

### 2. Multi-Element Slide Composition

Don't limit slides to just text. Combine multiple elements:

**Rich Content Slide Template:**
- Main heading
- 6-8 bullet points (can include sub-bullets)
- 1-2 statistical callouts (large numbers in corners/sidebar)
- Optional: Mini icon/visual next to heading
- Optional: "Key Takeaway" box at bottom

**Feature Grid Enhancement:**
- Each card: Icon + Title + 2-3 line description (not just icon + title)
- Add subtle connecting lines or background shapes
- Include a summary statement below the grid

### 3. Content Expansion Techniques

When creating content, actively expand with:

- **Examples**: After stating a principle, give 1-2 concrete examples
- **Context**: Add "Why this matters" or "Common mistake" boxes
- **Comparisons**: Before/After, Good/Bad, Old/New side-by-sides
- **Data points**: Include relevant statistics, percentages, timeframes
- **Action items**: End slides with "Next Steps" or "How to Apply"

**Before (sparse):**
```
Benefits
- Fast
- Secure
- Easy
```

**After (rich):**
```
Key Benefits
- ⚡ Lightning Fast: 10x faster than competitors (avg. 2ms response)
  → Perfect for real-time applications
- 🔒 Bank-Grade Security: AES-256 encryption + 2FA
  → Trusted by Fortune 500 companies
- 🎯 Intuitive UX: 5-minute setup, zero coding required
  → 98% user satisfaction rating

💡 Pro Tip: Combine all three for maximum impact
```

### 4. Efficient Layouts for Dense Content

Use space wisely with structured layouts:

- **Two-column layouts**: Main content left, annotations/examples right
- **Sidebar annotations**: Timeline or step numbers in left margin
- **Corner statistics**: Large numbers in top-right or bottom-left corners
- **Bottom summary bar**: Key takeaway in a colored strip
- **Grid layouts**: 2x2 or 2x3 for comparing multiple items

### 5. CSS-Generated Visual Interest

Add depth without adding content:

- **Background patterns**: Subtle dots, lines, or gradients (don't count against density)
- **Decorative shapes**: Circles, triangles, or rectangles as visual anchors
- **Section dividers**: Horizontal lines with icons
- **Badges and pills**: Small labeled containers for tags/categories
- **Progress indicators**: Step counters (1/5, 2/5, etc.)

**Important**: Decorative elements should enhance, not distract. They create visual structure that allows MORE content to feel organized rather than cluttered.

### 6. Slide-Specific Density Guidelines

Adjust density based on slide purpose:

| Slide Type | Content Approach |
|------------|------------------|
| **Title/Intro** | 50-60% usage: Clean and impactful, add tagline + decorative elements |
| **Content/Teaching** | 65-75% usage: Rich with examples, sub-points, and callouts |
| **Data/Stats** | 70-80% usage: Multiple metrics, charts (CSS-based), comparisons |
| **Process/Flow** | 60-70% usage: Steps with descriptions, not just labels |
| **Summary/CTA** | 55-65% usage: Key points + next actions, memorable closing |

### 7. Viewport Filling Checklist

Before finalizing a slide, verify:

- [ ] Does this slide use 60-75% of available viewport height?
- [ ] Can I add context, examples, or data without overcrowding?
- [ ] Are there empty corners/edges that could hold callouts or decorations?
- [ ] Does the slide balance information density with visual breathing room?
- [ ] Would a viewer feel this slide is "complete" or does it feel sparse?

**If a slide feels sparse:** Add examples, context boxes, statistics, or visual elements.
**If a slide overflows:** Split into two slides with clear continuation ("Part 1 of 2").

---

## Phase 3: Generate Presentation

Generate the full presentation using content from Phase 1 (text, or text + curated images) and style from Phase 2.

**Apply Content Richness Guidelines**: Actively use the expansion techniques above to create substantial, information-rich slides that meet the 60-75% viewport utilization target.

If images were provided, the slide outline already incorporates them from Step 1.2. If not, CSS-generated visuals (gradients, shapes, patterns) provide visual interest — this is a fully supported first-class path.

**Before generating, read these supporting files:**
- [html-template.md](html-template.md) — HTML architecture and JS features
- [viewport-base.css](viewport-base.css) — Mandatory CSS (include in full)
- [animation-patterns.md](animation-patterns.md) — Animation reference for the chosen feeling

**Key requirements:**
- Single self-contained HTML file, all CSS/JS inline
- Include the FULL contents of viewport-base.css in the `<style>` block
- Use fonts from Fontshare or Google Fonts — never system fonts
- Add detailed comments explaining each section
- Every section needs a clear `/* === SECTION NAME === */` comment block

---

## Phase 4: PPT Conversion

When converting PowerPoint files:

1. **Extract content** — Run `python scripts/extract-pptx.py <input.pptx> <output_dir>` (install python-pptx if needed: `pip install python-pptx`)
2. **Confirm with user** — Present extracted slide titles, content summaries, and image counts
3. **Style selection** — Proceed to Phase 2 for style discovery
4. **Generate HTML** — Convert to chosen style, preserving all text, images (from assets/), slide order, and speaker notes (as HTML comments)

---

## Phase 5: Delivery

1. **Clean up** — Delete `.claude-design/slide-previews/` if it exists
2. **Open** — Use `open [filename].html` to launch in browser
3. **Summarize** — Tell the user:
   - File location, style name, slide count
   - Navigation: Arrow keys, Space, scroll/swipe, click nav dots
   - How to customize: `:root` CSS variables for colors, font link for typography, `.reveal` class for animations
   - If inline editing was enabled: Hover top-left corner or press E to enter edit mode, click any text to edit, Ctrl+S to save

---

## Supporting Files

| File | Purpose | When to Read |
|------|---------|-------------|
| [STYLE_PRESETS.md](STYLE_PRESETS.md) | 12 curated visual presets with colors, fonts, and signature elements | Phase 2 (style selection) |
| [viewport-base.css](viewport-base.css) | Mandatory responsive CSS — copy into every presentation | Phase 3 (generation) |
| [html-template.md](html-template.md) | HTML structure, JS features, code quality standards | Phase 3 (generation) |
| [animation-patterns.md](animation-patterns.md) | CSS/JS animation snippets and effect-to-feeling guide | Phase 3 (generation) |
| [scripts/extract-pptx.py](scripts/extract-pptx.py) | Python script for PPT content extraction | Phase 4 (conversion) |
