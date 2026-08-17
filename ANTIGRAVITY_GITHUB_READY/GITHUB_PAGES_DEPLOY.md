# GitHub Pages deployment

The root `index.html`, `app.js`, and `style.css` are copies of the original frontend entry files.

## GitHub Pages
1. Create a public GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select **main** and **/(root)**, then save.

## Important
The original application also contains a Node.js backend at `source/visualization/server.js`. GitHub Pages cannot run that backend. If the frontend uses `/api/*` endpoints, those features need a separate Node.js-capable host. The complete source is retained in this repository for that purpose.
