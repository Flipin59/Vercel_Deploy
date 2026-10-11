# UI.md — Master UI/UX Spatial & Component Specification
**Application:** FinQuest (Gamified Financial Literacy Platform for High Schoolers)  
**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Supabase + PostgreSQL  
**Audience:** Grades 11–12 Students (Age 16–18, Mobile/Web Native)

This file owns **layout**. Behaviour and numbers come from the specs listed in `docs/TEAM.md` (coins: `QUIZ.md`; XP and rating changes: `SCORE.md`; levels, titles, rating and who sees what: `RATING.md`). If this file disagrees with them, they win.

---

## 1. Global Layout & Structural Shell

All agents must adhere to the standard screen structure below. Every page inside the authenticated zone shares the same layout boundaries to ensure seamless page transitions and consistent visual weight.

### 1.1 Shell Hierarchy
```
+-----------------------------------------------------------------------+
| TOP HEADER (Height: 64px, Sticky/Fixed, z-40)                        |
| [Logo/Back]                  [Streak]     [Coins]    [Friends ❤️🔴]  |
+-----------------------------------------------------------------------+
| MAIN CONTENT VIEWPORT (Scrollable, min-h-[calc(100vh-136px)], pb-24)  |
|                                                                       |
|  [Dynamic Page Content injected here per route]                      |
|                                                                       |
+-----------------------------------------------------------------------+
| INSTAGRAM-STYLE BOTTOM NAVIGATION BAR (Height: 72px, Fixed, z-50)     |
|    [ 🏠 Home ]   [ ⚔️ Play ]   [ 📱 Reels ]   [ 💬 Forum ]   [ 📚 Learn ]|
+-----------------------------------------------------------------------+
```

### 1.2 Routing Map
| Route | Page Name | Primary Owner | Has Bottom Nav? |
| :--- | :--- | :--- | :---: |
| `/login` | Auth / Onboarding | Praveen | No |
| `/dashboard` | Student Command Center | Sashwat | **Yes** (Home active) |
| `/forum/friends` | Friends & Network Hub | Sashwat | No (Has Top Back) |
| `/forum` | Community Forum | Sashwat | **Yes** (Forum active) |
| `/learn`, `/learn/<slug>` | Learn Library & Chapter Reader | Saikiran | **Yes** (Learn active) |
| `/play` | Play Hub: invites, duel entry, practice quiz, simulations | Sanjith | **Yes** (Play active) |
| `/reels` | FinReels Feed | Sai Abhinav | **Yes** (Reels active) |
| `/play/quiz` | Universal Quiz Instance (`QuizRunner`), including the answer review | Sanjith (spec: `QUIZ.md`) | No (Self-contained) |
| `/play/sim/<id>` | Solo simulation, e.g. `/play/sim/survive-month` (`SimRunner`) | Sanjith | **Yes** (Play active) |
| `/play/duel` | Quick-match waiting screen | Sanjith | **Yes** (Play active) |
| `/play/duel/<id>` | Duel arena, invite wait and result (page 6) | Sanjith | **Yes** (Play active) |

---

## 2. Global Component Specifications

### 2.1 Top Header Bar (`src/shared/ui/Header.tsx`)
* **Left Anchor:** FinQuest logo with the student's title badge (e.g. "Silver 2") or a `[ ← Back ]` button on sub-pages (`/forum/friends`).
* **Center/Right Stat Pills:**
  * **Streak Pill:** Flame icon + `"X-Day Streak"`.
  * **Coins Pill:** Coin icon + the student's own balance (e.g., `"325"`). Coin rules: `QUIZ.md` §6.
  * **Friends Heart Button:** Heart icon with an **Instagram-style notification dot** at the top-right corner (`absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full animate-ping` alongside a solid dot) that appears whenever `pendingRequestsCount > 0`. Clicking navigates to `/forum/friends`.

### 2.2 Bottom Navigation Dock (`src/shared/ui/BottomNav.tsx`)
* Fixed at screen bottom (`fixed bottom-0 left-0 right-0 h-18 bg-[#151D2F]/95 backdrop-blur-lg border-t border-slate-800`).
* Exactly 5 evenly spaced touch targets:
  1. `[ 🏠 Home ]` $\rightarrow$ `/dashboard`
  2. `[ ⚔️ Play ]` $\rightarrow$ `/play`
  3. `[ 📱 Reels ]` $\rightarrow$ `/reels`
  4. `[ 💬 Forum ]` $\rightarrow$ `/forum`
  5. `[ 📚 Learn ]` $\rightarrow$ `/learn`
* Active tab has an active indicator dot underneath and highlighted state.

---

## 3. Page-by-Page Layout Specifications

---

### Page 1: Auth & Onboarding (`/login`)
**Responsibility:** Praveen  
**Objective:** Simple entry: email + password. Sign-up sends one email-verification link; there is no OTP to type at each sign-in.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [Top Brand Header]                                                    |
|                                                                       |
|                     +-------------------------------+                 |
|                     |     WELCOME TO FINQUEST     |                 |
|                     | Level Up Your Financial IQ 🚀 |                 |
|                     +-------------------------------+                 |
|                     |  [  Sign In* ]   [  Sign Up  ] |  <- Pill Switch|
|                     +-------------------------------+                 |
|                     |                               |                 |
|                     | [ IF SIGN IN ACTIVE ]         |                 |
|                     | Email:    [ user@domain.com ] |                 |
|                     | Password: [ •••••••••••••   ] |                 |
|                     |                               |                 |
|                     | [ IF SIGN UP ACTIVE ]         |                 |
|                     | Email:    [ user@domain.com ] |                 |
|                     | Username: [ @username       ] |                 |
|                     | Password: [ •••••••••••••   ] |                 |
|                     |                               |                 |
|                     | [     ENTER DASHBOARD 🚀     ] |                 |
|                     +-------------------------------+                 |
+-----------------------------------------------------------------------+
```
#### Key States:
1. **Tabs:** Switcher controls form inputs dynamically without page reload.
2. **Error State:** Shake animation on the card with inline amber toast if invalid credentials; user stays on screen.
3. **Success State:** Micro particle/confetti animation, then onboarding (new students: language, grade, persona questions, optional placement quiz) or `/dashboard`.

---

### Page 2: Student Command Center (`/dashboard`)
**Responsibility:** Sashwat  
**Objective:** High-level gamification overview and launcher.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [Top Header: Logo | Streak Pill | Coin Counter | Heart🔴 Friends]     |
+-----------------------------------------------------------------------+
|                                                                       |
|  CELL 1: PROFILE STATUS BAR (Full width card)                         |
|  +------------------------------------------------------------------+ |
|  | [Avatar]  Username                        [ 🛡️ TITLE BADGE ]      | |
|  |           Level X · Rating 1012 (skill)     🔥 Streak            | |
|  |           [ Progress Bar: % to next level ]                      | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  CELL 2: LEADERBOARD WIDGET (Full width card)                         |
|  +------------------------------------------------------------------+ |
|  | THIS WEEK                 [ Global 🌍 | Friends 👥* ]  <- Slider   | |
|  | ---------------------------------------------------------------- | |
|  | #1  [Avatar]  username                     [ Gold 3 ]            | |
|  | #2  [Avatar]  username                     [ Silver 1 ]          | |
|  | #3  [Avatar]  You                          [ Silver 2 ]      👑  | |
|  | #4  [Avatar]  username                     [ Bronze 1 ]          | |
|  | #5  [Avatar]  username                     [ Silver 3 ]          | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  CELL 3: CONTINUE + PILLAR BARS                                       |
|  +------------------------------------------------------------------+ |
|  | [ ▶ Reels ]  [ 📖 Chapter in progress ]  [ ⚔️ Play ]  + 4 bars   | |
|  +------------------------------------------------------------------+ |
|                                                                       |
| [FIXED BOTTOM NAV DOCK: 🏠 Home | ⚔️ Play | 📱 Reels | 💬 Forum | 📚 Learn] |
+-----------------------------------------------------------------------+
```
#### Key States:
* The first visit each IST day fires a `+10 coins daily login bonus` toast (`QUIZ.md` §6).
* Leaderboard slider swaps between `global` and `friends` lists without full page reload. Both rank by XP earned in the last 7 days and show rank, username and title only — no XP, rating, coins or school (`RATING.md` §7). The student's own rank is always shown.

---

### Page 3: Friends & Connect Hub (`/forum/friends`)
**Responsibility:** Sashwat  
**Objective:** Manage social graph, search users, handle incoming requests.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [ ← Back to Dashboard ]   FRIENDS & NETWORK     [ 👥 Total: X Friends ]|
+-----------------------------------------------------------------------+
|                                                                       |
|  CELL 1: SEARCH BAR                                                   |
|  [ 🔍 Search by username... (e.g. "rahul_11")                      ]  |
|                                                                       |
|  CELL 2: SEARCH RESULTS CONTAINER (Renders 5 Closest Fuzzy Matches)   |
|  +------------------------------------------------------------------+ |
|  | [Avatar] User_One       [ Silver 2 ]        [ + Connect ]        | |
|  | [Avatar] User_Two       [ Bronze 3 ]        [ Request Pending ]  | |
|  | [Avatar] User_Three     [ Gold 1 ]          [ Already Friends ]  | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  CELL 3: PENDING REQUEST QUEUE (Awaiting User Action)                 |
|  +------------------------------------------------------------------+ |
|  | [Avatar] Requester_Name wants to connect! [ Silver 2 ]          | |
|  |          [ ✅ Accept (Emerald) ]       [ ❌ Decline (Muted) ]    | |
|  +------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```
#### Key States:
* `Accept` increments total friend count, removes item from queue, and clears the red dot on Dashboard if queue is empty.
* Real-time search debounced at 300ms.

---

### Page 4: FinReddit Community Forum (`/forum`)
**Responsibility:** Sashwat  
**Objective:** Asynchronous discussion, Q&A, peer learning.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [Top Header]                                      [ ✍️ Start Thread ]|
+-----------------------------------------------------------------------+
|                                                                       |
|  CELL 1: SEARCH & FILTER BAR                                          |
|  [ 🔍 Search threads: "UPI scam", "SIP", "Pocket money"...          ] |
|  Filter Chips: [ All* ] [#Budgeting] [#FraudAlert] [#MutualFunds]     |
|                                                                       |
|  CELL 2: SUGGESTED THREADS LIST (Cards)                               |
|  +------------------------------------------------------------------+ |
|  | [ ▲ Upvotes ]  Thread Title Heading                              | |
|  | [ ▼         ]  Author [title] • Timestamp • Comment Count         | |
|  |                Tags: [#Tag1] [#Tag2]                             | |
|  +------------------------------------------------------------------+ |
|                                                                       |
| [FIXED BOTTOM NAV DOCK: 🏠 Home | ⚔️ Play | 📱 Reels | 💬 Forum* | 📚 Learn]|
+-----------------------------------------------------------------------+
```
#### Thread Detail View (Child route or modal):
* Displays full original post + upvote widget at top.
* Bottom input field: `[ Add a comment... ]`. Forum activity gives a little XP (`SCORE.md` §6), never coins.
* Comment tree listed chronologically.

---

### Page 5: Learn Library & Chapter Reader (`/learn`, `/learn/<slug>`)
**Responsibility:** Saikiran  
**Objective:** Visual knowledge map recommending chapters, plus the full library.

#### Spatial Structure (Recommended chapters as bubbles; nothing is locked)
```
+-----------------------------------------------------------------------+
| [Top Header]                                      [ Zoom: -  +  Reset ]
| [ 🔍 Search all chapters...                                         ] |
+-----------------------------------------------------------------------+
|                                                                       |
|  CELL 1: INTERACTIVE SOLAR SYSTEM BUBBLE CANVAS                       |
|                                                                       |
|                        (   UPI Safety 🛡️  )                           |
|                         (  Radius: 50px   )                           |
|                                                                       |
|               +-----------------------------+                         |
|               |                             |                         |
|               |    COMPOUND INTEREST 🌟     |  <- Center Bubble       |
|               |       (Radius: 95px)        |     (Largest = Highest  |
|               |      [CLICK TO READ]        |      Relevance)         |
|               |                             |                         |
|               +-----------------------------+                         |
|                                                                       |
|    ( Needs vs Wants 📊 )                    ( Gold & Inflation 🪙 )   |
|      ( Radius: 65px )                         ( Radius: 60px )        |
|                                                                       |
|  *(RULE: Chapters are never locked. Bubbles = "Recommended for you"; |
|   radius from scoreItem. Below the canvas: Continue reading, then    |
|   every chapter grouped by pillar — RECOMMENDATION.md §5)*           |
|                                                                       |
| [FIXED BOTTOM NAV DOCK: 🏠 Home | ⚔️ Play | 📱 Reels | 💬 Forum | 📚 Learn*]|
+-----------------------------------------------------------------------+
```

#### Custom PDF Reader Modal (Triggered on bubble click):
```
+-----------------------------------------------------------------------+
| [ ← Back to Library ]  Chapter: The Magic of Compounding  [ Page 1/4 ]|
| Reading Progress Bar: [████████████████████░░░░░░░░░░] 60%            |
+-----------------------------------------------------------------------+
| [ PDF VIEWER FRAME / CONTENT WINDOW ]                                 |
|                                                                       |
| ... Content sections ...                                              |
|                                                                       |
| --------------------------------------------------------------------- |
| [ 🎉 CHAPTER DONE! END MODULE → TAKE THE 5-QUESTION CHECK 🎯 ]       |
+-----------------------------------------------------------------------+
```
#### Key Integration Rule:
* Clicking the End Module button opens `/play/quiz` via `quizHref({ context: "chapter", chapterSlug, returnTo })` from `@/features/play` (`QUIZ.md` §1). Coins, XP and rating follow `QUIZ.md` and `SCORE.md`.

---

### Page 6: 1v1 Gulag Duel Arena (`/play/duel/<id>`)
**Responsibility:** Sanjith  
**Objective:** High-speed real-time 1v1 quiz match.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [Top Header]               ROUND X OF Y               [ GULAG DUEL ]  |
+-----------------------------------------------------------------------+
|                                                                       |
|  CELL 1: SPLIT COMBATANTS BAR                                         |
|  Player 1 (You)                COUNTDOWN TIMER               Opponent |
|  [Avatar] You                 [     30s     ]         Opponent [Avatar]|
|  Rating 1012                 (Ticking bar)              [ Silver 2 ] |
|  Score: 3,450                                             Score: 2,980|
|                                                                       |
|  CELL 2: QUESTION CARD                                                |
|  +------------------------------------------------------------------+ |
|  | Question text here                                               | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  CELL 3: 2x2 MCQ GRID                                                 |
|  +--------------------------------+--------------------------------+  |
|  | [ A ] Option Text              | [ B ] Option Text              |  |
|  +--------------------------------+--------------------------------+  |
|  | [ C ] Option Text              | [ D ] Option Text              |  |
|  +--------------------------------+--------------------------------+  |
|                                                                       |
|  [ IF YOU ARE FIRST & CORRECT ]:    [ IF YOU CLICK WRONG OPTION ]:    |
|    ⭐ +100 SPEED COMBO POPUP          🔒 LOCKED / FROZEN OVERLAY!     |
|                                                                       |
| [FIXED BOTTOM NAV DOCK: 🏠 Home | ⚔️ Play* | 📱 Reels | 💬 Forum | 📚 Learn]|
+-----------------------------------------------------------------------+
```
#### Key States:
* Fastest finger (`SCORE.md` §4): the first correct answer to reach the server takes the round (100 + speed bonus); the server decides who was first, not the phone.
* Wrong answer triggers a freeze for the remainder of the round.
* The student sees their own rating; the opponent shows only their title (`RATING.md` §7).

---

### Page 7: FinReels Feed (`/reels`)
**Responsibility:** Sai Abhinav  
**Objective:** Vertical short-form educational feed with gesture controls.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [Top Header]                FINREELS                 [ ⚡ 4/5 Watched ]|
+-----------------------------------------------------------------------+
|                                                                       |
|  CELL 1: 9:16 VERTICAL VIDEO CARD CONTAINER                           |
|  +----------------------------------------+  CELL 2: ACTION RAIL      |
|  |                                        |  (Stacked Right)          |
|  |                                        |  [ ❤️ 12.4k ] Like        |
|  |                                        |  [ 🔖 Save  ] Bookmark    |
|  |         VIDEO PLAYBACK AREA            |  [ 📤 Share ] To Friends  |
|  |                                        |  [ 📖 Deep  ] Go to chapter|
|  |                                        |                           |
|  | -------------------------------------- |                           |
|  | @CreatorName • Duration                |                           |
|  | #Hashtag1 #Hashtag2                    |                           |
|  +----------------------------------------+                           |
|                                                                       |
| [FIXED BOTTOM NAV DOCK: 🏠 Home | ⚔️ Play | 📱 Reels* | 💬 Forum | 📚 Learn]|
+-----------------------------------------------------------------------+
```
#### Key Gesture & Gate Rules:
1. **Double Tap:** Trigger floating heart animation, like video.
2. **Press & Hold (Center):** Pause video, hide UI overlay.
3. **Press & Hold (Top Right):** Toggle 2x speed with indicator.
4. **5-Reel Gate:** After 5 reels are viewed (skips under 3 s don't count), open `/play/quiz` via `quizHref({ context: "reel", reelIds, returnTo: "/reels" })` for those 5 reels (3 questions, `QUESTIONS.md` §6); block further scrolling until finished. If the student leaves, the quiz is waiting when they return.
5. **30-Reel Stop:** after 30 reels in a session, show a "Take a quiz on what you watched?" card instead of more reels (`RECOMMENDATION.md` §7).

---

### Page 8: Universal Quiz Instance (`/play/quiz`)
**Responsibility:** Sanjith — `QuizRunner`, behaviour specified in `QUIZ.md`  
**Objective:** Standard assessment engine invoked by Learn, Reels, Play practice and onboarding.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [ ✕ Exit Quiz ]             ⏱️ 30s Timer             Question X of Y  |
| Progress Bar: [████████████████████████████░░░░░░░░░░░]               |
+-----------------------------------------------------------------------+
|                                                                       |
|  CELL 1: QUESTION CARD                                                |
|  +------------------------------------------------------------------+ |
|  | Question stem text goes here...                                  | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  CELL 2: 2x2 MCQ OPTIONS GRID                                         |
|  +--------------------------------+--------------------------------+  |
|  | [ A ] Option Text              | [ B ] Option Text              |  |
|  +--------------------------------+--------------------------------+  |
|  | [ C ] Option Text              | [ D ] Option Text              |  |
|  +--------------------------------+--------------------------------+  |
|                                                                       |
|  [ POPUP IF WRONG ANSWER ]:                                           |
|  +------------------------------------------------------------------+ |
|  | ❌ Incorrect!                                                    | |
|  | [ 🪙 Wager 1 Coin to Reattempt ]   |   [ 📖 Show Solution & Skip ]| |
|  +------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

#### Completion Screen:
```
+-----------------------------------------------------------------------+
|                           QUIZ COMPLETED!                             |
|                           🎯 Score: A / Y                             |
|                                                                       |
|                     +X Coins Earned! 🪙   +X XP                       |
|                     Rating: 1012 (▲ +8 green / ▼ -5 red)              |
|                                                                       |
|   [ 📊 Review Detailed Answers ]          [ 🚀 End Quiz ]             |
+-----------------------------------------------------------------------+
```
* Clicking `[ 📊 Review Detailed Answers ]` switches the quiz screen to the review (page 9); no navigation.
* Clicking `[ 🚀 End Quiz ]` returns to whoever opened the quiz (reel feed, chapter, Play hub or onboarding).
* A timed-out question counts as wrong; the reattempt popup is still offered (`QUIZ.md` §3). The reattempt button is disabled at 0 coins.

---

### Page 9: Quiz Detailed Answer Review (a view of `/play/quiz`)
**Responsibility:** Sanjith  
**Objective:** In-depth pedagogical review of attempted questions.

#### Spatial Structure
```
+-----------------------------------------------------------------------+
| [ ← Back to Summary ]       REVIEW ANSWERS               Score: A / Y |
+-----------------------------------------------------------------------+
|                                                                       |
|  FOR EACH QUESTION (1 through Y):                                     |
|  +------------------------------------------------------------------+ |
|  | Question N of Y                                   [ Result Badge ] |
|  | Topic: Topic Name Tag                                            | |
|  | Question: Full question text...                                  | |
|  |                                                                  | |
|  | Options List:                                                    | |
|  |  ( ) Option A                                                    | |
|  |  (•) Option B  <-- Highlighted [ ✅ Your Choice - Correct ]       | |
|  |  ( ) Option C                                                    | |
|  |  ( ) Option D                                                    | |
|  |                                                                  | |
|  |  💡 EXPLANATION BOX:                                             | |
|  |  Detailed reasoning why the correct answer is right and why      | |
|  |  the common pitfalls occur in real financial life.               | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  +------------------------------------------------------------------+ |
|  |               [ 🚀 END QUIZ (back to caller) ]                   | |
|  +------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

#### Visual Highlighting Rules:
* User picked correct: Option container gets green border + `[ ✅ Your Answer - Correct ]`.
* User picked wrong: User's option gets red border + `[ ❌ Your Choice ]`, and true answer gets dashed green border + `[ ✅ Correct Answer ]`.

---

## 4. Shared Data Contracts

The TypeScript types live in `src/shared/types.ts` and `src/shared/rating.ts` (`IMPLEMENTATION.md` S1, S2). What each screen needs from them:

* **Header / dashboard (the student's own data):** username, level, progress %, title (e.g. "Silver 2"), skill rating, streak days, coin balance, pending friend-request count. From `getXpSummary()` and `getPendingRequestCount()`.
* **Leaderboard row:** rank, username, title, `isCurrentUser`. No XP, rating, coins or school (`RATING.md` §7).
* **Other students anywhere (forum, friends, duel opponent):** username and title only; friends also see level.
* **Chapter bubble:** slug, title, pillar, score from `scoreItem` (drives the radius). There is no `isUnlocked` — chapters are never locked.
* **Quiz question on the phone:** id, topic tag, prompt, options A–D. The correct answer and explanation arrive only in the `submitAnswer()` result, after the student answers (`IMPLEMENTATION.md` §6).
* **Quiz end screen:** a / y, coins earned, XP earned, rating and rating change (`QUIZ.md` §4).

---

## 5. Summary Rule for All Subagents
1. **Never invent custom header/footer placements.** Use the global shell.
2. **Never lock chapters.** Every chapter is reachable; the galaxy only highlights recommendations.
3. **Honor the Friends Heart Notification Dot.** Always display the dot if `pendingRequestsCount > 0`.
4. **Open the quiz with `quizHref()`** (`QUIZ.md` §1), passing the context and topics. Reels, the chapter reader and onboarding all hand off to the same `/play/quiz` screen; nobody imports `QuizRunner` directly.
5. **Never show another student's XP, rating or coins.** Titles only (`RATING.md` §7).
