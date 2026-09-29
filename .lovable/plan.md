# Secure n8n webhook requests

## Changes
- Validate the current Supabase user before every n8n request.
- Read the active session token immediately before sending.
- Force the `Authorization: Bearer <access token>` header after all caller headers so it cannot be overwritten.
- Keep n8n calls limited to signed-in pages and return a clear signed-out error.

## Verification
- Check types and the preview build.
- Confirm the outgoing request construction always contains the current session token.
