# Health House — Online Midwifery Learning Portal

A complete **Learning Management System** for a six-semester midwifery programme,
rebuilt in **Next.js 15 (App Router, TypeScript) + PostgreSQL**. It is a
one-to-one port of the original PHP 8 / MySQL portal: every screen, query,
progress rule, upload flow, rich-text editor, Pashto (right-to-left) feature and
the immersive lesson reader were carried across, and the live MySQL database was
converted into the PostgreSQL seed.

> **Key principle:** this is a *learning* management system, **not** an attendance system.
> The timetable only recommends when to study. Students are never marked absent, never
> penalised and never blocked for studying at a different time.

---

## 1. What is included

```
health-house/
├── app/                      Next.js App Router
│   ├── page.tsx              Public landing page
│   ├── login/  logout/       Authentication (signed HttpOnly cookie session)
│   ├── search/               Curriculum search
│   ├── student/              11 student screens  (dashboard, courses, subject, lesson,
│   │                         quiz, result, results, progress, saved, timetable, profile,
│   │                         continue)
│   ├── admin/                13 administrator screens (dashboard, semesters, subjects,
│   │                         lessons, lesson editor, quizzes, quiz editor, results,
│   │                         students, student detail, timetable, progress, settings,
│   │                         curriculum loader)
│   ├── api/upload            Chunked media upload endpoint (2 MB pieces)
│   ├── api/subtitle          Serves WebVTT caption tracks
│   └── uploads/[...path]     Serves uploaded files (Range requests, correct MIME types)
├── components/               Shell (sidebar + topbar), UI primitives, rich editor, uploader
├── lib/                      db, auth, session, progress engine, media, rich-text
│                             sanitiser, uploads, timetable/subtitles/bookmarks, curriculum
├── styles/                   The complete design system (light + dark), unchanged
├── public/js/                The interaction layer (theme, reader, editor, uploader,
│                             subtitles) — vanilla JS, re-bound on every client navigation
├── database/
│   ├── schema.sql            PostgreSQL table structure
│   └── seed.sql              Live content converted from the MySQL dump
├── data/curriculum/*.json    The 121-lesson Pashto Semester 1 syllabus (for the loader)
├── scripts/
│   ├── db-setup.mjs          Creates the tables and loads the seed
│   └── convert-mysql-dump.mjs  Converts a phpMyAdmin dump of the old portal
└── uploads/                  videos / pdfs / slides / resources / avatars (runtime storage)
```

---

## 2. Run it locally

Requirements: **Node.js 20+** and **PostgreSQL 14+** (a local install, Docker, or a
hosted database such as Neon / Supabase / Railway).

```bash
# 1. dependencies
npm install

# 2. configuration
cp .env.example .env.local        # then edit DATABASE_URL and SESSION_SECRET

# 3. database: creates every table and loads the seed content
npm run db:setup

# 4. start
npm run dev                       # http://localhost:3000
```

If you do not have PostgreSQL installed, `docker compose up -d` starts one that
matches the default `DATABASE_URL` in `.env.example`.

### Demo accounts

| Role          | Email                  | Password     |
| ------------- | ---------------------- | ------------ |
| Administrator | `admin@midwifery.edu`  | `admin123`   |
| Student       | `sara@student.edu`     | `student123` |
| Student       | `nadia@student.edu`    | `student123` |
| Student       | `fatima@student.edu`   | `student123` |
| Student       | `zahra@student.edu`    | `student123` |

**Change these passwords before going live.** The password hashes from the PHP
portal (`$2y$` bcrypt) are accepted as-is, so every existing account keeps its password.

---

## 3. Environment variables

| Variable          | Purpose |
| ----------------- | ------- |
| `DATABASE_URL`    | PostgreSQL connection string |
| `DATABASE_SSL`    | Set to `require` for hosts that need TLS (Neon, Supabase, Render …) |
| `SESSION_SECRET`  | Long random string that signs the session cookie |
| `UPLOAD_DIR`      | Folder for uploaded files (default `./uploads`); must be writable and persistent |
| `MAX_UPLOAD_SIZE` | Upload limit in bytes (default 200 MB) |
| `APP_TIMEZONE`    | Timezone for every displayed date (default `Asia/Kabul`) |
| `APP_NAME`, `APP_SHORT`, `APP_INSTITUTION` | Branding shown in the sidebar and public pages |

---

## 4. Deploy

```bash
npm run build
npm start                         # NODE_ENV=production
```

Any Node host works (a VPS with pm2/systemd, Railway, Render, Fly.io, Docker …).
Two things to keep in mind:

* **Uploads live on disk** under `UPLOAD_DIR`. Use a persistent volume, or point it
  at a mounted disk. Serverless platforms with a read-only filesystem (e.g. Vercel)
  will run the app but not store uploads; keep videos on YouTube/Vimeo there.
* Run `npm run db:setup` once against the production database (it **drops and
  recreates** every table — never run it on a database with content you want to keep;
  use `npm run db:schema` for tables only).

### Bringing content over from the PHP portal

Export the old MySQL database from phpMyAdmin, then:

```bash
node scripts/convert-mysql-dump.mjs path/to/dump.sql database/seed.sql
npm run db:setup
```

The converter carries every table across (accounts, progress, quizzes, materials,
subtitles, timetable, announcements …) and resets the identity sequences.

---

## 5. How the learning model works

```
Six semesters → Subjects → Ordered lessons → Video / PDF / Slides / Text
      → Quiz → Lesson completion → Subject progress → Semester progress
      → Six-semester overall progress
```

Progress is always *completed lessons ÷ active lessons* (`lib/progress.ts`):

* **Subject progress** — lessons completed in that subject.
* **Semester progress** — lessons completed across every subject of the semester.
  A semester with no published lessons reads as **locked** and unlocks by itself
  the moment its curriculum is loaded.
* **Overall progress** — lessons completed across all six semesters.

A lesson becomes `in_progress` the moment a student opens it and `completed` when
the student presses **Mark as completed** — or automatically when they pass a quiz
attached to that lesson. **Continue Learning** walks semester → subject → lesson
order, preferring lessons already in progress and the student's own semester.

---

## 6. Administrator guide

| Screen                 | What it does |
| ---------------------- | ------------ |
| **Dashboard**          | Cohort totals, per-semester completion, recommended-vs-actual, recent activity |
| **Semesters**          | Create / edit / hide the six semesters |
| **Subjects**           | Subjects per semester, accent colour, credits, display order |
| **Lessons & sequence** | Set **Order** and **Day** for every lesson, inline |
| **Lesson editor**      | Rich text (LTR + RTL), video (YouTube / Vimeo / Drive / Dailymotion / direct / upload), materials, Pashto subtitles |
| **Curriculum loader**  | Rebuilds the full 121-lesson Pashto Semester 1 and generates the Pashto caption tracks |
| **Quizzes / editor**   | Passing score, attempt limit, time limit, shuffle; single, multiple and true/false questions |
| **Students / detail**  | Accounts, passwords, student codes, semester assignment, bulk move, per-student progress |
| **Timetable**          | Optional weekly recommendation per semester |
| **Progress monitor**   | By student, by subject, and *recommended vs actual today* |
| **Results**            | Every completed attempt across the programme |
| **Settings**           | Admin profile, password, portal details, announcements, system info |

### Uploading lesson videos

The lesson editor sends files to `/api/upload` in **2 MB pieces**
(`public/js/hh-uploader.js`), so large lectures are never blocked by a request
size limit. Accepted: `mp4`, `webm`, `ogv`, `ogg`, `mov`, `m4v`, `mkv`, `avi`.
Pasted links are recognised automatically (YouTube incl. `youtu.be` / Shorts,
Vimeo, Google Drive, Dailymotion, direct `.mp4`).

### Pashto / Dari / Arabic

The editor detects the script as you type; every lesson has a **Text direction**
setting (automatic / RTL / LTR). Direction is resolved on the server and written
into the markup as `dir="rtl" lang="ps"` so the layout mirrors and the Arabic
font is used. Subtitles are stored as WebVTT: a real `<track>` on uploaded
videos, and a synchronised caption bar + clickable transcript over embedded players.

---

## 7. Student guide

* **Dashboard** — Continue Learning banner, stat tiles, ongoing courses, today's
  recommendation, six-semester rail, announcements.
* **Courses** — semester pills (locked ones dashed), subject rows with Start / Continue / Review.
* **Subject** — the ordered lesson sequence, plus a *by recommended day* view.
* **Lesson** — three columns: course content, the lesson (video, subtitles, text,
  materials, quiz, previous/next), next-lesson and details. **R** opens the
  full-screen reader (book or scroll mode), **F** toggles full-page mode,
  **Alt + ← / →** moves between lessons, **/** focuses search.
* **Quiz** — instant grading, optional countdown, full answer review with explanations.
* **Saved lessons**, **Results**, **Six-semester progress**, **Calendar**, **Profile**.

---

## 8. Security

* Passwords hashed with bcrypt; PHP `$2y$` hashes remain valid.
* Session in a signed (`jose` HS256) HttpOnly, SameSite=Lax cookie.
* Every write goes through a **Server Action** (same-origin enforced by Next.js);
  the upload API additionally checks the request origin.
* All database access uses parameterised queries (`pg`).
* Admin-authored HTML is whitelist-sanitised (`sanitize-html`): `<script>`,
  `<iframe>`, `on…` handlers and `javascript:` links are stripped.
* Uploads are extension-whitelisted, renamed, served with `nosniff`, and never executed.
* Role separation is enforced server-side on every page and action.

---

## 9. Customising the look

Everything is driven by CSS custom properties at the top of `styles/app.css`
(`--brand`, `--teal`, `--amber`, …). Dark theme tokens live under
`html[data-theme="dark"]`. All animations respect `prefers-reduced-motion`.
