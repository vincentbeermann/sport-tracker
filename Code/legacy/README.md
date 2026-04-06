# legacy/ - old Express server

This was the original v1 backend (Express + JSON file persistence). It has been
replaced by the localStorage-backed PWA in `../public/`.

## Why kept

If you ever want to add multi-device sync (e.g. Mac and iPhone reading the same
data), this server is the starting point. It already has GET/POST/PATCH/DELETE
on `/api/sessions` and an aggregated `/api/stats` endpoint with weekly streak.

To resurrect:

```bash
cd legacy
npm install
node server.js
```

Then point the storage layer at it instead of localStorage. But: that brings
back the "Mac must be awake" problem and you'd need Tailscale or similar to
reach it from outside the home network. The PWA + occasional JSON export is
simpler for a single-user setup.
