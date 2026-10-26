# FORM/MORE website

The shop is four files: `index.html`, `style.css`, `script.js` and `admin.html`, plus
`OneSignalSDKWorker.js` (notifications) and `assets/shirt.glb` (the 3D shirt).

## Put it online with GitHub and Vercel

1. Upload everything in this folder to a GitHub repository (keep `vercel.json`, `.gitignore` and `.vercelignore`).
2. In Vercel: **Add New → Project**, choose the repository. Framework preset: **Other**. Leave the build command and
   output directory empty. Press **Deploy**.
3. The shop opens at your Vercel address. The team panel opens at `/admin`.

## Before going live

- Pictures: upload them into the `images/` folder. `images/README.md` lists every file name, its size and where it
  shows: the two intro pictures, the two dashboard tiles and the nine graphic style tiles. Everything else is drawn by
  the site. Videos go in a `videos/` folder with the names in the list at the top of `index.html` (`window.MEDIA`).
- Intro prompts: the two prompts typed under the tiger pictures are in `script.js` under `text:` (`alcGeneric` and
  `alcPrompt`). If you remake a picture with a new prompt, change the words there too.
- Size chart: the team fills it in from the admin panel (the ruler button, **Size chart**).
- Server: until the address is set, the site runs in demo mode on each device (demo admin password: `admin123`).
  When the server from `backend/` is running, set `window.FM = { api: 'https://your-server' }` near the top of
  `index.html` and `admin.html`. The server setup guide is `backend/SETUP.md` (it is not part of this website).
- Never put a secret key in these files. Keys live only in the server's `.env` file.
