# Ho's Money Tracker

React (Vite) frontend + Python (Flask) backend. Yellow/white, mobile first.

## Run on your computer (one command)
1. `npm install`   (once. It also installs the Python packages)
2. `npm run dev`   (starts backend + frontend together and opens the browser)

## Deploy on Vercel
1. Create a free Postgres database (Neon via Vercel Marketplace). Vercel cannot keep files, so SQLite will NOT work there.
2. Push this folder to GitHub, import it in Vercel (framework: Vite, auto-detected).
3. Add environment variables from `.env.example` (DATABASE_URL, SECRET_KEY, ALLOWED_USERS, and SMTP_USER/SMTP_PASS for email).
4. Deploy. Open the link on your phone and "Add to Home Screen".

## Notes
- First login with a new username creates it. Set ALLOWED_USERS so strangers cannot create accounts on your public link.
- Gmail alerts need a Google App Password (Google Account > Security > 2-Step Verification > App passwords).
- The email is sent when a record is added/deleted or the alert is saved and the balance is below the level (once, until balance recovers). It is not a timer.
- The chatbot is rule-based. It reads your data on your phone; no outside AI is used.
