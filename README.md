# EPR Support Wiki

A mobile-first wiki that renders step-by-step support guides for an Electronic Patient Record
(EPR) system. Guides are plain Markdown files; the folder structure they sit in becomes the
site's navigation.

**Proof of concept.** No authentication, no search, no server-side code.

- **Readers** need nothing but a browser. Start at [Welcome](content/01-getting-started/01-welcome.md).
- **Content maintainers** want [Adding content](#adding-content) below.
- **Whoever deploys it** wants [Deploying](#deploying).

---

## How it works

The app is a static React bundle. It has no back end and no API — at runtime it only ever
performs HTTP `GET` requests for files under `content/`.

Because a static app cannot list a directory, `content/manifest.json` describes the folder
tree. The app fetches it on load and builds the navigation from it. Guide text is *not* in the
manifest; each `.md` file is fetched on demand when a reader opens it.

```
<webroot>/
├── index.html          ← the built app
├── assets/             ← built JS/CSS
└── content/            ← everything a maintainer touches
    ├── manifest.json   ← the folder tree (generated, or hand-edited)
    ├── 01-getting-started/
    │   └── 01-welcome.md
    └── appointments/
        ├── book-an-appointment.md
        └── media/
            └── booking.mp4
```

---

## Running it locally

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, with `content/` served from the project root at `/content/`. |
| `npm run manifest` | Regenerates `content/manifest.json` from the local `content/` folder. |
| `npm run import:docx` | Converts a Word document into a guide plus extracted images. |
| `npm run build` | Builds the static bundle into `dist/`. Type-checks first. |
| `npm run preview` | Serves the built bundle locally for a final check before deploying. |

`npm run manifest` is an **admin-time tool that runs on your own machine**. The web server never
runs it and does not need Node.js installed — it only serves static files.

---

## Adding content

1. Write the guide as a `.md` file, starting with a single `#` heading. That heading becomes the
   title shown in the menu.
2. Save it in the right category folder inside your local `content/`, creating folders as needed.
   Lowercase names with hyphens — **the file name becomes part of the web address**.
3. Put images and video in a `media/` folder beside the guide and link to them relatively:
   `![The search screen](./media/search.png)`. Media files need **no** manifest entry.
4. Run `npm run manifest`.
5. Upload the whole `content/` folder to the web server, **overwriting** what is there.
6. Reload the site.

There is a full authoring reference in the seed content itself:
[Formatting Reference](content/02-for-administrators/formatting-reference.md) and
[Images and Video](content/02-for-administrators/media-examples/images-and-video.md).

### Importing from Word

```bash
npm run import:docx -- "path/to/guide.docx" --into 03-my-category --names "first-shot,second-shot"
```

Add `--dry-run` to print the Markdown without writing anything — always worth doing first.

It converts text **verbatim**, including typos, and does not summarise or tidy. The only
structural change is promoting the document's own bold, larger-than-body paragraphs to `##`
headings; that text is matched, never retyped. Images are extracted to `media/`, deduplicated by
content hash (Word often stores the same picture two or three times), and named from `--names` in
first-appearance order.

What it cannot carry across, and will tell you about:

- **Text-box callouts lose their arrows.** Word guides often label a screenshot with floating
  text boxes joined by arrow shapes. The words survive as ordinary paragraphs, but a label like
  "click here" no longer points at anything. Check every converted callout still makes sense.
- **SmartArt, WordArt and embedded objects** are dropped.
- **Alt text.** Word's auto-generated "A screenshot of a computer…" is discarded rather than
  published as if it were real alt text, so imported images start with empty `alt`. Add
  descriptions if screen-reader users need them.
- `.emf`/`.wmf` images (screenshots pasted straight from Windows) cannot be displayed by
  browsers and will need re-exporting as PNG.

### Media that is not safe to publish yet

`content/.needs-replacing.json` lists imported media known to contain identifiable data. On every
run, `npm run manifest` re-hashes each listed file and **fails with exit code 2** while any of them
is still byte-identical to the flagged original:

```
========================================================================
  DO NOT UPLOAD YET
========================================================================
```

Replace the file with a capture from a training/PLAY environment using fictional patients, then
delete its entry from the list. The check is by content hash, so a genuine replacement clears
itself with no bookkeeping.

Flagged files are also listed in `.gitignore`. That is deliberate: committing them would put the
data in git history permanently, where it would survive replacing the file and travel with every
clone. Remove both the `.gitignore` lines and the JSON entry once the images are clean.

> This matters because the site has **no authentication**. There is no "internal only" —
> uploading a file publishes it to anyone who can reach the URL.

### Prefixing names to control order

`01-`, `02-` prefixes on files and folders set the order in the menu and are stripped from the
displayed title. `01-getting-started/` shows as "Getting Started".

### When the manifest must be regenerated

The manifest describes **structure only**.

| What changed | Regenerate? |
| --- | --- |
| The words inside an existing guide | **No** — just re-upload the `.md` file |
| A guide or folder added, deleted, renamed or moved | **Yes** |
| A guide's `#` heading | **Yes** |

### Editing the manifest by hand

The format is deliberately simple enough for Notepad. A folder has `children`; a guide does not.
`name` must match the real file or folder name exactly, including `.md`.

```json
{
  "version": 1,
  "tree": [
    {
      "type": "folder",
      "name": "appointments",
      "title": "Appointments",
      "children": [
        { "type": "guide", "name": "book-an-appointment.md", "title": "Book an Appointment" }
      ]
    }
  ]
}
```

`title` is optional — without it the app derives one from the name. Folder titles you edit here
by hand are preserved when you next run `npm run manifest`; guide titles are re-read from each
file's `#` heading.

If the site shows "Content not available", it will name the exact problem — including
"not valid JSON", which almost always means a stray comma or an unclosed bracket.

---

## Deploying

The two deployables are independent.

| Folder | Contains | Upload when |
| --- | --- | --- |
| `dist/` | The built app | App **code** changed |
| `content/` | All `.md` files, media, and `manifest.json` | **Content** changed |

- **First deploy:** copy the *contents* of `dist/` to the webroot, then copy the `content/`
  folder in beside `index.html`.
- **Content update:** upload `content/` only.
- **Code update:** run `npm run build`, upload `dist/` only.

`content/` is not bundled into `dist/`, so a content update never needs a rebuild and a code
update never risks overwriting live content.

### Deep links need no server configuration

The app uses **hash routing**, so a guide's address looks like:

```
https://example.nhs.uk/#/wiki/appointments/book-an-appointment
```

Everything after `#` is never sent to the server, so bookmarks and shared links work on any
static host — IIS, Apache, nginx, a file share — with **no rewrite rule and no configuration**.
Asset paths are relative, so the app also works from a subfolder (`/epr-wiki/`) unchanged.

<details>
<summary>Switching to clean URLs (optional, needs host configuration)</summary>

If the host can be configured, swap `HashRouter` for `BrowserRouter` in `src/main.tsx` and add a
rewrite sending everything that is not a real file to `index.html` (on IIS, a URL Rewrite rule;
on Apache, `FallbackResource /index.html`). Without that rewrite, deep links return 404 —
which is exactly why hash routing is the default.
</details>

### Directory browsing — worth asking about

If the host has **directory browsing / autoindex** enabled for the `content/` path (on IIS, the
"Directory Browsing" feature), the app could in principle read the listing directly and the
manifest would become unnecessary. This build does **not** rely on that, because it is off by
default on most hosts and its HTML output is not standardised. Worth confirming with whoever
administers the hosting before investing in the manifest workflow long-term.

---

## Things to know before relying on this

- **No authentication.** Anything published is readable by anyone who can reach the site. Do not
  put patient data or anything access-controlled in `content/`.
- **Upload must overwrite.** Many FTP clients skip files that already exist by default. A new
  guide plus a stale `manifest.json` means the guide never appears.
- **Your local `content/` is the source of truth.** If someone adds a file directly on the
  server, the next `npm run manifest` run on your machine will not know about it and will write
  a manifest that omits it. Add guides locally, or hand-edit the manifest on the server.
- **Deleting a manifest entry only hides a guide.** The file stays on the server and remains
  readable by anyone with the address. If a guide is withdrawn because it is clinically out of
  date, **delete the file from the server as well**.
- **No search.** Readers browse by category. This is the most likely next feature.
- **Allowed file types:** `.md`, `.mp4`, `.webm`, `.ogv`, `.png`, `.jpg`, `.gif`, `.svg`.

---

## How the app is put together

```
src/
├── main.tsx                     HashRouter setup
├── App.tsx                      Shell: app bar, drawer/sidebar, routes
├── content.ts                   Typed manifest/guide fetching + validation
├── tree.ts                      Manifest tree ↔ content paths ↔ router URLs
├── useManifest.ts               Loads the manifest once
├── useMediaQuery.ts             Drawer vs sidebar decision
├── components/
│   ├── NavDrawer.tsx            Tree; drawer on mobile, sidebar at ≥1024px
│   ├── GuideView.tsx            Fetches a guide, lazy-loads the renderer
│   ├── MarkdownRenderer.tsx     Markdown config: video, links, tables
│   ├── FolderView.tsx           Category listing / home page
│   ├── Breadcrumbs.tsx          Truncating trail
│   └── EmptyState.tsx           Loading / empty / error states
└── styles/global.css            Tailwind entry: theme tokens, base, utilities
scripts/
└── generate-manifest.mjs        Admin-time manifest generator
```

Styling is **Tailwind CSS v4** via `@tailwindcss/vite`. There is no `tailwind.config.js` — v4 is
configured in CSS, so the palette, fonts and keyframes all live in the `@theme` block at the top
of `src/styles/global.css`. Rendered guide content uses `@tailwindcss/typography`, customised in
`MarkdownRenderer.tsx`.

Design notes worth knowing before changing things:

- **Mobile-first is structural, not cosmetic.** Styles target ~375px first; larger screens are
  `sm:`/`lg:` (min-width) variants only. There are no `max-width` overrides to unpick.
- **Sans-serif throughout:** Bricolage Grotesque for headings, Figtree for body text.
- **Fonts are self-hosted, not CDN-loaded.** They come from `@fontsource-variable/*` npm packages
  and are emitted into `dist/assets/`, so a locked-down hospital device that cannot reach
  fonts.googleapis.com still renders correctly and nothing blocks on an external request.
- **Icons are tree-shaken SVGs** from `@phosphor-icons/react` (duotone), imported one at a time.
  The icon *font* package is 46 MB unpacked — do not swap to it for convenience.
- **The markdown renderer is a lazy chunk** (~52 kB gzipped) so the shell and navigation load
  first on a slow connection.
- **Entrance animations use `animation-fill-mode: both`**, so content starts at `opacity: 0`.
  `prefers-reduced-motion` collapses every duration to 0.01ms, which lands on the finished state
  immediately — do not remove that rule, or reduced-motion users would see nothing.
- **Videos use `preload="metadata"`** — nothing but the header downloads until a reader presses
  play. `playsinline` stops iOS forcing fullscreen.
- **Guide content is sanitised** with `rehype-sanitize`. Admin-authored content is still
  untrusted input.
- **The app never invents content.** A missing or empty file produces an honest empty state
  naming the expected path, never placeholder prose.

### Verified

Checked at 320, 375, 768 and 1280px with zero horizontal page scroll; all standalone touch
targets ≥44px (inline links in running text are 26px, per the WCAG 2.5.8 inline exception);
drawer focus-trapped with Escape to close; deep links loading directly from a plain static
server, both at a webroot and from a subfolder.
