# traQ-S_UI - traP Internal Messenger Application

[![GitHub release](https://img.shields.io/github/release/traPtitech/traQ_S-UI.svg)](https://GitHub.com/traPtitech/traQ_S-UI/releases/)
![CI](https://github.com/traPtitech/traQ_S-UI/workflows/CI/badge.svg)
![release](https://github.com/traPtitech/traQ_S-UI/workflows/release/badge.svg)
[![codecov](https://codecov.io/gh/traPtitech/traQ_S-UI/branch/master/graph/badge.svg)](https://codecov.io/gh/traPtitech/traQ_S-UI)

- Backend: [traQ](https://github.com/traPtitech/traQ)
- Frontend: this repository

traQ (pronounced "track") is a messenger application built for [Digital Creators Club traP](https://trap.jp).
traQ allows ease communication among team members by organizing contexts into tree-structured channels.

![traQ](https://user-images.githubusercontent.com/49056869/115141831-5a376980-a079-11eb-93c1-7016bc2097d0.png)

## Deployment

If you want to deploy your own instance of traQ, then follow the instructions in backend [deployment.md](https://github.com/traPtitech/traQ/blob/master/docs/deployment.md).

### Reverse proxy helper

This repository now ships with a lightweight reverse proxy (`server/index.js`) that serves the built SPA and securely forwards API traffic to an upstream traQ backend. It is useful when you cannot modify the backend's CORS settings.

1. Build the frontend: `npm run build`.
2. Start the proxy server: `npm run start` (or `npm run serve`).
3. Access the app on `http://127.0.0.1:4173` (default).

Environment variables:

- `TRAQ_ORIGIN` (default `https://q.trap.jp`) — traQ backend origin. Must be HTTPS in production.
- `API_PREFIX` (default `/api/v3`) and `AUTH_PREFIX` (default `/api/auth`) — paths exposed by this server and proxied to the upstream.
- `PORT` / `HOST` — listening address for the proxy.

All responses keep cookies scoped to your frontend domain, strip permissive `Access-Control-Allow-*` headers coming from upstream, and only forward requests that match the configured prefixes to avoid creating an open proxy.

## Development

If you want to contribute to traQ (Frontend), then follow the instructions in [development.md](./docs/development.md).

### Environment Variables

Both development (`npm run dev`) and production builds read the following values when available:

- `VITE_TRAQ_API_BASE_URL` — API base URL or path. Defaults to `/api/v3`. Accepts relative paths (proxied through the Vite dev server) or absolute URLs for external APIs.
- `VITE_TRAQ_AUTH_BASE_URL` — OAuth entrypoint base URL or path. Defaults to `/api/auth`. Used for the external authentication redirect target.

## License

Code licensed under [the MIT License](https://github.com/traPtitech/traQ_S-UI/blob/master/LICENSE).
