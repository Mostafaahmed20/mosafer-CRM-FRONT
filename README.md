# Initial-CRM-ops-implementation

## Netlify deployment

This project is configured for Netlify with `netlify.toml`.

- Build command: `pnpm run build`
- Publish directory: `dist/public`
- SPA redirect: `/* -> /index.html`

### Required Netlify environment variables

Set these in Netlify Site settings -> Environment variables:

- `VITE_API_URL` (your backend base URL, for example `https://api.yourdomain.com`)
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_OAUTH_PORTAL_URL`
- `VITE_APP_ID`
- `VITE_FRONTEND_FORGE_API_KEY`
- `VITE_FRONTEND_FORGE_API_URL`
