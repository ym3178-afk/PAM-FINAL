# Behind the Route — all 13 sections checked

This deployment-safe version is based on the latest Chapter 06 fixed folder.

## Audit completed

All 13 sections were checked at:

- 1280 × 720
- 1366 × 768
- 1440 × 900
- 1536 × 864
- 1920 × 1080

The website keeps a 16:10 minimum section canvas, but a section can grow when its actual content requires more vertical room. This prevents GitHub Pages / Chrome from clipping content that appears normal in a scaled VS Code preview.

Additional fixes:

- Chapter 04 detail panel has enough height for every interactive field.
- Chapter 07 breakpoints account for the fixed left navigation rail.
- Chapter 09 controls no longer lose the final rows.
- Chapter 11 switches to the intended two-column factor layout on laptop widths.
- Chapter 12 project boundary stays in normal flow and no longer overlaps the audience panel.
- CSS and JavaScript URLs use a new cache-busting version.
- `.nojekyll` is included.

Upload the contents of this folder directly to the repository root.
