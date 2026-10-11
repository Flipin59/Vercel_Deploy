# contents

Raw learning material. No code here.

| Folder | What goes in | Owner |
| --- | --- | --- |
| `reels/` | Reel scripts and the placeholder-clip generator. The clips themselves live in the public `reels` Supabase Storage bucket (`English/`, `Hindi/` folders), never in git | Nagamalla Sai Abhinav |
| `pdfs/` | Manga-style lesson PDFs | Saikiran S |
| `audio/` | Voice-overs, sound effects, music — one subfolder per feature (`audio/reels/`, `audio/play/`, ...) | whoever owns that feature |

- Name files `<pillar>-<short-name>.<lang>.<ext>`, e.g. `invest-compounding.te.mp4`. Pillars: `budget`, `save`, `invest`, `safety`.
- Keep files small: GitHub rejects anything over 100 MB, and every clone downloads all of it. Compress video to 720p or lower.
- Next.js does not serve this folder. How the app reads it (Supabase Storage upload, or a copy step into `public/`) is the feature owner's call.
