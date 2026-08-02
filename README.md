# Behind the Route — self-contained deployment fix

This version fixes the missing Slide 01 image shown in the browser screenshot.

- The delivery-app image is embedded directly inside `index.html`.
- The full CSS and JavaScript are also embedded directly inside `index.html`.
- `index.html` can therefore be opened by itself in VS Code, a browser, or GitHub Pages without losing the image, layout, or interactions.
- `single-file.html` is an identical backup.
- The original `style.css`, `main.js`, and `images/` files are retained for editing.

For GitHub Pages, upload the whole folder or upload `index.html` by itself. The external Mapbox library is still loaded online for map-based sections.
