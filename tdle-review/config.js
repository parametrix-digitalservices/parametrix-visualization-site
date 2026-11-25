/* ==========================================================================
   TDLE flyover — draft review page: SETTINGS
   This is the only file you need to edit between drafts.
   ========================================================================== */
window.REVIEW_CONFIG = {
  title: "TDLE Flyover Video — Draft Review",
  subtitle: "Sound Transit · Tacoma Dome Link Extension",
  draftLabel: "Draft 1 · November 2026",
  /* Shown to reviewers above the clips, and as a tooltip on each clip's badge. Set to "" to hide. */
  clipNotice: "These clips are heavily compressed so they load quickly. Use them to check timing, framing and content. The full cut shows the final picture quality.",
  clipBadge: "Compressed preview",
  fullCutBadge: "Full quality",

  intro: "The storyboard shows one frame from each clip. Click a frame to go to that clip, or start with the full cut below. Leave notes beside any video; each note is pinned to the moment you paused on.",

  /* Password: SHA-256 of "tdle-review:" + your password (never the password itself — this file is public).
     Make a new one with set-password.html, and put the same password in the feedback sheet's Code.gs. */
  passwordHash: "e0533ccdf4eaf21004d2d537c65613a61e5c03f4a12d7b399784f33ccc3c14a5",

  /* Shared feedback storage: paste your Google Apps Script web-app URL (ends in /exec).
     Leave blank to run in preview mode — feedback then stays in your own browser only. */
  backendUrl: "https://script.google.com/macros/s/AKfycbyOwIzSDMUD8wZTvFP5yLMkHH7lerv7caPbVp0tegpq4mCPQ01OFrvvrcOyeeGN_2qTRQ/exec",

  /* Frame rate used for the timecode column in the feedback sheet (H:MM:SS:FF). */
  fps: 30,

  /* FULL CUTS — the clips edited together with music. NEWEST FIRST: add each new draft at the top.
     Each draft keeps its own notes.
     - src: a Vimeo link (best: no size limit, full quality), e.g. "https://vimeo.com/123456789/abcdef1234"
            (for unlisted videos include the part after the second slash), or a file in media/full/ under ~95 MB.
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
    { id: "start-sfw",     title: "Project start to South Federal Way",    version: "Draft 1", updated: "2026-11-23", src: "media/clips/Start_to_FW_005.mp4",  frameAt: "", poster: "", notes: "" },
    { id: "sfw-fife",      title: "South Federal Way to Fife",             version: "Draft 1", updated: "",           src: "",                                  frameAt: "", poster: "", notes: "" },
    { id: "fife-portland", title: "Fife to Portland Avenue",               version: "Draft 1", updated: "",           src: "",                                  frameAt: "", poster: "", notes: "" },
    { id: "portland-dome", title: "Portland Avenue to Tacoma Dome",        version: "Draft 1", updated: "",           src: "",                                  frameAt: "", poster: "", notes: "" },
    { id: "closing",       title: "Closing",                               version: "Draft 1", updated: "2026-11-23", src: "media/clips/TDLE_EndCard_001.mp4",  frameAt: "", poster: "", notes: "" }
  ],

  /* MUSIC — options to compare. Same rules for id/src. "tags" is free text (mood, tempo, library). */
  music: [
    { id: "music-a", label: "A", title: "Modular Horizon", artist: "AI Generated", tags: "", src: "media/music/Modular_Horizon_2026-11-23T212111.mp3", notes: "" },
    { id: "music-b", label: "B", title: "Loop Signal", artist: "AI Generated", tags: "", src: "media/music/Loop_Signal_2026-11-23T212111.mp3", notes: "" },
    { id: "music-c", label: "C", title: "Techline Momentum", artist: "AI Generated", tags: "", src: "media/music/Techline_Momentum_2026-11-23T223443.mp3", notes: "" },
    { id: "music-d", label: "D", title: "Circuit Motion", artist: "AI Generated", tags: "", src: "media/music/Circuit_Motion_2026-11-23T223443.mp3", notes: "" }
  ]
};
