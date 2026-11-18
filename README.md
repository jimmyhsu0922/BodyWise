# Body Study · AI Tutor

A phone-installable web app (PWA) for learning the human body.

**Open the app:** https://jimmyhsu0922.github.io/BodyWise/

- **Learn** — 12 body-system topics with an overview, key parts and facts, plus "Ask Anything".
- **AI Tutor** — chat with Claude or Gemini about each topic; it can explain, give examples, and quiz you. It also reads your notes for that topic, so it can correct mistakes.
- **What I learned** — write what you understand in your own words. Notes are saved on your phone. Tap **Check my understanding** and the AI marks what's right, what to fix, what's missing, and gives a score.
- **Generate image / AI Notes** — under each chat, **Generate image** turns the questions you asked into one summary image (each question with its answer). Every image is saved in the **AI Notes** tab, where you can view, download, share, or delete it.
- **Cloud sync** — phone and computer share the same notes through your own private GitHub repository (see below).
- **Backup** — download or restore your notes as a JSON file (Settings).
- **Language** — English or 繁體中文 (Settings → Language). The topics, screens, and AI replies all follow the chosen language. The first time it opens, the app picks the phone's language.

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

## Turn on the AI

The tutor works with **Claude** or **Gemini** — pick one in **Settings → AI provider**.

- **Claude:** create a key at https://platform.claude.com/settings/keys (billed to your Anthropic account), then paste it in **Claude API key**.
- **Gemini:** create a key at https://aistudio.google.com/apikey (has a free tier with limits), then paste it in **Gemini API key**. Tap **Load all models for my key** to choose any Gemini model your key can use.

Keys are stored only on your device and sent only to the provider you pick. Don't share a copy of the app that has your key in it.

## Where your data lives

Notes, chats, AI notes, and progress are saved in the browser on each device (pictures in IndexedDB).

### Cloud sync (phone + computer share the same notes)

Turn it on in **Settings → Cloud sync**. Your data is kept in **your own private GitHub repository**:

1. On GitHub, create a **private** repository, e.g. `bodywise-data`.
2. [Create a fine-grained token](https://github.com/settings/personal-access-tokens/new): *Repository access* → *Only select repositories* → that repository; *Permissions* → **Contents: Read and write**.
3. In the app on each device, enter `owner/name` and the token, then tap **Connect & sync**.

The app then syncs when it opens, every 2 minutes while open, and a few seconds after each change. It stores `bodywise-data.json` and an `images/` folder in that repository. Edits merge per note (newest wins), and deletions sync too. API keys are **not** synced; enter them on each device. Public repositories are refused, so your notes are never exposed.

Without sync, clearing the browser's site data deletes everything on that device, so download a backup now and then.
