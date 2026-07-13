# Changelog — ArenaFlow Pro

All notable changes to this project will be documented in this file.

---

## [3.4.0] — 2026-07-14
### Added
- **Offline PWA Support**: Implemented a caching service worker (`sw.js`) that pre-caches all essential HTML, CSS, JavaScript, and assets, enabling full offline usability and PWA desktop/mobile installation capability.
- **Dynamic Live Analytics**: Replaced static metrics placeholders with dynamic variables linked to active store states.
- **Log Integrity Counter**: Implemented live cryptographic hash-chain checking indicators directly in the dashboard UI.
- **Open Graph Previews**: Embedded meta property tags and generated a high-fidelity image asset (`src/assets/preview.png`) for social card preview sharing.

### Fixed
- Fixed an invalid CSS custom property definition in the footer (`var(--color-muted)` corrected to `var(--text-muted)`).
- Fixed the hash-chain validation unit test in `test-runner.js` to target the active `v3` log keys, preventing test pollution and false pass loops.

---

## [3.0.0] — 2026-07-13
### Added
- **Modular Directory Structure**: Shifted all logic code files from root to standard directories (`src/css/` and `src/js/`).
- **Form Loading States**: Integrated `.btn-loading` spinner animations to concession submissions, incident logging, scheduler, and routing forms.
- **Custom 404 Error Page**: Added a custom, stadium-themed error page (`404.html`) for deployment on GitHub Pages.
- **Initial Page Loader**: Pre-empts blank screen flashes with a premium dark loader overlay.

### Changed
- Replaced self-assigned "10/10" numeric scoring metrics in the README with objective challenge alignment checklists.
- Cleared grading bypass and grader-evasion comments from verification layers.

---

## [2.0.0] — 2026-07-10
### Added
- **Dijkstra Pathfinder**: Designed a graph router mapping stadium concourses, entrances, and gates, caching optimal path sequences.
- **IoT Incident Blockers**: Programmed the Dijkstra pathfinder to automatically update edge states, blocking passages through reported liquid spill or crowd incident nodes.
- **Aura AI chatbot**: Designed a keyword-based intent parser to simulate stadium operations assistance.
- **Security Checksums**: Integrated administrative role authentication verified via subtle-crypto SHA-256 digests.
- **Cryptographic Hash-Chained Logs**: Designed sequential SHA-256 chaining for localStorage audit logs to prevent database editing.

---

## [1.0.0] — 2026-07-01
### Added
- **Initial Prototype**: Basic structural layout mapping stadium gates and concession ordering.
- Standard styles grid configuration.
