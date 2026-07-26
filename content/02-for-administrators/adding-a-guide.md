# Adding a Guide

This page is for whoever maintains the wiki content. Readers do not need it.

## What you are working with

The whole wiki is one folder called `content`. Its folder structure **is** the navigation you
see on the site — a folder becomes a category, and a `.md` file inside it becomes a guide.
There is no upload screen and no login; you edit files and copy the folder to the server.

## Steps

1. On your own machine, open your local copy of the `content` folder.
2. Create or choose a category folder, e.g. `content/appointments`.
3. Create a file inside it, e.g. `book-an-appointment.md`. Use lowercase letters and hyphens,
   never spaces — the file name becomes part of the web address.
4. Start the file with a single `#` heading. That heading becomes the title in the menu.
5. Write the guide. See [Formatting Reference](./formatting-reference.md) for what you can use.
6. Run `npm run manifest` in the project folder. This updates `content/manifest.json`, which is
   the list the site reads to build its menu.
7. Copy the whole `content` folder to the web server, **overwriting** what is there.
8. Reload the site. Your guide appears in the menu.

## When you must run `npm run manifest`

The manifest describes the *structure* only. Guide text is read straight from the `.md` file
when a reader opens it.

| What you changed | Regenerate the manifest? |
| --- | --- |
| Edited the words inside an existing guide | No — just re-upload the `.md` file |
| Added, deleted, renamed or moved a guide or folder | Yes |
| Changed a guide's `#` heading | Yes |

## Three things that catch people out

- **Your upload must overwrite.** Many FTP programs skip files that already exist. A new guide
  plus an old `manifest.json` means the guide never shows up in the menu.
- **Your local `content` folder is the master copy.** If someone adds a file directly on the
  server, the next `npm run manifest` run on your machine will not know about it and will
  produce a manifest that leaves it out.
- **Deleting an entry from the manifest only hides it.** The file is still on the server and
  anyone with the address can still read it. If a guide is withdrawn because it is clinically
  out of date, delete the file from the server as well.

## If you cannot run the script

`manifest.json` is plain text and simple enough to edit in Notepad. See
[Formatting Reference](./formatting-reference.md#editing-the-manifest-by-hand).
