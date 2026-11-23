# TDLE flyover — draft review page

Password-protected review page for the Sound Transit TDLE flyover video. It isn't linked from the rest of the site. Share the link and password directly with reviewers.

**Page:** `https://parametrix-digitalservices.github.io/parametrix-visualization-site/tdle-review/`

Reviewers see four sections:

| Section | What it does |
|---|---|
| **Storyboard** | One frame from each clip, grabbed automatically. Clicking a frame jumps to that clip, already paused on that frame. |
| **Full cut** | The clips edited together with music. The newest draft is on top; earlier drafts fold away below it, each with its own notes. |
| **Clips** | Each clip with a notes panel. Notes are pinned to the moment the reviewer paused on and show as dots under the video. |
| **Music** | Play, rate (1–5 ★) and comment on each music option. *Try with the video* plays the full cut or the clips muted with that track underneath. |

## Folder layout

```
tdle-review/
├── config.js            ← the only file to edit: clips, full cuts, music, password hash, feedback URL
├── index.html, app.js, styles.css
├── set-password.html    makes a new password hash
├── assets/              Parametrix logo
└── media/
    ├── clips/           individual clips (.mp4)
    ├── full/            full-cut drafts (.mp4)
    └── music/           music options (.mp3)
```

## Posting media

1. Copy files into the matching `media/` folder.
2. In `config.js`, point each entry's `src` at its file (e.g. `media/clips/01-opener.mp4`). Entries already listed with a file name just need a file with that name.
3. Commit and push. Pages updates in a minute or two.

**Encoding:** H.264 MP4 with `+faststart`. GitHub refuses any file over **100 MB**.
- Clips: 1080p at about 4–5 Mbps is plenty for review.
- Full cuts: keep each file under ~95 MB. A 3-minute cut at about 4 Mbps (video + audio) lands near 90 MB. For a longer cut, lower the bitrate or use 720p.

```
ffmpeg -i in.mov -c:v libx264 -preset slow -b:v 4M -maxrate 5M -bufsize 10M -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart out.mp4
```

**New versions:** give the new file a new name (e.g. `03-start-to-sfw-d2.mp4`), update `src`, and bump `version`. **Keep the same `id`** so earlier notes stay attached; they're flagged "on Draft 1". For full cuts, add a new entry at the **top** of `fullCuts` instead, so each draft keeps its own notes.

**Storyboard frames:** taken from the middle of each clip by default. Set `frameAt` (seconds) on a clip to choose a different moment, or set `poster` to a still you exported (e.g. `media/stills/03.jpg`).

**Repo size:** git keeps every file ever committed, even after it's deleted. Delete superseded drafts from `media/` to keep the published site small, and keep encodes lean.

## Shared feedback (Google Sheet)

Notes and ratings are stored in a Google Sheet through a small Apps Script (`Code.gs`). Setup steps are at the top of that file. **`Code.gs` is deliberately not in this repo, because it contains the password in plain text.** Once the script is deployed, paste its `/exec` URL into `config.js` → `backendUrl`. Until then the page runs in preview mode, and feedback stays in each reviewer's own browser.

## Changing the password

Open `set-password.html` on the live site, type the new password, and paste the generated `passwordHash` line into `config.js`. Set the same password in `Code.gs` and redeploy the script (Deploy → Manage deployments → edit → New version).

The password is a courtesy lock, not real security. This repository is public, so anyone browsing it on github.com can see the files in `media/`.
