/* ==========================================================================
   TDLE flyover — draft review page: SETTINGS
   This is the only file you need to edit between drafts.
   ========================================================================== */
window.REVIEW_CONFIG = {
  title: "TDLE Flyover Video — Draft Review",
  subtitle: "Sound Transit · Tacoma Dome Link Extension",
  draftLabel: "Draft 1 · November 2026",
  intro: "The storyboard shows one frame from each clip. Click a frame to go to that clip, or start with the full cut below. Leave notes beside any video; each note is pinned to the moment you paused on.",

  /* Password: SHA-256 of "tdle-review:" + your password (never the password itself — this file is public).
     Make a new one with set-password.html, and put the same password in the feedback sheet's Code.gs. */
  passwordHash: "e0533ccdf4eaf21004d2d537c65613a61e5c03f4a12d7b399784f33ccc3c14a5",

  /* Shared feedback storage: paste your Google Apps Script web-app URL (ends in /exec).
     Leave blank to run in preview mode — feedback then stays in your own browser only. */
  backendUrl: "",

  /* Frame rate used for the timecode column in the feedback sheet (H:MM:SS:FF). */
  fps: 30,

  /* FULL CUTS — the clips edited together with music. NEWEST FIRST: add each new draft at the top.
     Each draft keeps its own notes. Keep each file under ~95 MB (GitHub's hard limit is 100 MB per file).
     - music: which track is on this cut, shown under the title (optional). */
  fullCuts: [
    { id: "full-d1", title: "Full cut", version: "Draft 1", updated: "", src: "", music: "", poster: "", notes: "" }
  ],

  /* CLIPS — in running order. These also make up the storyboard.
     - id:      keep it the same when you post a new version, so earlier notes stay attached.
     - version: bump it ("Draft 2") when you replace the file; notes on older versions get flagged.
     - src:     path in this folder (media/clips/...) or a full https URL to an .mp4. Blank = "not posted yet".
     - frameAt: seconds into the clip for its storyboard frame. Blank = the middle of the clip.
     - poster:  optional still image (e.g. media/stills/01.jpg). Used as the storyboard frame and the player cover. */
  clips: [
    { id: "opener",        title: "Opener",                                version: "Draft 1", updated: "2026-11-23", src: "media/clips/01-opener.mp4",        frameAt: "", poster: "", notes: "" },
    { id: "map",           title: "Corridor map",                          version: "Draft 1", updated: "2026-11-23", src: "media/clips/02-map.mp4",           frameAt: "", poster: "", notes: "" },
    { id: "start-sfw",     title: "Project start to South Federal Way",    version: "Draft 1", updated: "2026-11-23", src: "media/clips/03-start-to-sfw.mp4",  frameAt: "", poster: "", notes: "" },
    { id: "sfw-fife",      title: "South Federal Way to Fife",             version: "Draft 1", updated: "",           src: "",                                  frameAt: "", poster: "", notes: "" },
    { id: "fife-portland", title: "Fife to Portland Avenue",               version: "Draft 1", updated: "",           src: "",                                  frameAt: "", poster: "", notes: "" },
    { id: "portland-dome", title: "Portland Avenue to Tacoma Dome",        version: "Draft 1", updated: "",           src: "",                                  frameAt: "", poster: "", notes: "" },
    { id: "closing",       title: "Closing",                               version: "Draft 1", updated: "",           src: "",                                  frameAt: "", poster: "", notes: "" }
  ],

  /* MUSIC — options to compare. Same rules for id/src. "tags" is free text (mood, tempo, library). */
  music: [
    { id: "music-a", label: "A", title: "Music option A", artist: "", tags: "", src: "media/music/option-a.mp3", notes: "" },
    { id: "music-b", label: "B", title: "Music option B", artist: "", tags: "", src: "media/music/option-b.mp3", notes: "" },
    { id: "music-c", label: "C", title: "Music option C", artist: "", tags: "", src: "media/music/option-c.mp3", notes: "" }
  ]
};
