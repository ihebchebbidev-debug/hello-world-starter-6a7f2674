// No-op: the static /login.html detour was removed. The SPA now owns /login
// on every host (Vercel, Render, Cloudflare, local). This file is kept so
// existing `vercel-build` / `render-build` scripts don't fail.
console.log("prepare-static-login: skipped (SPA login is now used everywhere).");
