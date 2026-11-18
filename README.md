# Body Study

A phone-installable web app (PWA) for studying the human body and keeping your own notes.

**Open the app:** https://jimmyhsu0922.github.io/BodyWise/

- **Learn** — 12 body-system topics with an overview, key parts, and facts, plus a "General" topic. Each topic page lists your notes and image notes for it, and you can mark the topic as learned.
- **Notes** — write what you understand in your own words; search, filter by topic, edit, and delete.
- **Image Notes** — save diagrams, textbook photos, screenshots, or any pictures (up to 20 per note) with a title, topic, and description. Edit them later: add, remove, or reorder pictures (the first is the cover), and change the text. Download or share the pictures.
- **Compare** — when a note and an image note have the same title, open them side by side.
- **Cloud sync** — phone and computer share the same notes through your own private GitHub repository (see below).
- **Backup** — download or restore everything, pictures included, as a JSON file (Settings).
- **Language** — English or 繁體中文 (Settings → Language). The first time it opens, the app picks the phone's language.
- **Look** — dark, professional theme.

Plain HTML/CSS/JS, no build step. See [CHANGELOG.md](CHANGELOG.md) for the update and debug history.

## Run on your computer

```bash
python -m http.server 5180
```

Open http://localhost:5180.

## Put it on your phone

The app is hosted on GitHub Pages at https://jimmyhsu0922.github.io/BodyWise/. Every push to `main` redeploys it automatically (`.github/workflows/deploy.yml`; no build step). In the repository's **Settings → Pages**, the source must be **GitHub Actions**.

Open the address on your phone:

- **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*
- **iPhone (Safari):** Share → *Add to Home Screen*

## Where your data lives

Notes and image notes are saved in the browser on each device (pictures in IndexedDB).

### Cloud sync (phone + computer share the same notes)

Turn it on in **Settings → Cloud sync**. Your data is kept in **your own private GitHub repository**:

1. On GitHub, create a **private** repository, e.g. `bodywise-data`.
2. [Create a fine-grained token](https://github.com/settings/personal-access-tokens/new): *Repository access* → *Only select repositories* → that repository; *Permissions* → **Contents: Read and write**.
3. In the app on each device, enter `owner/name` and the token, then tap **Connect & sync**.

The app then syncs when it opens, every 2 minutes while open, and a few seconds after each change. It stores `bodywise-data.json` and an `images/` folder in that repository. Edits merge per note (newest wins), and deletions, including pictures removed from an image note, sync too. Public repositories are refused, so your notes are never exposed.

Without sync, clearing the browser's site data deletes everything on that device, so download a backup now and then.

## Earlier versions

Earlier versions had an AI tutor and AI-made notes. Those are gone; existing AI notes open as image notes (their text becomes the description, and attached pictures are kept). Old AI chat history stays in storage and in backups but isn't shown.
