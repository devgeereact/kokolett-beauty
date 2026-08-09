---
name: warn-deploy-checks
enabled: true
event: bash
action: warn
pattern: (?:^|[;&|]\s*)[^\s;&|]*cpanel-deploy\s[^|;&]*--go
---

**About to write to the live site.** `koko.gakinz.com` is public and taking
bookings. Three things have gone wrong here before:

**1. Relative asset paths blank every nested route.** Check the build first:

```bash
grep -o '"\./assets/[^"]*"' dist/index.html && echo "STOP: base is './' — fix vite.config.ts"
```

`vite.config.ts` must keep `base: '/'`. With `'./'` the browser resolves assets
against the current URL, so `/dashboard/appointments` and every
`/access/<token>` magic link render blank. That shipped once and was live for
about an hour. An HTTP 200 does not disprove it: the `.htaccess` SPA rewrite
answers 200 for any path, including missing JavaScript.

**2. `--delete` mirrors exactly.** `--keep .well-known --keep cgi-bin` is not
optional on this docroot. `.well-known/pki-validation/` holds the certificate
validation file, and losing it breaks TLS reissue.

**3. Dry-run first.** `cpanel-deploy` is dry by default. If you have not just
run it without `--go` and read the deletion list, do that now.

After deploying, verify by loading routes **directly** and checking React
mounted, not by checking status codes:
`node scratchpad/verify_deep_links.js`
