# Body Study · AI Tutor

A phone-installable web app (PWA) for learning the human body.

- **Learn** — 12 body-system topics with an overview, key parts and facts, plus "Ask Anything".
- **AI Tutor** — chat with Claude or Gemini about each topic; it can explain, give examples, and quiz you. It also reads your notes for that topic, so it can correct mistakes.
- **What I learned** — write what you understand in your own words. Notes are saved on your phone. Tap **Check my understanding** and the AI marks what's right, what to fix, what's missing, and gives a score.
- **Backup** — download or restore your notes as a JSON file (Settings).
- **Language** — English or 繁體中文 (Settings → Language). The topics, screens, and AI replies all follow the chosen language. The first time it opens, the app picks the phone's language.

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

The tutor works with **Claude** or **Gemini** — pick one in **Settings → AI provider**.

- **Claude:** create a key at https://platform.claude.com/settings/keys (billed to your Anthropic account), then paste it in **Claude API key**.
- **Gemini:** create a key at https://aistudio.google.com/apikey (has a free tier with limits), then paste it in **Gemini API key**. Tap **Load all models for my key** to choose any Gemini model your key can use.

Keys are stored only on your device and sent only to the provider you pick. Don't share a copy of the app that has your key in it.

## Where your data lives

Notes, chats, and progress are saved in the browser's storage on your phone. Clearing the browser's site data deletes them, so download a backup now and then.
