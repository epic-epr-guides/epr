# Formatting Reference

Guides are written in Markdown — plain text with a few punctuation marks that control
formatting. This page shows everything the site can display.

## Headings

Use one `#` heading at the top of the file for the title, then `##` for sections and `###` for
sub-sections. Do not use a second `#`.

```markdown
# Book an Appointment
## Before you start
### If the patient has no NHS number
```

## Steps

Numbered steps are the backbone of most guides. Write `1.` at the start of each line — the
numbers correct themselves, so you can insert a step without renumbering the rest.

1. Open the patient record.
2. Choose the tab you need.
3. Save before you leave the screen.

Use bullets for things with no order:

- Something to check
- Something else to check

## Emphasis

Use `**bold**` for **the exact thing to tap or click**, and `*italic*` sparingly for *emphasis*.

## Warnings

Start a line with `>` for a note that must stand out:

> Always confirm the patient's identity before opening a record.

## Tables

| Field | What to enter |
| --- | --- |
| Surname | As printed on the patient's documentation |
| Date of birth | Day, month, then four-digit year |

Wide tables get their own sideways scrollbar on a phone rather than stretching the page.

## Code and exact text

Use single backticks for a value the reader must type exactly, like `ADT-04`, and a fenced
block for anything longer.

## Links

- To another guide: `[Finding a Guide](../getting-started/finding-a-guide.md)` —
  [like this](../getting-started/finding-a-guide.md). Use the file's real name including
  `.md`; the site turns it into a normal in-site link so nothing downloads.
- To an outside website: `[NHS website](https://www.nhs.uk)` —
  [like this](https://www.nhs.uk). These open in a new tab.

## Images and video

See [Images and Video](./media-examples/images-and-video.md).

## Task lists

- [x] Something already done
- [ ] Something outstanding

## Editing the manifest by hand

If you cannot run `npm run manifest`, open `content/manifest.json` in Notepad and add an entry
yourself. A folder holds `children`; a guide does not. `name` must match the real folder or
file name exactly, including `.md`.

```json
{
  "version": 2,
  "tree": [
    {
      "type": "folder",
      "path": "appointments",
      "title": "Appointments",
      "children": [
        { "type": "guide", "path": "book-an-appointment.md", "title": "Book an Appointment" }
      ]
    }
  ]
}
```

`path` is the folder or file name exactly as it appears on disk — one name only, never
`appointments/book-an-appointment.md`. Nesting is expressed by putting entries inside `children`.

Two rules: every `{` needs its `}`, and there is no comma after the last item in a list. If
the site shows "We could not read the list of guides", a comma or bracket is usually the cause.

## Naming files and folders

- Lowercase letters, numbers and hyphens only. No spaces, no apostrophes, no `&`.
- Folder and file names carry no numbers. To control where something appears in the menu, move
  its entry up or down in `manifest.json` — that order is kept the next time the manifest is
  regenerated. A brand-new guide is added to the bottom of its category.
- Allowed file types: `.md`, `.mp4`, `.webm`, `.ogv`, `.png`, `.jpg`, `.gif`, `.svg`.
