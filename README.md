# AI Agents walkthrough

A click-through demo (one HTML file, no build step). The thank-you slide can send a person's name to a Teams channel.

```
index.html        the demo
config.js         the one setting to edit: where names are sent
relay/worker.js   small relay that posts to Teams (keeps the Teams URL secret)
```

## Read this first: who can see the site

GitHub Pages sites are **public on the internet** by default, even when the repository is private. Publishing a site privately needs GitHub Enterprise Cloud. This demo mentions the unreleased 27R1 web search feature and names colleagues, so check with your team or InfoSec before publishing it publicly.

## 1. Publish on GitHub Pages

1. Create a repository and upload these files (keep `index.html` at the top level).
2. Repository **Settings > Pages > Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`, Save.
3. After a minute the site is at `https://<user-or-org>.github.io/<repo>/`.
   Note the part before the first path, `https://<user-or-org>.github.io`. This is the "origin" used in step 3.

At this point the demo already works. Without step 4 the thank-you slide just confirms on screen and sends nothing.

## 2. Get a Teams webhook URL

Microsoft retired the old Office 365 connector webhooks in 2026. The replacement is a Workflow.

1. In Teams, open the channel, choose **... > Workflows**.
2. Pick **Post to a channel when a webhook request is received**, choose the team and channel, Save.
3. Copy the webhook link. Treat it like a password: anyone who has it can post to your channel.

Ask a teammate to be a co-owner of the workflow, so it keeps running if you leave.

## 3. Deploy the relay (Cloudflare Workers, free plan is enough)

The page must not contain the Teams URL, because the page is public. The relay holds it and only accepts requests from your site.

1. Cloudflare dashboard > **Workers & Pages > Create > Create Worker**, deploy the starter, then **Edit code**.
2. Replace the code with the contents of `relay/worker.js`, Deploy.
3. Worker **Settings > Variables and Secrets**, add:
   - `TEAMS_WEBHOOK_URL` as a **Secret**: the link from step 2.
   - `ALLOWED_ORIGIN` as **Text**: your origin from step 1, for example `https://yourname.github.io`.
     Add `http://localhost:8000` after a comma if you want to test locally.
4. Copy the Worker URL (`https://<name>.<account>.workers.dev`).

If your company does not allow Cloudflare, the same logic fits an Azure Function. The page only needs a URL that accepts `POST {"name": "..."}` and answers with CORS headers for your site.

## 4. Point the page at the relay

Edit `config.js`:

```js
window.DEMO_CONFIG = {
  responseEndpoint: "https://<name>.<account>.workers.dev"
};
```

Commit and push. The site updates in a minute or two.

## 5. Test

```bash
curl -i -X POST "https://<name>.<account>.workers.dev" \
  -H "Origin: https://yourname.github.io" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Person"}'
```

Expect `200` and a card in the channel. Then click through the live site to the last slide, choose "Yes", enter a name, and press Send.

| Symptom | Likely cause |
|---|---|
| `403` | `ALLOWED_ORIGIN` does not match the site's origin exactly (no trailing slash, no path) |
| `502` | Teams rejected the post: re-copy the webhook link, check the workflow is on |
| "That did not go through" on the slide | Wrong `responseEndpoint`, or the page was opened as a local file (its origin is "null") |

## What gets sent

Only the name typed on the last slide, plus the time. Choosing "Naah" sends nothing.
The relay trims the name to 60 characters and removes links and formatting characters before posting.
