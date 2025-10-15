# Hot Potato Web App Overview

## Project Structure
- `index.html` bootstraps the interface with language selection, instruction, gameplay, prompt, and support sections plus audio elements and links to the bundled assets. It loads `main.js` and `styles.css` to provide functionality and presentation.
- `styles.css` defines the neon-inspired theme, responsive layout, and component styling, including language grid buttons, prompt cards, and visual accessibility helpers.
- `main.js` drives the application state machine, localization, random prompt selection, GIF rotation, audio playback, safe-mode filtering, and progressive web app registration.
- `locales/*.json` store translated UI strings, prompt categories, prompts, and support resources in English, Greek, Bulgarian, Macedonian, and Albanian.
- `assets/` holds media such as GIFs, background artwork, and audio (`music-file.mp3`, `scream.mp3`). An optional `assets/gifs/index.json` can list available animations for precise control.
- `sw.js` provides offline capability via a cache-first service worker. `manifest.json` contains metadata for installing the PWA.

## Runtime Flow
1. `init()` loads the persisted language and corresponding locale file, fetches available GIFs, and updates all UI labels.
2. The language grid is rendered from the `languages` array; selecting a language updates localStorage and re-initializes the interface.
3. Category toggles are built from the localized data. Safe mode disables sensitive topics while preserving user selections in `state.enabledCategories`.
4. Starting a round plays looping background music, displays a random GIF, and schedules a random timer. When the timer ends, the app transitions to a prompt state with a boom GIF and a randomly chosen prompt, ensuring recent prompts are not repeated.
5. Users can stop or skip prompts, mute or pause audio, and advance to the next round. Keyboard shortcuts (space bar) mirror the primary controls.
6. The service worker caches core assets on install and serves them offline, updating the cache when new GET requests succeed.

## Notable Implementation Details
- `state` centralizes language, audio, prompt, and UI phase data, enabling consistent updates across screens.
- Localization helper `t()` resolves nested keys and supplies fallbacks, keeping UI text fully data-driven.
- Prompt selection avoids immediate repeats by tracking `recentPromptIds` and trimming history to five entries.
- Audio helpers respect the mute toggle, pause controls, and gracefully handle browser autoplay restrictions.
- Responsive design relies on CSS clamps and grid layouts, ensuring usability across devices while maintaining thematic styling.

## Deployment Notes
- Serve the repository via any static host; the service worker and manifest activate automatically over HTTPS.
- Populate `assets/gifs/` with animations and optionally create `index.json` listing filenames.
- Update locale files to manage new prompts, categories, or support resources without editing JavaScript.

