# CLAUDE.md

nono is a fully client-side nonogram solver webapp (React + Vite + TypeScript,
Zustand, Tesseract.js OCR). See README.md for requirements and architecture;
the deferred "assistant mode" design lives in docs/tryb-pomocnika.md.

## Commands

```bash
npm run dev      # dev server
npm test         # unit tests (Vitest)
npm run build    # typecheck + production build
```

## Deployment policy

After a change is implemented and verified (unit tests, build, and a browser
click-through of the affected flows), commit it on the working branch and push
it straight to `main` (fast-forward) **without asking the user for
confirmation** — `main` is the deployment branch and every push to it deploys
to GitHub Pages. After pushing, confirm the "Deploy na GitHub Pages" workflow
run succeeded.

Do NOT push unverified or partially working changes to `main`.

## Language policy

- Everything committed to the repo is written in **English**: commit
  messages, code, code comments, and markdown documentation.
- Conversation with the user is in **Polish**.
- Historical commits and existing Polish code comments stay as they are;
  translate Polish comments to English only in files you are modifying
  anyway.
