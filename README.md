# Behind the Route — Chapter 12 revised

This version removes the physical installation from Chapter 12, Potential Capstone.

The capstone now has two connected forms:
1. Interactive route simulator
2. Situated route archive

Chapter 12 also includes audience groups, open research questions, and a clear project boundary. The other chapters remain unchanged.

## GitHub Pages display fix

Chapter 04 was rebuilt to avoid differences between VS Code preview and GitHub Pages:

- field cards use CSS Grid instead of absolute positioning
- the center project circle scales responsively
- the slide can grow when browser zoom or effective viewport height requires it
- CSS and JavaScript URLs include a version query to avoid stale GitHub/browser cache
- `.nojekyll` is included for a direct static deployment

Upload the contents of this folder to the repository root. Do not upload an additional parent folder.

## Verified viewport fix — Slides 02 and 04

The deployment issue was reproduced rather than guessed:

- At 1280×720, Slide 02 had a 720 px section but 777 px of content, so the final logic line was clipped by `overflow: hidden`.
- At the same viewport, Slide 04 used a roughly 371 px content panel, which clipped the bottom of the right detail panel.

This version compacts Slide 02 and increases/rebalances the Slide 04 content area. It was checked at 1280×720, 1366×768, 1440×900, 1536×864, and 1920×1080. Asset query versions were also changed so GitHub Pages cannot reuse the previous CSS/JS cache.
