# Style Presets Reference

Curated visual styles for Frontend Slides. Each preset is inspired by real design references — no generic "AI slop" aesthetics. **Abstract shapes only — no illustrations.**

**Viewport CSS:** For mandatory base styles, see [viewport-base.css](viewport-base.css). Include in every presentation.

---

## Dark Themes

### 1. Bold Signal

**Vibe:** Confident, bold, modern, high-impact

**Layout:** Colored card on dark gradient. Number top-left, navigation top-right, title bottom-left.

**Typography:**
- Display: `Archivo Black` (900)
- Body: `Space Grotesk` (400/500)

**Colors:**
```css
:root {
    --bg-primary: #1a1a1a;
    --bg-gradient: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
    --card-bg: #FF5722;
    --text-primary: #ffffff;
    --text-on-card: #1a1a1a;
}
```

**Signature Elements:**
- Bold colored card as focal point (orange, coral, or vibrant accent)
- Large section numbers (01, 02, etc.)
- Navigation breadcrumbs with active/inactive opacity states
- Grid-based layout for precise alignment

---

### 2. Electric Studio

**Vibe:** Bold, clean, professional, high contrast

**Layout:** Split panel—white top, blue bottom. Brand marks in corners.

**Typography:**
- Display: `Manrope` (800)
- Body: `Manrope` (400/500)

**Colors:**
```css
:root {
    --bg-dark: #0a0a0a;
    --bg-white: #ffffff;
    --accent-blue: #4361ee;
    --text-dark: #0a0a0a;
    --text-light: #ffffff;
}
```

**Signature Elements:**
- Two-panel vertical split
- Accent bar on panel edge
- Quote typography as hero element
- Minimal, confident spacing

---

### 3. Creative Voltage

**Vibe:** Bold, creative, energetic, retro-modern

**Layout:** Split panels—electric blue left, dark right. Script accents.

**Typography:**
- Display: `Syne` (700/800)
- Mono: `Space Mono` (400/700)

**Colors:**
```css
:root {
    --bg-primary: #0066ff;
    --bg-dark: #1a1a2e;
    --accent-neon: #d4ff00;
    --text-light: #ffffff;
}
```

**Signature Elements:**
- Electric blue + neon yellow contrast
- Halftone texture patterns
- Neon badges/callouts
- Script typography for creative flair

---

### 4. Dark Botanical

**Vibe:** Elegant, sophisticated, artistic, premium

**Layout:** Centered content on dark. Abstract soft shapes in corner.

**Typography:**
- Display: `Cormorant` (400/600) — elegant serif
- Body: `IBM Plex Sans` (300/400)

**Colors:**
```css
:root {
    --bg-primary: #0f0f0f;
    --text-primary: #e8e4df;
    --text-secondary: #9a9590;
    --accent-warm: #d4a574;
    --accent-pink: #e8b4b8;
    --accent-gold: #c9b896;
}
```

**Signature Elements:**
- Abstract soft gradient circles (blurred, overlapping)
- Warm color accents (pink, gold, terracotta)
- Thin vertical accent lines
- Italic signature typography
- **No illustrations—only abstract CSS shapes**

---

## Light Themes

### 5. Notebook Tabs

**Vibe:** Editorial, organized, elegant, tactile

**Layout:** Cream paper card on dark background. Colorful tabs on right edge.

**Typography:**
- Display: `Bodoni Moda` (400/700) — classic editorial
- Body: `DM Sans` (400/500)

**Colors:**
```css
:root {
    --bg-outer: #2d2d2d;
    --bg-page: #f8f6f1;
    --text-primary: #1a1a1a;
    --tab-1: #98d4bb; /* Mint */
    --tab-2: #c7b8ea; /* Lavender */
    --tab-3: #f4b8c5; /* Pink */
    --tab-4: #a8d8ea; /* Sky */
    --tab-5: #ffe6a7; /* Cream */
}
```

**Signature Elements:**
- Paper container with subtle shadow
- Colorful section tabs on right edge (vertical text)
- Binder hole decorations on left
- Tab text must scale with viewport: `font-size: clamp(0.5rem, 1vh, 0.7rem)`

---

### 6. Pastel Geometry

**Vibe:** Friendly, organized, modern, approachable

**Layout:** White card on pastel background. Vertical pills on right edge.

**Typography:**
- Display: `Plus Jakarta Sans` (700/800)
- Body: `Plus Jakarta Sans` (400/500)

**Colors:**
```css
:root {
    --bg-primary: #c8d9e6;
    --card-bg: #faf9f7;
    --pill-pink: #f0b4d4;
    --pill-mint: #a8d4c4;
    --pill-sage: #5a7c6a;
    --pill-lavender: #9b8dc4;
    --pill-violet: #7c6aad;
}
```

**Signature Elements:**
- Rounded card with soft shadow
- **Vertical pills on right edge** with varying heights (like tabs)
- Consistent pill width, heights: short → medium → tall → medium → short
- Download/action icon in corner

---

### 7. Split Pastel

**Vibe:** Playful, modern, friendly, creative

**Layout:** Two-color vertical split (peach left, lavender right).

**Typography:**
- Display: `Outfit` (700/800)
- Body: `Outfit` (400/500)

**Colors:**
```css
:root {
    --bg-peach: #f5e6dc;
    --bg-lavender: #e4dff0;
    --text-dark: #1a1a1a;
    --badge-mint: #c8f0d8;
    --badge-yellow: #f0f0c8;
    --badge-pink: #f0d4e0;
}
```

**Signature Elements:**
- Split background colors
- Playful badge pills with icons
- Grid pattern overlay on right panel
- Rounded CTA buttons

---

### 8. Vintage Editorial

**Vibe:** Witty, confident, editorial, personality-driven

**Layout:** Centered content on cream. Abstract geometric shapes as accent.

**Typography:**
- Display: `Fraunces` (700/900) — distinctive serif
- Body: `Work Sans` (400/500)

**Colors:**
```css
:root {
    --bg-cream: #f5f3ee;
    --text-primary: #1a1a1a;
    --text-secondary: #555;
    --accent-warm: #e8d4c0;
}
```

**Signature Elements:**
- Abstract geometric shapes (circle outline + line + dot)
- Bold bordered CTA boxes
- Witty, conversational copy style
- **No illustrations—only geometric CSS shapes**

---

## Specialty Themes

### 9. Neon Cyber

**Vibe:** Futuristic, techy, confident

**Typography:** `Clash Display` + `Satoshi` (Fontshare)

**Colors:** Deep navy (#0a0f1c), cyan accent (#00ffcc), magenta (#ff00aa)

**Signature:** Particle backgrounds, neon glow, grid patterns

---

### 10. Terminal Green

**Vibe:** Developer-focused, hacker aesthetic

**Typography:** `JetBrains Mono` (monospace only)

**Colors:** GitHub dark (#0d1117), terminal green (#39d353)

**Signature:** Scan lines, blinking cursor, code syntax styling

---

### 11. Swiss Modern

**Vibe:** Clean, precise, Bauhaus-inspired

**Typography:** `Archivo` (800) + `Nunito` (400)

**Colors:** Pure white, pure black, red accent (#ff3300)

**Signature:** Visible grid, asymmetric layouts, geometric shapes

---

### 12. Paper & Ink

**Vibe:** Editorial, literary, thoughtful

**Typography:** `Cormorant Garamond` + `Source Serif 4`

**Colors:** Warm cream (#faf9f7), charcoal (#1a1a1a), crimson accent (#c41e3a)

**Signature:** Drop caps, pull quotes, elegant horizontal rules

---

## Industry Themes

### 13. Finance Pro

**Vibe:** Professional, trustworthy, data-driven, corporate

**Layout:** Dark navy canvas with golden ratio grid. Financial data visualizations as decorative elements. Content in structured columns.

**Typography:**
- Display: `Playfair Display` (700/800) — authoritative serif
- Body: `Inter` (400/500) — readable, professional
- Numbers: `IBM Plex Mono` (500) — tabular figures for data

**Colors:**
```css
:root {
    --bg-primary: #0a1628;
    --bg-secondary: #132744;
    --accent-gold: #d4af37;
    --accent-blue: #2962ff;
    --text-primary: #ffffff;
    --text-secondary: #8b9dc3;
    --chart-green: #00c853;
    --chart-red: #ff1744;
    --grid-line: rgba(212, 175, 55, 0.1);
}
```

**Signature Elements:**
- Golden ratio overlay grid (visible or subtle)
- Stock ticker-style animated numbers
- Minimalist bar chart/line graph decorations (CSS-only, no canvas)
- Thin gold accent lines separating sections
- Data callout boxes with monospace numbers
- Corner "market indicators" (decorative elements showing +/- with arrows)
- Conservative animations: fade-in only, no bounce or rotation
- **Financial iconography**: upward arrows, pie segment arcs (pure CSS shapes)

**Layout Pattern:**
```
┌────────────────────────────────┐
│ [LOGO]              Q4 2024 ↗ │ ← Header with indicator
├────────────────────────────────┤
│                                │
│   MAIN TITLE                   │
│   Subtitle with data: +23.4%   │ ← Hero with number
│                                │
│   [Mini Chart ▁▃▅▇]           │ ← CSS bar chart decoration
│                                │
└────────────────────────────────┘
```

---

### 14. Startup Energy

**Vibe:** Innovative, bold, optimistic, dynamic

**Layout:** Asymmetric layout with vibrant gradient backgrounds. Diagonal accent elements. Content with energy and movement.

**Typography:**
- Display: `Poppins` (700/800/900) — modern, geometric, bold
- Body: `Inter` (400/500) — clean, readable
- Accent: `Space Grotesk` (600) — for callouts and stats

**Colors:**
```css
:root {
    --bg-gradient-start: #6a11cb;
    --bg-gradient-end: #2575fc;
    --bg-gradient: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
    --accent-cyan: #00f5ff;
    --accent-lime: #c0ff00;
    --accent-coral: #ff6b6b;
    --text-primary: #ffffff;
    --text-muted: rgba(255, 255, 255, 0.7);
    --glow-cyan: rgba(0, 245, 255, 0.4);
}
```

**Signature Elements:**
- Diagonal gradient backgrounds (45deg angle)
- Neon glow effects on key elements (cyan/lime)
- Animated gradient shift on hover/reveal
- Bold oversized numbers for stats (200%+ font size)
- Asymmetric content blocks with tilted containers
- "Rocket emoji" or upward arrow motifs (CSS shapes, not images)
- Particle dots scattered as decoration (CSS radial-gradient)
- Energetic entrance animations: slide + fade + slight rotation
- Corner "badge" elements (NEW, BETA, v2.0 style callouts)

**Layout Pattern:**
```
┌────────────────────────────────┐
│  ╱╱╱ GRADIENT OVERLAY          │
│ ╱╱╱                            │
│╱ BOLD TITLE                    │
│  Subtitle here                 │
│                                │
│     [STAT BLOCK]    [BADGE]    │ ← Asymmetric placement
│     +300%           🚀NEW      │
└────────────────────────────────┘
```

---

### 15. Healthcare Trust

**Vibe:** Trustworthy, clean, caring, approachable

**Layout:** Clean white canvas with medical blue accents. Soft rounded containers. Heart rate line as decorative element.

**Typography:**
- Display: `Quicksand` (600/700) — friendly, rounded
- Body: `Open Sans` (400/500) — highly readable, medical standard
- Accent: `Red Hat Display` (500) — modern sans for callouts

**Colors:**
```css
:root {
    --bg-primary: #ffffff;
    --bg-light: #f8fafb;
    --accent-blue: #2196f3;
    --accent-teal: #00bcd4;
    --accent-green: #4caf50;
    --text-primary: #1a1a1a;
    --text-secondary: #5a6c7d;
    --soft-shadow: rgba(33, 150, 243, 0.1);
    --pulse-line: #00bcd4;
}
```

**Signature Elements:**
- Heartbeat/pulse line decoration (CSS-animated SVG path)
- Soft rounded cards with gentle shadows
- Plus symbol (+) motifs in corners
- Pill-shaped badges for categories
- Gradient blue accents (light to deep)
- Cross/medical iconography (pure CSS shapes)
- Circular progress indicators (CSS conic-gradient)
- Gentle breathing animation on key elements
- **Color psychology**: blues (trust), greens (health), white (cleanliness)

**Layout Pattern:**
```
┌────────────────────────────────┐
│ +              ~~~~ ← Pulse    │
│                                │
│   TITLE                        │
│   Healthcare Subtitle          │
│                                │
│   [○ Stat] [○ Stat] [○ Stat] │ ← Circular badges
│                                │
└────────────────────────────────┘
```

---

### 16. Education Clear

**Vibe:** Friendly, organized, encouraging, progressive

**Layout:** Multi-color sidebar navigation. Whiteboard aesthetic. Step-by-step visual hierarchy.

**Typography:**
- Display: `Nunito` (700/800) — friendly, educational
- Body: `Lato` (400/500) — clean, highly legible
- Headings: `Baloo 2` (600) — playful, approachable

**Colors:**
```css
:root {
    --bg-primary: #ffffff;
    --bg-board: #f5f7fa;
    --accent-blue: #4a90e2;
    --accent-orange: #f39c12;
    --accent-green: #27ae60;
    --accent-purple: #9b59b6;
    --text-primary: #2c3e50;
    --text-muted: #7f8c8d;
    --step-bg: #ecf0f1;
    --highlight-yellow: #fff9c4;
}
```

**Signature Elements:**
- Numbered step indicators (1, 2, 3 in colored circles)
- Highlighter marker effect (yellow background on key text)
- Sticky note decorations (CSS-rotated squares)
- Progress bar showing lesson advancement
- Colorful sidebar tabs (blue/orange/green/purple sections)
- Checkmark bullets (CSS unicode ✓)
- Notebook line decoration (horizontal ruled lines)
- Pencil/pen icon accents
- **Educational UX**: clear hierarchy, visual progression, encouraging colors

**Layout Pattern:**
```
┌──┬───────────────────────────┐
│1 │ LESSON TITLE              │
│2 │                           │
│3 │ Content with ✓ bullets   │
│  │                           │
│  │ ▓▓▓▓▓░░░░ 50% Progress   │
└──┴───────────────────────────┘
```

---

### 17. Tech Product

**Vibe:** Cutting-edge, sleek, futuristic, innovative

**Layout:** Dark interface with glowing accents. Grid system. Terminal-inspired elements.

**Typography:**
- Display: `Orbitron` (700/900) — futuristic, tech
- Body: `Exo 2` (400/500) — modern, geometric
- Code: `Fira Code` (400) — ligatures, tech aesthetic

**Colors:**
```css
:root {
    --bg-primary: #0f0f23;
    --bg-secondary: #1a1a2e;
    --accent-cyan: #00d9ff;
    --accent-magenta: #ff0080;
    --accent-purple: #8b5cf6;
    --text-primary: #e0e0e0;
    --text-dim: #6b7280;
    --glow-cyan: rgba(0, 217, 255, 0.5);
    --grid-line: rgba(139, 92, 246, 0.15);
}
```

**Signature Elements:**
- Holographic gradient borders (cyan/magenta shift)
- Grid overlay with perspective depth
- Glowing neon accents on hover
- Terminal cursor blink animation
- Hexagonal container shapes
- Scan line animation across screen
- Data stream effect (falling numbers, Matrix-style)
- Futuristic UI panels with transparency
- **Tech motifs**: circuit patterns, binary code backgrounds, hologram effects

**Layout Pattern:**
```
┌────────────────────────────────┐
│ ╔═══════════════════╗          │
│ ║ TITLE_           ║ ← Cursor │
│ ║ Product v2.0     ║          │
│ ╚═══════════════════╝          │
│                                │
│ [HEX]  [HEX]  [HEX]           │
└────────────────────────────────┘
```

---

### 18. Creative Agency

**Vibe:** Bold, artistic, unconventional, portfolio-ready

**Layout:** Asymmetric chaos with intention. Overlapping elements. Magazine editorial style.

**Typography:**
- Display: `Bebas Neue` (400) — impact, all-caps power
- Body: `Raleway` (400/600) — elegant, versatile
- Accent: `Playfair Display` (400 italic) — editorial flair

**Colors:**
```css
:root {
    --bg-primary: #fafafa;
    --bg-dark: #1a1a1a;
    --accent-red: #e74c3c;
    --accent-yellow: #f1c40f;
    --accent-blue: #3498db;
    --text-primary: #1a1a1a;
    --text-inverse: #ffffff;
    --overlay-opacity: rgba(26, 26, 26, 0.85);
}
```

**Signature Elements:**
- Text rotated at various angles (-5°, +3°, -8°)
- Color block overlays (semi-transparent red/yellow/blue)
- Torn paper edge effects (clip-path)
- Magazine cutout aesthetic
- Large oversized initials/numbers
- Ink splatter decorations (CSS shapes)
- Asymmetric image placements
- Bold underline/strikethrough accents
- **Design rebellion**: intentional rule-breaking, creative chaos

**Layout Pattern:**
```
   ╔════════╗
   ║ BIG    ║
╔══╝ BOLD   ╚══╗
║   CREATIVE   ║
║  -agency-    ║
╚══╗        ╔══╝
   ╚════════╝
```

---

## Cultural Themes

### 19. Japanese Zen

**Vibe:** Calm, minimal, balanced, contemplative

**Layout:** Asymmetric yet balanced. Generous whitespace. Vertical text elements. Nature-inspired subtle accents.

**Typography:**
- Display: `Noto Serif JP` (400/600) — elegant, Japanese aesthetic
- Body: `Noto Sans JP` (300/400) — light, readable
- Accent: `Crimson Pro` (400/600) — for English accents

**Colors:**
```css
:root {
    --bg-primary: #faf9f6;
    --bg-paper: #f5f2ed;
    --text-primary: #2c2c2c;
    --text-secondary: #6b6b6b;
    --accent-ink: #1a1a1a;
    --accent-red: #c1554a;
    --accent-gold: #d4a574;
    --natural-green: #8b9f87;
    --border-subtle: rgba(44, 44, 44, 0.08);
}
```

**Signature Elements:**
- Thin vertical line accent on left or right (brush stroke style)
- Circle/ensō motifs (incomplete circles, brush-like CSS borders)
- Haiku-like text placement (short lines, vertical rhythm)
- Wabi-sabi imperfection: slight asymmetry, organic spacing
- Subtle paper texture (noise overlay via CSS filter or SVG)
- Minimal color accents (single red stamp-like element)
- Generous negative space (60%+ whitespace)
- Slow, gentle fade-in animations only
- No shadows, no gradients (flat aesthetic)
- Optional: vertical text for slide numbers (writing-mode: vertical-rl)

**Layout Pattern:**
```
┌────────────────────────────────┐
│ ┃                              │ ← Thin vertical accent
│ ┃                              │
│ ┃   Title Here                 │
│ ┃                              │
│ ┃   Brief                      │
│ ┃   poetic                     │
│ ┃   content                    │
│ ┃                              │
│ ┃              [○]  ← Ensō     │
└────────────────────────────────┘
```

---

### 20. Nordic Minimal

**Vibe:** Hygge, functional, warm minimalism, Scandinavian

**Layout:** Generous whitespace. Natural wood texture accents. Left-aligned asymmetry.

**Typography:**
- Display: `Commissioner` (600/700) — geometric, Nordic
- Body: `Karla` (400/500) — friendly, readable
- Accent: `Barlow` (500) — simple, functional

**Colors:**
```css
:root {
    --bg-white: #fcfcfc;
    --bg-warm: #f7f5f2;
    --text-primary: #2b2b2b;
    --text-secondary: #7a7a7a;
    --accent-sage: #a4b8a4;
    --accent-terracotta: #c97d60;
    --wood-brown: #8b7355;
    --snow-white: #fefefe;
    --soft-shadow: rgba(43, 43, 43, 0.08);
}
```

**Signature Elements:**
- Wood grain texture overlay (subtle, warm tones)
- Simple line drawings (plant, lamp, chair motifs - CSS outline)
- Horizontal divider lines (thin, elegant)
- Circle and square geometric compositions
- Muted color palette (greens, terracotta, neutrals)
- Ample breathing room (40-50% whitespace minimum)
- Functional grid with visible structure
- **Hygge aesthetics**: cozy, simple, functional, natural materials

**Layout Pattern:**
```
┌────────────────────────────────┐
│                                │
│  TITLE                         │
│  ________________              │
│                                │
│  Subtitle text                 │
│                                │
│     ◯    ▭   Simple shapes    │
│                                │
│                                │
└────────────────────────────────┘
```

---

### 21. Art Deco Luxury

**Vibe:** Opulent, geometric, 1920s glamour, sophisticated

**Layout:** Symmetrical compositions. Chevron patterns. Gold metallic accents.

**Typography:**
- Display: `Cinzel` (700/900) — classic, luxurious serif
- Body: `Montserrat` (400/500) — geometric, elegant
- Accent: `Libre Baskerville` (700) — refined

**Colors:**
```css
:root {
    --bg-black: #0d0d0d;
    --bg-navy: #1a1f2e;
    --gold-primary: #d4af37;
    --gold-light: #f4e4c1;
    --champagne: #f7e7ce;
    --text-light: #f5f5f5;
    --text-gold: #d4af37;
    --accent-teal: #008b8b;
    --metallic-gradient: linear-gradient(135deg, #d4af37 0%, #f4e4c1 50%, #d4af37 100%);
}
```

**Signature Elements:**
- Geometric chevron/zigzag patterns (CSS borders)
- Sunburst ray decorations emanating from corners
- Symmetrical fan shapes (art deco hallmark)
- Metallic gold gradient text effects
- Stepped/tiered border designs
- Octagonal and hexagonal frames
- Vertical column dividers with capitals
- Egyptian-inspired geometric motifs
- **1920s glamour**: luxury, symmetry, geometric precision, gold accents

**Layout Pattern:**
```
     ╱╲╱╲╱╲ ← Zigzag pattern
   ╱        ╲
  │  TITLE  │
  │ LUXURY  │
   ╲        ╱
     ╲╱╲╱╲╱
```

---

### 22. Memphis Pop

**Vibe:** Playful, 80s retro, geometric chaos, postmodern

**Layout:** Scattered geometric shapes. Primary colors. Controlled randomness.

**Typography:**
- Display: `Righteous` (400) — bold, funky
- Body: `Rubik` (400/500) — rounded, modern
- Accent: `Fredoka` (600) — playful, bubbly

**Colors:**
```css
:root {
    --bg-white: #fafafa;
    --yellow-bright: #ffeb3b;
    --pink-hot: #ff4081;
    --cyan-electric: #00bcd4;
    --red-pop: #f44336;
    --blue-primary: #2196f3;
    --purple-vibrant: #9c27b0;
    --text-black: #1a1a1a;
    --pattern-mix: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 8px);
}
```

**Signature Elements:**
- Squiggly lines (wavy CSS borders)
- Polka dots (radial-gradient backgrounds)
- Hatching/line patterns (repeating-linear-gradient)
- Scattered triangles, circles, squares (CSS shapes, random rotation)
- Bold primary colors (no pastels)
- Thick black outlines on shapes
- Asymmetric placement with intentional imbalance
- **Memphis hallmarks**: geometric shapes, bold colors, surface patterns, no symmetry rules

**Layout Pattern:**
```
  ◯   ╱╲  ▀▀▀
 TITLE ◢  ◯
  POP   ▀▀
▀▀  ART  ◣ ◯
```

---

### 23. Vaporwave Dream

**Vibe:** Nostalgic, surreal, cyberpunk aesthetics, 80s-90s internet

**Layout:** Gradient mesh backgrounds. Greek statue motifs (CSS outline). Glitch effects.

**Typography:**
- Display: `Rampart One` (400) — retro, bold
- Body: `Share Tech Mono` (400) — digital, monospace
- Accent: `VT323` (400) — pixel/retro terminal

**Colors:**
```css
:root {
    --pink-vaporwave: #ff71ce;
    --purple-deep: #b967ff;
    --cyan-bright: #05ffa1;
    --blue-electric: #01cdfe;
    --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    --text-white: #ffffff;
    --text-cyan: #01cdfe;
    --grid-pink: rgba(255, 113, 206, 0.3);
    --glow-pink: rgba(255, 113, 206, 0.6);
}
```

**Signature Elements:**
- Pink-purple gradient backgrounds (always)
- Perspective grid floor (CSS transform: perspective + rotateX)
- Glitch text effect (text-shadow RGB offset)
- Wireframe mountains/landscapes (CSS clip-path)
- Greek column/statue silhouettes (CSS outline)
- Sun/moon with horizontal scan lines
- Checkerboard floor pattern
- VHS tracking line animation
- **A E S T H E T I C**: retro futurism, digital nostalgia, surreal imagery

**Layout Pattern:**
```
 ━━━━━━━━━━━━━━━━
 ░A░E░S░T░H░E░T░I░C
 ━━━━━━━━━━━━━━━━
    /█\  ← Statue
   TITLE
 ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
  Grid floor
```

---

### 24. Brutalist Raw

**Vibe:** Unapologetic, raw, anti-design, concrete

**Layout:** Intentionally harsh. Overlapping elements. No smooth edges.

**Typography:**
- Display: `Courier Prime` (700) — monospace, typewriter
- Body: `Roboto Mono` (400/700) — monospace, utilitarian
- Accent: `Space Mono` (700) — bold monospace

**Colors:**
```css
:root {
    --bg-concrete: #d4d4d4;
    --bg-dark-concrete: #8a8a8a;
    --text-black: #0a0a0a;
    --accent-red: #ff0000;
    --accent-yellow: #ffff00;
    --border-heavy: #1a1a1a;
    --shadow-harsh: rgba(0, 0, 0, 0.8);
}
```

**Signature Elements:**
- Thick black borders everywhere (5-10px solid)
- Harsh drop shadows (no blur, sharp offset)
- Overlapping containers with visible z-index
- Monospace text only (no variable-width fonts)
- Raw HTML default button styles
- Brutalist tables with heavy borders
- Intentional misalignment
- Screenshot/website frame mockups
- **Anti-aesthetics**: function over form, raw materials, honest construction

**Layout Pattern:**
```
╔═══════════════════════╗
║ ████ BRUTALISM        ║
║ ▓▓▓▓ RAW              ║
╠═══════════════════════╣
║ NO COMPROMISE         ║
║ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ║
╚═══════════════════════╝
```

---

## Font Pairing Quick Reference

| Preset | Display Font | Body Font | Source |
|--------|--------------|-----------|--------|
| Bold Signal | Archivo Black | Space Grotesk | Google |
| Electric Studio | Manrope | Manrope | Google |
| Creative Voltage | Syne | Space Mono | Google |
| Dark Botanical | Cormorant | IBM Plex Sans | Google |
| Notebook Tabs | Bodoni Moda | DM Sans | Google |
| Pastel Geometry | Plus Jakarta Sans | Plus Jakarta Sans | Google |
| Split Pastel | Outfit | Outfit | Google |
| Vintage Editorial | Fraunces | Work Sans | Google |
| Neon Cyber | Clash Display | Satoshi | Fontshare |
| Terminal Green | JetBrains Mono | JetBrains Mono | JetBrains |
| Swiss Modern | Archivo | Nunito | Google |
| Paper & Ink | Cormorant Garamond | Source Serif 4 | Google |
| **13. Finance Pro** | **Playfair Display** | **Inter** | **Google** |
| **14. Startup Energy** | **Poppins** | **Inter** | **Google** |
| **15. Healthcare Trust** | **Quicksand** | **Open Sans** | **Google** |
| **16. Education Clear** | **Nunito** | **Lato** | **Google** |
| **17. Tech Product** | **Orbitron** | **Exo 2** | **Google** |
| **18. Creative Agency** | **Bebas Neue** | **Raleway** | **Google** |
| **19. Japanese Zen** | **Noto Serif JP** | **Noto Sans JP** | **Google** |
| **20. Nordic Minimal** | **Commissioner** | **Karla** | **Google** |
| **21. Art Deco Luxury** | **Cinzel** | **Montserrat** | **Google** |
| **22. Memphis Pop** | **Righteous** | **Rubik** | **Google** |
| **23. Vaporwave Dream** | **Rampart One** | **Share Tech Mono** | **Google** |
| **24. Brutalist Raw** | **Courier Prime** | **Roboto Mono** | **Google** |

---

## DO NOT USE (Generic AI Patterns)

**Fonts:** Inter, Roboto, Arial, system fonts as display

**Colors:** `#6366f1` (generic indigo), purple gradients on white

**Layouts:** Everything centered, generic hero sections, identical card grids

**Decorations:** Realistic illustrations, gratuitous glassmorphism, drop shadows without purpose

---

## CSS Gotchas

### Negating CSS Functions

**WRONG — silently ignored by browsers (no console error):**
```css
right: -clamp(28px, 3.5vw, 44px);   /* Browser ignores this */
margin-left: -min(10vw, 100px);      /* Browser ignores this */
```

**CORRECT — wrap in `calc()`:**
```css
right: calc(-1 * clamp(28px, 3.5vw, 44px));  /* Works */
margin-left: calc(-1 * min(10vw, 100px));     /* Works */
```

CSS does not allow a leading `-` before function names. The browser silently discards the entire declaration — no error, the element just appears in the wrong position. **Always use `calc(-1 * ...)` to negate CSS function values.**

