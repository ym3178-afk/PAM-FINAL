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

## Chapter 06 deployment fix

Chapter 06 now uses the slide's available height instead of combining a variable heading with a fixed 510px panel. Its detail panel and node labels are compacted at common laptop widths, so all six interactive states remain usable on GitHub Pages.
