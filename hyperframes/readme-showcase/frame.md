# Frame: fork-sentinel Showcase

Two short, silent reels. They are separate on purpose: one makes the argument, the
other shows the tool. Trying to do both in one reel meant neither landed.

## Format

- Canvas: 1920 × 1080, 16:9 · 30 fps · silent
- `index.html` — **the run** (14s): the command is typed, the table builds row by row
- `compositions/funnel.html` — **the funnel** (12s): 69 forks narrow to 9 that matter
- Delivery: H.264 MP4 (download), VP9 WebM (landing page), animated WebP (GitHub README —
  a README will not play an MP4 but renders an animated WebP inline), JPEG poster

## Brand source

Inherited from the landing page rather than invented, so the reel and the page it sits
on read as one product. This is a stylized reconstruction of real output, not a screen
recording — but every number in it is real, taken from an actual scan of the account.

## Palette

| Token | Value | Use |
|---|---|---|
| Canvas | `#0a0c10` | Page ground |
| Terminal | `#070910` | Inside the window |
| Surface | `#161b24` | Title bar, tiles |
| Line | `#222936` | Borders |
| Text | `#e6e9ef` | Primary |
| Dim | `#808a9a` | Secondary terminal text |
| Accent | `#3fb950` | `clean`, prompt, caret, URL |
| Danger | `#f85149` | `DIVERGED`, behind counts |

`--dim` is `#808a9a`, **not** the landing page's `#6e7785`. The check gate measured that
value at 4.4:1 against the terminal ground — under WCAG AA's 4.5:1. The page has the same
defect; the reel does not inherit it.

## Typography

- Display: `Inter` (variable), 800 for the wordmark, `-0.035em` tracking
- Terminal and data: `JetBrains Mono` (variable), 23px in the run
- Both vendored as local WOFF2 under `assets/fonts` with their OFL licences. One file per
  family: these are **variable** fonts, so a per-weight file would be the same bytes twice.

## Motion character

- Mechanical, not decorative. Every move is something the tool actually does: a command
  typed, rows arriving in scan order, a set narrowing.
- The run reveals in real output order; nothing is reordered for drama.
- The funnel never deletes the 52 bookmarks from frame — they recede to ~10% opacity and
  stay. Removing them would misrepresent the tool, which hides them but always counts them.

## Do

- Keep every number real and traceable to a scan.
- Let `DIVERGED` be the only red in frame; it is the only actionable state.
- Hold the last beat long enough to read the URL.

## Do not

- Do not add audio. GitHub READMEs autoplay muted, so a score is wasted there.
- Do not use `Math.random()` or `Date.now()` — renders must be frame-identical on re-run.
- Do not fetch fonts or media at render time.
- Do not animate `width` on an inline element. It silently does nothing, which is exactly
  how the first cut shipped a "typing" effect that never typed.
