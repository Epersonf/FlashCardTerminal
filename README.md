# FlashCards Terminal

A terminal-aesthetic flashcard application with spaced repetition (SM-2/Anki algorithm) and a built-in Pomodoro timer. Runs entirely in the browser — no build step, no server, no dependencies to install.

```
> Initializing FlashCards Terminal v3.0...
> Loading SM-2 algorithm...
> 3 card(s) across 2 subject(s)
> 0 card(s) due for review today
> System ready. Good studying.
_
```

---

## Features

### Flashcards
- **SM-2 spaced repetition** — four answer grades (Again / Hard / Good / Easy) dynamically schedule each card's next review using the Anki algorithm
- **Per-card states**: `new → learning → review` and `review → relearning → review` on lapses
- **Image support** — attach images to front and back of any card via file picker or paste (Ctrl+V); images are compressed client-side to JPEG at 800 px / 0.6 quality before storage
- **Bulk import** — paste CSV/TSV text (`front ; back` or `front | back`) for fast deck creation
- **Per-subject dashboards** — accuracy %, due count, and session history per subject
- **Study modes** — review only due cards, or free-train all cards in a subject

### Pomodoro Timer
- Configurable focus / short break / long break durations and long-break interval
- **Two flashcard-in-Pomodoro modes**:
  - *Real review* — answers update card schedules
  - *Free training* — shows all subject cards without affecting history
- Desktop notifications when a session ends (with permission request)
- Screen Wake Lock API integration to prevent the display from sleeping
- Web Worker-based ticker for accurate timing even in background tabs
- Tab title shows live countdown while the timer is running

### Data Persistence
- **IndexedDB** as the primary store (`FCT_Database`, stores `app_state` + `file_handles`) — data survives page reloads with no manual action
- **Optional JSON backup file** — connect a local `.json` file via the File System Access API; the handle is remembered in IndexedDB so the file stays in sync across sessions automatically
- **Export/Import** — download a timestamped JSON backup or load a previously exported file at any time
- Study streak counter and daily/weekly/yearly focus-time tracking

### Progressive Web App
- `manifest.json` for installability on desktop and mobile
- Service worker (`sw.js`) with cache-first strategy for offline use; CDN scripts are network-first with cache fallback

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 18.3.1 (UMD/CDN, no build step) |
| JSX transpilation | Babel Standalone 7.29.0 |
| Persistence | IndexedDB (native browser API) |
| File sync | File System Access API |
| Fonts | JetBrains Mono (Google Fonts) |
| Scheduling | SM-2 algorithm (Anki variant) |
| Offline | Service Worker + Cache API |

No npm, no webpack, no bundler. The application is a collection of plain HTML/CSS/JS files.

---

## Project Structure

```
website/
├── index.html          # Entry point — loads all scripts, PWA meta tags
├── manifest.json       # PWA manifest (name, icons, theme color)
├── sw.js               # Service worker — cache-first offline support
│
├── css/
│   └── styles.css      # All global styles, CSS variables, animations
│
└── js/
    ├── db.js           # IndexedDB layer + File System Access API helpers
    ├── utils.js        # Constants, pure functions, SM-2 algorithm
    ├── components.js   # Reusable UI components (buttons, inputs, charts)
    ├── views.js        # Full-screen views (Home, Dashboard, Study, Pomodoro, …)
    └── app.js          # Root App component, state management, uploadMedia
```

### Script loading order (important)

```html
<script src="js/db.js"></script>               <!-- plain JS, runs first -->
<script type="text/babel" src="js/utils.js"></script>
<script type="text/babel" src="js/components.js"></script>
<script type="text/babel" src="js/views.js"></script>
<script type="text/babel" src="js/app.js"></script>  <!-- ReactDOM.createRoot here -->
```

All files share the global browser scope — there are no ES modules or import/export statements. Symbols defined in earlier files are available in later ones.

---

## Getting Started

### Option 1 — Open directly in the browser

Just open `index.html` in Chrome or Edge. No local server needed for basic use.

> **Note:** The File System Access API (optional JSON sync) requires a secure context. If you open the file via `file://`, Chrome may block it. Use Option 2 to avoid this.

### Option 2 — Serve locally

Any static file server works:

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .

# Node.js (existing server.js if present)
node server.js
```

Then open `http://localhost:8080` in your browser.

### Option 3 — Deploy to GitHub Pages / Netlify / any static host

Upload the entire folder. No build step required.

---

## Usage

### Creating cards

1. Click **[ + CARD ]** or use the sidebar's **+** button next to a subject
2. Select a subject (or type a new one)
3. Fill in the front (question) and back (answer)
4. Optionally attach images — drag-and-drop, file picker, or Ctrl+V to paste from clipboard
5. Click **[ SAVE CARD ]**

### Importing cards in bulk

1. Click **[ IMPORT ]**
2. Select a subject
3. Paste text in `front ; back` format (semicolon, pipe `|`, or tab as separator), one card per line
4. Click **[ ANALYZE ]** to preview, then **[ IMPORT N CARDS ]**

### Reviewing cards

- **[ REVIEW (N) ]** — studies only cards that are due now (SM-2 scheduled)
- **[ STUDY ALL ]** — studies all cards in the current subject regardless of schedule
- Cards are shown face-down; click the card or **[ REVEAL ]** to flip
- Grade your recall: **Again** (forgot) → **Hard** → **Good** → **Easy** (trivial)

### Answer grades explained

| Grade | Effect |
|---|---|
| **Again** | Card returns to learning queue; ease factor decreases |
| **Hard** | Short interval; ease factor slightly decreases |
| **Good** | Normal interval based on current ease factor |
| **Easy** | Longer interval; ease factor increases |

### Connecting a JSON backup file

1. Click **CONNECT JSON** in the header
2. Select an existing `.json` backup or create one
3. The app merges data (newest `_savedAt` timestamp wins) and keeps the file in sync automatically on every state change
4. The file handle is stored in IndexedDB — reconnection is automatic on the next session (if the browser still has permission)

### Pomodoro timer

1. Click **[ POMODORO ]** in the header or home screen
2. Select the subject you will study
3. Press **[ START ]** — the timer counts down and shows due flashcards in the sidebar
4. At the end of each focus session, a break is suggested automatically
5. Click **[ CONFIG ]** to adjust durations and the in-Pomodoro flashcard mode

---

## Data Schema

All data is stored as a single JSON object:

```json
{
  "subjects": ["Philosophy", "Math"],
  "cards": [
    {
      "id": "abc1234",
      "subject": "Philosophy",
      "front": "What is the categorical imperative?",
      "back": "Kant's moral principle: act only according to maxims you could will to be universal laws.",
      "frontImage": null,
      "backImage": null,
      "state": "new",
      "interval": 0,
      "reps": 0,
      "ease": 2.5,
      "stepIndex": 0,
      "lapses": 0,
      "due": null,
      "dueAt": null,
      "correct": 0,
      "wrong": 0,
      "hard": 0,
      "easy": 0,
      "updatedAt": "2026-05-03T12:00:00.000Z"
    }
  ],
  "streak": { "count": 3, "lastDate": "2026-05-03" },
  "history": [
    { "date": "2026-05-03", "correct": 12, "wrong": 2, "total": 14 }
  ],
  "pomodoroHistory": [
    { "date": "2026-05-03", "subject": "Philosophy", "count": 2, "minutes": 50 }
  ],
  "pomodoroSettings": {
    "focusDuration": 25,
    "shortBreak": 5,
    "longBreak": 15,
    "longBreakInterval": 4,
    "flashcardMode": "due"
  },
  "_savedAt": 1746273600000
}
```

`frontImage` / `backImage` are either `null` or a base64-encoded JPEG data URL.

---

## SM-2 Algorithm

The scheduling logic is an Anki-style variant of the classic SM-2 algorithm:

```
ANKI config:
  learningSteps:      [1, 10]  minutes
  relearningSteps:    [10]     minutes
  graduatingInterval: 1        day
  easyInterval:       4        days
  hardFactor:         1.2
  easyBonus:          1.3
  minEase:            1.3

States: new → learning → review
                ↑           ↓ (on Again)
           relearning ←────┘
```

- **New cards** enter the learning queue (step 0)
- **Learning/Relearning** steps are timed in minutes via `dueAt` (ISO timestamp)
- **Review cards** use interval multiplication with the ease factor
- Ease factor starts at **2.5**, increases on Easy (+0.15), decreases on Hard (−0.15) and Again (−0.20), floored at **1.3**

---

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Core app | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| File System Access API | ✅ | ✅ | ❌ | ❌ |
| Screen Wake Lock | ✅ | ✅ | ❌ | ❌ |
| Desktop Notifications | ✅ | ✅ | ✅ | ✅ (macOS 13+) |
| PWA install | ✅ | ✅ | ❌ | ✅ (iOS 16.4+) |

The File System Access API and Wake Lock are **optional** — the app degrades gracefully without them.

---

## PWA Icons

The manifest references `icon-192.png` and `icon-512.png`. These files are not included in the repository. You can generate them from any image using:

```bash
# Example with ImageMagick
convert source.png -resize 192x192 icon-192.png
convert source.png -resize 512x512 icon-512.png
```

Or use an online PWA icon generator and drop the files in the project root.

---

## License

MIT — do whatever you want with it.
