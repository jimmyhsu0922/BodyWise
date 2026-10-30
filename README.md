# Body Study · AI Tutor

A phone-installable web app (PWA) for learning the human body.

- **Learn** — 12 body-system topics with an overview, key parts and facts, plus "Ask Anything".
- **AI Tutor** — chat with Claude about each topic; it can explain, give examples, and quiz you. It also reads your notes for that topic, so it can correct mistakes.
- **What I learned** — write what you understand in your own words. Notes are saved on your phone. Tap **Check my understanding** and the AI marks what's right, what to fix, what's missing, and gives a score.
- **Backup** — download or restore your notes as a JSON file (Settings).

Plain HTML/CSS/JS, no build step.

## Run on your computer

```bash
python -m http.server 5180
```

Open http://localhost:5180.

## Put it on your phone

Installing needs an **https** address, so host this folder online (free options: Cloudflare Pages, GitHub Pages, Netlify). With Cloudflare Pages, use **Build output directory** `/` and no build command.

Then open the address on your phone:

- **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*
- **iPhone (Safari):** Share → *Add to Home Screen*

## Turn on the AI

1. Create an API key at https://platform.claude.com/settings/keys (usage is billed to your Anthropic account).
2. In the app: **Settings → Claude API key → Save**.

The key is stored only on your device and sent only to Anthropic. Don't share a copy of the app that has your key in it.

## Where your data lives

Notes, chats, and progress are saved in the browser's storage on your phone. Clearing the browser's site data deletes them, so download a backup now and then.
