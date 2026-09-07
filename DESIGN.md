# VOOM DESIGN SYSTEM

Voom is a premium, minimal, video-first communication product.
Design should feel fast, polished, technical, calm, and intentional.
The video is always the visual focus.

## Visual Tokens

Colors:
- Background: #0A0A0A
- Surface: #111111
- Elevated: #171717
- Hover: #1D1D1D
- Border: #262626
- Text: #F5F5F5
- Secondary: #A3A3A3
- Muted: #737373
- Accent: #FF5C5C
- Accent Hover: #FF7070
- Success: #4ADE80
- Warning: #FBBF24
- Error: #F87171

Typography:
- Font: Geist, Inter, system-ui, sans-serif
- Display: 48px / 600
- H1: 24px / 600
- H2: 18px / 600
- Body: 15px / 400
- Small: 13px / 400
- Caption: 12px / 400
- Use tight letter-spacing on headings.

Spacing:
- 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px
- Prefer the spacing scale; avoid arbitrary values.

Radius:
- Small: 6px
- Default: 8px
- Cards: 12px
- Large: 16px
- Pills: 9999px only for status/tags/filters.

## Components

Use shadcn/ui as the base component system.
Customize shadcn components to match Voom instead of accepting generic defaults.
Do not add another UI library without a strong reason.

Buttons:
- Primary: high contrast, 36–40px, 8px radius.
- Secondary: subtle surface + border.
- Ghost: transparent, low emphasis.
- Destructive: semantic error styling.
- Record action may use the accent color.
- Icon-only buttons require accessible labels/tooltips.

Cards:
- Subtle border, minimal shadow, 12px radius.
- Avoid nested cards and excessive containers.

Navigation:
- Minimal and clean.
- Prioritize Voom, Record, Videos/Dashboard, Search, Account.
- Record must always be easy to find.

## Dashboard

Make the dashboard feel like a video library, NOT an analytics dashboard.

Hierarchy:
1. Page title
2. Record action
3. Search/filter
4. Video library

Video thumbnails are the main visual element.
Titles are prominent; duration/date/status are secondary.
Avoid excessive statistics, cards, gradients, and decoration.

## Video Player

The video gets the most visual space.
Controls should be subtle and become prominent during interaction.
Support play/pause, timeline, volume, speed, fullscreen, and keyboard controls.
Keep important video content unobstructed.

## Recording

Recording is a primary product experience.

States:
Preparing → Recording → Paused → Uploading → Processing → Ready/Failed

Keep recording UI minimal.
Make recording state immediately obvious.
Controls should include Stop, Pause/Resume, Microphone, Camera, Screen Source.
Avoid distracting animations.

## Share Page

Prioritize:
Video → Title/metadata → Share actions → Additional information

Keep the page clean for both authenticated and unauthenticated viewers.

## Forms

Use visible labels, clear borders, comfortable input height, strong focus states,
and consistent spacing. Show validation errors near the relevant field.

## Loading / Empty / Error

Loading:
- Prefer skeletons for content.
- Preserve existing content during background refetches.

Empty:
- Explain what the user can do next.
- Include the relevant primary action.

Error:
- Explain what happened and what the user can do.
- Never expose technical errors, stack traces, SQL, or internal details.

## Motion

- Fast: 120ms
- Normal: 180ms
- Slow: 240ms

Use motion for interaction and state changes.
Avoid excessive bouncing, decorative animation, and distracting recording effects.
Respect prefers-reduced-motion.

## Responsive

Desktop is the primary workspace.
Tablet preserves hierarchy.
Mobile prioritizes Recording, Watching, Sharing, and essential navigation.
Collapse layouts instead of squeezing them.
Never introduce horizontal overflow.
Keep touch targets comfortable.

## Accessibility

Use semantic HTML, accessible labels, keyboard navigation, visible focus states,
and sufficient contrast. Never communicate important information through color alone.

## Design Rules

DO:
- Keep layouts clean and intentional.
- Use whitespace generously.
- Make video the visual focus.
- Use subtle borders and surfaces.
- Keep metadata quiet.
- Maintain consistent spacing and typography.
- Prefer shadcn/ui primitives.

DON'T:
- Excessive gradients.
- Excessive glassmorphism.
- Giant shadows.
- Random colors.
- Excessive rounded cards.
- Unnecessary animations.
- Dashboard-card overload.
- Generic SaaS styling.
- Copy Loom, Linear, or Vercel literally.
- Sacrifice usability for visual effects.

When creating or modifying UI, always follow this design system.