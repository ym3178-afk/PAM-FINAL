# Behind the Route — Fixed Ratio Version

This version preserves the original desktop composition on every device.

- `index.html` — recommended entry file; loads `presentation.html` in a fixed 1920 × 1052 presentation viewport.
- `presentation.html` — the complete 12-chapter interactive presentation.
- `single-file.html` — self-contained version for opening or sharing as one HTML file.

The presentation is scaled uniformly to fit the browser window. It does not reflow when the screen width changes, so typography, maps, cards, and the 16:10 chapter canvases keep their original proportions.

For GitHub Pages, upload the whole folder and open `index.html`.

- Chapter 08 map and scrollable information column now extend to the exact bottom edge of the fixed 16:10 canvas.


Update: Chapters 10–12 thematic content is centered while preserving the fixed 16:10 canvas.


Chapter 12 update: the main challenge composition is vertically centered within the fixed 16:10 canvas, while the conclusion bar remains anchored at the bottom.


Latest refinement: Chapters 10–12 use true vertical centering while preserving the fixed 16:10 composition and anchored bottom bars.


Latest adjustment: Chapter 08 map and scrollable information sidebar now share one exact-height grid track, with locked bottom-edge alignment.

Latest text update: Chapter 04 introductory paragraph was replaced with the condensed movement–power–representation version.


Latest update: Chapter 06 community-of-practice summary was replaced with the concise revised text.


Latest update: Chapter 01 introduction text was revised to emphasize delayed and cold deliveries and the gap between interface simplicity and delivery complexity.

Latest text update: Chapter 07 methods introduction was condensed while preserving the fixed-ratio layout.

Latest text update: Chapter 08 computational-experiment summary was condensed while preserving the fixed-ratio simulator layout.


Latest text update: Chapter 09 visual-representation introduction has been shortened to focus on layer, compare, and disclose.


Latest text update: Chapter 11 capstone statement was shortened while preserving the fixed-ratio presentation and interactive layout.

Latest text update: Chapter 07 now begins with ‘After defining the research context,’ while preserving the fixed-ratio layout.

Latest text update: Chapter 04 now begins with ‘To study this system,’ while preserving the fixed-ratio layout.

Latest text update: Chapter 12 summarizes the four project challenges in one concise sentence.


Update made on request:
- Chapter 06 (Forensic Architecture): added two precedent images below the right-side detail panel.
- Images switch on when the Forensic Architecture node is active.


Update: Chapter 06 adjusted so the forensic precedent images are larger, the right-side panel contains less text, and the visuals are more prominent.


Update: Added three reference images to the Data Feminism item in Chapter 06. Open index.html or presentation.html to view the updated right-hand panel.


Update: Added an image-dominant Fairwork panel in Chapter 06. The Fairwork image is shown uncropped with reduced text and enlarged image display.


Update: Chapter 06 Los Deliveristas Unidos panel is now image-dominant. Two uncropped reference images are displayed larger, with reduced supporting text.


Update: Chapter 06 NYC DCWP panel is now image-dominant with two uncropped reference images and reduced supporting text.


Update: Chapter 06 Delivery Platforms panel is now image-dominant with two uncropped reference images and reduced supporting text.


Update: Chapter 05 Historical Lineage now uses recognizable platform wordmarks for the digital-platform and algorithmic-dispatch stages, and replaces the previous reading strip with visual book-cover cards for Trebor Scholz’s Uberworked and Underpaid and Nick Srnicek’s Platform Capitalism.


Update: Chapter 09 (Visual representation) has been removed. All remaining chapters retain their existing content, numbering, and layout.


Latest Chapter 08 update: added a comprehensive-evaluation explanation, dynamic objective weights, and an overall weighted score. Every objective continues to consider all route factors; selecting an objective changes relative weights rather than filtering to one factor.

Latest Chapter 08 road-restriction update:
- Yellow marks the actual closed road segments, with a wide closure band and repeated × symbols.
- A red reroute is only drawn when it does not travel along any yellow segment.
- Routes that share closed segments are marked INVALID and excluded from ranking.
- A single perpendicular crossing at an intersection is treated as a crossing, not shared travel.
- If every candidate conflicts with the closure, the interface shows “No valid reroute” instead of drawing a misleading red line.

Latest Chapter 08 candidate-pool update:
- The simulator now requests 30 authored waypoint strategies with alternative-route responses enabled and retains up to 48 returned street-following candidates, with a target of at least 40.
- The right panel reports generated and valid candidate counts and sorts cards by comprehensive rank.
- Red always means the rank #1 recommendation within the returned candidate set; a manually inspected alternative is shown as a white dashed line.
- After a yellow road closure, the system requests alternative responses for the open-street detour strategies, retains up to 48 additional reroutes, and re-ranks all valid routes.
- No schematic or invented street geometry is added when the routing service returns fewer routes.


Latest Chapter 08 candidate-pool refinement:
- Candidate target increased from 20 to 40, with a maximum of 48 initial routes.
- Every authored waypoint strategy now requests Mapbox alternatives when available.
- Dynamic road-closure rerouting also requests alternatives and can retain up to 48 new open-street reroutes.
- Gray candidate lines use rank-based width and opacity so the larger pool remains readable.
