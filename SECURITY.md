# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in CrisisGrid, please report it responsibly:

1. **Do NOT** open a public issue
2. Email: `security@crisisgrid.app` (or contact the repository owner privately)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and will coordinate a fix before any public disclosure.

## Security Measures in Place

- **Authentication**: JWT with 24h expiry, bcrypt password hashing (10 rounds)
- **Two-Factor Authentication**: TOTP (RFC 6238) with backup codes
- **Account Lockout**: 5 failed attempts → 1-hour lock
- **Rate Limiting**: Applied globally via `express-rate-limit`
- **Secure Headers**: `helmet` middleware (HSTS, X-Content-Type-Options, etc.)
- **Firestore Rules**: Deny all direct client access — all DB operations via authenticated server API
- **Input Validation**: 10kb JSON body limit, validated on all endpoints
- **Audit Logging**: All admin actions logged to `activityLogs` collection
- **Push Token Security**: FCM tokens stored server-side only, auto-purged on invalidation

## Known Limitations

- In-memory job store resets on server restart (CIRO pipeline jobs are ephemeral)
- Volunteer position store is in-memory (resets on restart)
- CIRO results are not persisted to Firestore
- Geometric route simulation (not real road-network routing)

## Dependencies

We monitor dependencies for known vulnerabilities. To audit:

```bash
npm audit
```

For the mobile app:

```bash
cd mobile && npm audit
```
