# Recommendation

How reels and manga chapters (PDFs) are recommended to each student, and how duel opponents are matched (section 6). Levels and the skill rating come from RATING.md and XP from SCORE.md; tags come from QUESTIONS.md. Recommending content uses the level; matchmaking uses the skill rating.

Owner: Sanjith Ganapathi (Play) writes the rules. Nagamalla Sai Abhinav (Reels) and Saikiran S (Learn) implement them in their features and sign off on changes.

## 1. What every reel and chapter needs

These fields are in addition to what the reel and chapter manifests already have:

| Field | Meaning |
| --- | --- |
| `pillar` | `budget`, `save`, `invest` or `safety` |
| `tags` | 1–3 tags from the list in QUESTIONS.md section 3 |
| `level` | The user level the item is aimed at (1–99), set by the author. Its tier follows from RATING.md section 3 |
| `language` | `en`, `te` or `hi`. One row per language version |
| `created_at` | For the freshness boost |
| `requires` | Chapters only, optional: slugs of chapters to read first |

Engagement is stored by the owning feature:
- **Reels** (`reels_` tables): views, completed views (≥ 80% watched), skips (< 3 s), likes, saves, shares.
- **Learn** (`learn_` tables): chapter opened, last page, finished.

## 2. Step 1: filter

Only items that pass every rule below become candidates:

1. **Language:** the item's language is the user's language. If there are fewer than 20 candidates, also allow English items that have captions in the user's language.
2. **Level window:** the item's level is within `[userLevel − 8, userLevel + 4]`.
   - The window reaches further below than above because revising easier material is fine, while content far above the student loses them.
   - If there are fewer than 20 candidates, widen both sides by 5 levels and repeat, up to 3 times.
3. **Not recently finished:**
   - Reels completed in the last 30 days are excluded.
   - Finished chapters are excluded. Chapters already in progress go in "Continue reading" (section 5) instead.
4. **Prerequisites (chapters only):** every chapter in `requires` is finished.

## 3. Step 2: score

Each candidate gets a score from 0 to 1:

```
score = 0.30 × topicFit
      + 0.25 × popularity
      + 0.20 × friends
      + 0.15 × levelFit
      + 0.10 × freshness
```

Each signal is between 0 and 1.

### topicFit (tags and pillars)

```
topicFit = 0.5 × pillarNeed + 0.5 × tagInterest
```

- **pillarNeed:** `1 − pillarXp / maxPillarXp`, using the user's XP per pillar. The weakest pillar scores 1. A brand-new user with no XP scores 0.5 everywhere.
- **tagInterest:** the user's score for the item's best-matching tag, divided by their highest tag score, counting the last 14 days:

  | Event on an item with that tag | Points |
  | --- | --- |
  | Saved | +3 |
  | Liked | +2 |
  | Completed | +1 |
  | Skipped | −1 |

- **Remediation:** if the user answered a question with one of the item's tags wrong in the last 7 days, `topicFit = 1`. This is how a wrong quiz answer leads to a reel or chapter that explains it.

### popularity

Engagement over the last 30 days, smoothed so that a new item with 2 views and 2 likes doesn't top the feed:

```
rate       = (likes + 2 × saves + completions + 20 × avgRate) / (views + 20)
popularity = rate / highest rate among the candidates
```

`avgRate` is the same rate computed across all items of that type (reels or chapters).

For chapters, use `finished` in place of completions and `opened` in place of views. Chapters have no likes or saves for now.

### friends

```
friends = min(number of friends who liked, saved, completed or finished it in the last 14 days, 3) / 3
```

Friends come from `getFriends(userId)` in the Forum feature. The card may show "Liked by asha_11 and 1 other friend". Only friends' usernames are shown, never anyone else's.

### levelFit

`levelFit = 1 − |itemLevel − userLevel| / 10`, with a floor of 0. Items close to the user's level score higher.

### freshness

`freshness = 1` for items added in the last 7 days, falling linearly to 0 at 30 days.

### New users

For the first 20 reels a user watches, and their first 3 chapters, popularity weighs 0.40 and topicFit only 0.15. The other weights stay as they are.

- **Reels:** the first 20 count as watched whether or not they were finished.
- **Chapters:** the first 3 count once opened.
- **Why:** the app knows little about a new user's interests, so items that others liked are a safer start.

For new users, pillarNeed comes from the onboarding persona answers when there are any.

## 4. Step 3: the reels feed

Sort the candidates by score, then build the feed in pages of 10. While filling each page:

- **Variety:**
  - No more than 2 reels in a row from the same pillar.
  - No 2 reels in a row sharing a tag.
- **Exploration:** every 5th slot is filled by a random candidate instead of the top-scored one. This keeps the feed from narrowing to one topic and gives new reels views.
- **Stretch:** one slot per page may go up to 8 levels above the user, even outside the window. The level-up content is then visible.
- **Fresh feed:** recalculate when the user opens the feed. Within a session, items already shown are never repeated.
- **Reel quiz:** after every 5 reels watched (skips don't count), the feed pauses for a 3-question quiz on those reels (QUESTIONS.md §6, QUIZ.md). Scrolling stays locked until the quiz is finished. If the student leaves, the quiz is waiting when they come back, so the count is kept on the server.

When a reel-quiz question is answered wrong, the answer screen's "Learn more" button points to the top-scored chapter that shares a tag with it.

## 5. Step 3: the chapter library

The library screen has three parts, top to bottom:

1. **Continue reading:** chapters in progress, the most recently opened first. Always shown, and not scored.
2. **Recommended for you:** the top 3 chapters by score, all from different pillars where possible.
3. **All chapters, grouped by pillar:** every chapter in the user's language, including ones above their level. Chapters are never locked behind a level, because learning shouldn't be gated. A chapter whose `requires` isn't finished shows "Read X first" but still opens.

After a Play quiz or a chapter check, a wrong answer can link to the top-scored chapter sharing that question's tag. If there is none, it links to the top reel.

## 6. Duel opponents

**Built so far (P7, Wave 3b):** bot, quick match, friend invites and classroom codes, with the 4 preset reactions, rematch, block and report. Phones follow a duel by polling `/play/duel/<id>/state` about once a second; reactions and rematch offers travel in that poll. Realtime is used only for presence: the Play hub joins `play:lobby` and shows a dot next to friends who are on the hub. Invites show on the friend's Play hub (polled every 5 s there). The schema and matching function are in `supabase/migrations/20261011150000_play_duels.sql` and `20261011191000_play_duel_extras.sql`.

Play owns this section. Reels and Learn don't need to review it.

A student starts a duel in one of three ways:

| Mode | Who you play | Level limit |
| --- | --- | --- |
| Challenge a friend | Someone from `getFriends()` | None |
| Quick match | A random student who is also searching | A rating window that widens while you wait |
| Play the bot | The bot, at your level | — |

A student can be in only one queue or duel at a time.

### Challenge a friend

- **Who appears:** the friend list shows each friend's title and level (never their rating, RATING.md §7). A dot marks friends who are on the Play hub right now (Realtime presence on `play:lobby`, display only).
- **Invites:** an invite expires after 60 seconds. A friend who is offline gets nothing; there are no push notifications.
- **Classroom code:** to play a classmate who isn't a friend yet, the challenger can show a 6-character code, valid for 10 minutes. The other student types it in. This suits NGO and classroom sessions without anyone sharing a phone number.
- **No rating limit:** any rating gap is allowed between friends. The duel XP formula (SCORE.md section 4) already rewards upsets and pays little for beating a much lower level.
- **Pair cap:** only the first 3 duels per pair per day earn XP (SCORE.md).

### Quick match

The student enters the queue with their skill rating and language, and the window of acceptable opponents widens with waiting time:

| Waiting | Opponent's rating | Language |
| --- | --- | --- |
| 0–5 s | within ±50 of yours | Same as yours |
| 5–10 s | within ±100 | Same as yours |
| 10–20 s | within ±150 | Any. While the bank has few te/hi questions, a mixed-language duel falls back to English questions (QUESTIONS.md section 5) |
| 20–30 s | within ±250 | Any, same condition |
| 30 s | — | Offer the bot: "No one's around — play Paisa Bot?" Staying in the queue is also an option. |

**Choosing among candidates.** Several students can fit the window at once. Pick the one with the smallest rating gap, and break ties by who has waited longest.

**Avoid:**
- the same opponent as either of your last 2 quick matches
- anyone you've blocked or reported, or who has blocked you, ever

**Two players claiming the same opponent.** Matching runs in a Postgres function (`play_find_match`) over a `play_queue` table, which locks the rows it reads (`for update skip locked`). When two students both see the same waiting opponent, only one gets them, and the other keeps searching. Presence is used only to show who's online, never to decide matches.

### Bot

- **Name:** always labelled as a bot ("Paisa Bot" with a bot icon). It is never presented as a real student.
- **Rating:** plays at the student's own skill rating.
- **How well it plays:** follows QUESTIONS.md section 5. XP and rating changes are halved (SCORE.md §4, §8).
- **Availability:** always on, so a duel works in the demo even with one phone.

### During and after the duel

- **What opponents see of each other:** username and title only (RATING.md section 7). There's no free-text chat, only 4 preset reactions: 👍, 🔥, 😮 and "GG".
- **Report or block:** available on the result screen. A block means the two are never matched again.
- **Who won each round:** decided on the server (fastest finger, SCORE.md §4). Phones only show it.
- **Rematch:** both players tap "Rematch" within 15 seconds of each other on the result screen (the first tap opens a 15-second offer). The new duel keeps the mode and counts toward the pair cap. Against the bot, Rematch starts a new bot duel.

## 7. Guardrails

- **Educate, never recommend.** The engine recommends lessons, never financial products. Content scores never favour an investment type, brand or fund.
- **Privacy.** Only in-app activity is used: levels, XP, tags, likes and friends. Nothing is inferred about money, family or location. Friend activity is shown only to friends.
- **No dark patterns.** Infinite scroll in the reels feed stops after 3 pages (30 reels) with a "Take a quiz on what you watched?" card leading to Play.

## 8. Who builds what

- **Play** exports `scoreItem(item, user, candidates)` and `buildFeed(candidates, user)` from `src/features/play/index.tsx`. These are pure functions with no database access, and they implement sections 3 and 4. `candidates` is the list the item is ranked in (popularity is normalised over it). An optional last argument `{ now, random }` exists for tests.
- **Reels** loads candidates and engagement, removes reels completed in the last 30 days and reels already shown this session, then calls `buildFeed`. `buildFeed` applies the language and level-window filters (section 2) and the stretch slot itself, and returns the whole ordering; Reels pages it and stops at 30 (section 7).
- **Learn** loads chapters and progress, applies the chapter filters in section 2, then calls `scoreItem(chapter, user, chapters)` for "Recommended for you".
- **Not yet covered:** the English-with-captions fallback (section 2.1): only same-language items are used, and Reels passes reels that exist only in English as the student's version, so te/hi students still get a feed. **Covered in Wave 3b:** persona-based pillarNeed for new users (`RecUser.persona`, used while the user counts as new); `friendsEngaged` from `reels_friends_engaged()` and `learn_friends_engaged()` (counts of the caller's own friends, never who: only when the caller has at least 3 friends and at least 2 of them engaged, so a count can't single out one friend). `recentWrongTags` comes from Play's server-only `getRecentWrongTags()`.
- **Learn's exceptions (agreed in Wave 3a):** chapter `tagInterest` uses only chapters finished in the last 14 days, not reel likes, saves or skips (section 3); and te/hi students see the English chapter until a translated PDF exists (section 2's same-language rule), like Reels.
- **Play** builds duel matchmaking (section 6) entirely in its own feature: `play_queue` and `play_find_match`.
- **The user object they pass in** is built from `getCurrentProfile()`, the per-pillar XP and tag interest from `xp_events` and their own tables, and `getFriends()`.
