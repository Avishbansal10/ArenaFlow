# ArenaFlow — Smart Stadium & Tournament Operations Control

[![Live System Health](https://img.shields.io/badge/System_Health-Excellent-10b981?style=flat-square)](#)
[![Accessibility Compliance](https://img.shields.io/badge/WCAG_2.1-AA_Compliant-blue?style=flat-square)](#)
[![Security Policy](https://img.shields.io/badge/Security-Sanitized_&_Audited-blueviolet?style=flat-square)](#)

**ArenaFlow** is a comprehensive, client-side control center and fan portal built for the **Smart Stadium & Tournament Operation** challenge vertical. It integrates tournament coordination, resource monitoring, security reporting, dynamic crowd control, and inclusive fan navigation into a unified Slate-Dark web application.

---

## 🌟 Core Features & Vertical Alignment

### 1. Tournament Operations Control (TOC)
- **Live Match Scheduler**: Register sports, tournaments, venues, and team branding colors.
- **Dynamic Scoreboard Controls**: Instantly increment scores, adjust timers, and update match status (Scheduled, Live, Completed) to synchronize immediately with the fan dashboard.

### 2. Smart Stadium & Incident Dispatch
- **Fan Incident Ticketing**: Allows fans to report incidents (spills, medical, security, maintenance) with custom descriptions and urgency levels.
- **Operator Dispatch Board**: A dedicated control board to track tickets, assign responders, and log resolutions in real-time.
- **Concessions Seat-Delivery**: In-seat meal ordering paired with a stateful order dispatcher and active progress-tracking bar.

### 3. Crowd safety & IoT Sensors
- **Interactive Heatmap**: A custom circular stadium grid rendering active gate entry sensors (Gates A–D) and concession zone occupancies.
- **Dynamic Redirection Alerts**: Operators can flag high congestion at specific gates and broadcast rerouting alerts, guiding fans to less busy entrances.

### 4. Inclusive & Accessible Design (WCAG AA/AAA)
- **Contrast Mode Toggle**: High-contrast stylesheet swap to assist visually impaired users.
- **Keyboard Navigation Override**: Complete focus rings (`:focus-visible`) and logical tab flows for screen-readers.
- **Text-to-Speech (TTS) Narrator**: Integrates the Web Speech API to read announcements, safety warnings, and pathfinding directions aloud.
- **Step-Free Seat Finder**: Algorithmic pathfinder routing that avoids stairs and selects ramp/elevator paths when the step-free preference is enabled.

---

## ⚙️ Architecture & Logic Design

The application is structured using a clean **Model-View-Controller (MVC)** architectural pattern in pure, native web technologies (HTML5, CSS3, ES6 JavaScript) to guarantee compatibility, high speed, and zero external dependency risk:

- **State Container (`state.js`)**: Holds current app state (matches, incidents, orders, sensors) and exports mutations. Persists state data in `localStorage` to survive page reloads.
- **Security Sanitizer (`security.js`)**:
  - Implements character entity encoding on all dynamic DOM injections to prevent Cross-Site Scripting (XSS).
  - Validates fields (seat patterns, names, length restrictions) on client entry.
  - Maintains an **Immutable Session Audit Log** to capture administrative actions (score adjustments, incident resolutions, resets) for security auditing.
- **Dijkstra Pathfinding Graph**:
  - Represents the stadium layout as a directed graph.
  - Nodes model seating blocks, stairs, elevators, concourses, and gates.
  - Edges possess weights reflecting physical walking distances.
  - If "Step-free" navigation is selected, the algorithm filters out staircase edges and computes the shortest alternative elevator route.

---

## 🛠️ Verification & Test Diagnostics Suite (`test-runner.js`)

To meet strict validation guidelines without node packages, **ArenaFlow** implements a **custom, client-side Unit Testing Framework** directly in the browser:

- **Diagnostics Tab**: Accessible in the dashboard, it lets users run a suite of unit and integration tests with a single click.
- **Unit Test Coverage**:
  - **Security Sanitizers**: Confirms XSS blocks on script injection vectors.
  - **State Transitions**: Validates scheduling matches, updating scores, and submitting incidents.
  - **Algorithms**: Verifies Dijkstra pathfinding selects correct elevator nodes under step-free constraints.
- **Results Panel**: Renders assertions, pass/fail status, and microsecond timings in a simulated developer console.

---

## 📋 Challenge Parameters Fulfillment

| Parameter | Implementation Details |
| :--- | :--- |
| **Code Quality** | Structured MVC files, strict JS formatting, descriptive variables, and clean separation of concerns. |
| **Security** | Dynamic XSS sanitization, rigorous regex input validation, and an immutable local audit log history. |
| **Efficiency** | Lightweight codebase (<150KB total), event delegation for DOM performance, and requestAnimationFrame readiness. |
| **Testing** | 10+ custom unit tests executable directly inside the diagnostic tab. |
| **Accessibility** | High contrast styling, screen-reader helper texts (`.sr-only`), full keyboard accessibility, and Speech Synthesis. |
| **Vertical Alignment** | Directly tackles real-world stadium operations (crowd control, logistics, scoring, event safety). |

---

## 🚀 How to Run Locally

1. Clone this repository (or copy the directory).
2. Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
3. Switch roles using the tabs at the top:
   - **Fan Portal**: Calculate seat-to-gate directions, order food to your seat, report clean-up hazards.
   - **TOC Console**: Score games, check sensor flow rates, assign incident responders.
   - **System Diagnostics**: Click "Run Diagnostics" to verify unit test status.
4. Toggle "Contrast Mode" to check accessibility changes.

---

## 🤖 Generative AI Integration & Pairing

In accordance with the challenge guidelines, this system was co-piloted, architected, and refined in partnership with **Gemini / Antigravity**, Google DeepMind's agentic AI coding assistant. 

Generative AI was actively leveraged to:
- **Design MVC Architecture**: Formulate the separation of concerns between state storage (`state.js`), input sanitizers (`security.js`), and UI controls (`app.js`).
- **Develop Algorithms**: Implement and debug the custom Dijkstra pathfinding router, ensuring the step-free accessibility filter operates correctly.
- **Audit Security**: Verify that raw user input is securely escaped across all dynamic DOM insertions to prevent injection threats.
- **Build Diagnostics**: Author and construct the built-in client-side unit test framework (`test-runner.js`) to provide one-click system health checks.

---

## 💡 Assumptions Made

- **Browser Capabilities**: Assumes the host browser supports standard HTML5 components and the Web Speech API (`window.speechSynthesis`) for the voice assistant.
- **Persistence**: Employs client-side storage (`localStorage`/`sessionStorage`) to simulate database permanence without external server setups.
- **Stadium Layout**: Visualizes a standard circular layout mapping 4 outer gates, 3 concession nodes, 3 seating blocks, and elevator-stair connectors.

