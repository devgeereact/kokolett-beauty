"""Check each hookify rule fires on what it should and stays quiet otherwise.

The test strings live in this file rather than in a shell command on purpose:
the delete rule matches command text, so a heredoc containing the examples gets
blocked by the very rule it is testing.
"""

import base64
import pathlib
import re
import sys

# Resolved from this file's own location, not hardcoded to one machine. The
# absolute path here used to be /Users/mrgee/..., which meant this suite could
# only ever run on one laptop — so wiring it into CI failed immediately, and any
# other clone of a public repository could not run it at all.
ROOT = pathlib.Path(__file__).resolve().parent.parent / '.claude'


def pattern_of(name: str) -> str:
    text = (ROOT / name).read_text()
    match = re.search(r'^pattern:\s*(.+)$', text, re.M)
    assert match, f'no simple pattern in {name}'
    return match.group(1).strip()


def conditions_of(name: str) -> list[tuple[str, str]]:
    text = (ROOT / name).read_text()
    return re.findall(r'- field: (\S+)\n\s+operator: \S+\n\s+pattern: (.+)', text)


# Encoded so the strings themselves never appear as literal SQL anywhere a
# shell or another rule could trip over them.
def d(s: str) -> str:
    return base64.b64decode(s).decode()


DELETE_CASES = [
    (d('ZGVsZXRlIGZyb20gcHVibGljLmFwcG9pbnRtZW50czs='), True),
    (d('ZGVsZXRlIGZyb20gY3VzdG9tZXJzIHdoZXJlIHRydWU7'), True),
    (d('REVMRVRFIEZST00gcHVibGljLnN1YnNjcmliZXJz'), True),
    (d('dHJ1bmNhdGUgcHVibGljLmN1c3RvbWVyczs='), True),
    (d('ZGVsZXRlIGZyb20gcHVibGljLmFwcG9pbnRtZW50cyB3aGVyZSByZWZlcmVuY2UgaW4gKCdLQi1USlgyVkwnKQ=='), False),
    (d('ZGVsZXRlIGZyb20gcHVibGljLmN1c3RvbWVycyB3aGVyZSBlbWFpbCA9ICd4QGV4YW1wbGUuY29tJw=='), False),
    (d('ZGVsZXRlIGZyb20gcHVibGljLmVtYWlsX21lc3NhZ2VzIHdoZXJlIGFwcG9pbnRtZW50X2lkIGluIChzZWxlY3QgaWQgZnJvbSB0KQ=='), False),
]

RUFLO_CASES = [
    ('ruflo init --force', True),
    ('ruflo init --force --start-all', True),
    ('claude-flow init --force', True),
    ('ruflo init', False),
    ('ruflo daemon start', False),
    ('ruflo swarm init', False),
    ('git commit -m "ruflo init notes"', False),
    # Prose that merely mentions the command must stay quiet. Before the
    # pattern was anchored to command position, this exact shape blocked a
    # commit whose message described the rule.
    (d('Z2l0IGNvbW1pdCAtcSAtRiAtCgpCbG9ja2luZzogYHJ1ZmxvIGluaXQgLS1mb3JjZWAuIFJ1biB0b2RheS4='), False),
    (d('ZWNobyAibmV2ZXIgcnVuIHJ1ZmxvIGluaXQgLS1mb3JjZSBoZXJlIg=='), False),
    (d('Y2QgL3RtcCAmJiBydWZsbyBpbml0IC0tZm9yY2U='), True),
]

DEPLOY_CASES = [
    (d('fi8uY2xhdWRlL2Jpbi9jcGFuZWwtZGVwbG95IGRpc3Qga29rby5nYWtpbnouY29tIC0td2l0aC1odGFjY2VzcyAuaHRhY2Nlc3MgLS1nbw=='), True),
    (d('Y3BhbmVsLWRlcGxveSBkaXN0IGtva28uZ2FraW56LmNvbSAtLWtlZXAgY2dpLWJpbiAtLWdv'), True),
    (d('Y2Qgfi9wcm9qICYmIH4vLmNsYXVkZS9iaW4vY3BhbmVsLWRlcGxveSBkaXN0IGtva28uZ2FraW56LmNvbSAtLWdv'), True),
    (d('Y3BhbmVsLWRlcGxveSBkaXN0IGtva28uZ2FraW56LmNvbQ=='), False),
    ('npm run build', False),
    # Talking about a deploy is not deploying.
    (d('Z2l0IGNvbW1pdCAtbSAid2FybnMgb24gY3BhbmVsLWRlcGxveSBkaXN0IHNpdGUgLS1nbyI='), False),
]

# (file_path, new_text) pairs for the two condition-based rules.
PRICE_CASES = [
    (('src/pages/MyBookingsPage.tsx', 'formatMoney(a.price_pence)'), True),
    (('src/components/public/Reviews.tsx', 'costs £42.50'), True),
    (('src/pages/dashboard/TodayPage.tsx', 'formatMoney(summary.today_collected_pence)'), False),
    (('src/pages/MyBookingsPage.tsx', 'Reference {a.reference}'), False),
]

DASH_CASES = [
    (('src/pages/HomePage.tsx', 'Braids, locs — and colour'), True),
    (('supabase/functions/_shared/templates.ts', 'confirmed — KB-XXXX'), True),
    (('src/pages/HomePage.tsx', 'Braids, locs and colour'), False),
    # These two used to be exempt: the rule covered only the marketing site,
    # on the reasoning that the owner is not a customer. The 2026-08-31 sweep
    # dropped that distinction. The owner reads her dashboard all day, the copy
    # is written in the same voice, and half of it is quoted back to a customer
    # anyway ("Booked in. Reference KB-XXXXXX").
    (('src/pages/dashboard/SettingsPage.tsx', 'Booking rules — advanced'), True),
    (('src/components/dashboard/AppointmentCard.tsx', 'Note — private'), True),
    (('src/pages/SubscribePage.tsx', 'A few emails a year — not a few a week'), True),
    # The paths the old pattern missed, each of which was really leaking.
    (('src/lib/errors.ts', "'Sorry — that slot was taken.'"), True),
    (('src/components/OfflineBanner.tsx', "You're offline — showing cached content."), True),
    (('supabase/migrations/0066_new_copy.sql', "'Just a reminder — see you tomorrow'"), True),
    (('vite.config.ts', "description: 'Book a salon — online.'"), True),
    (('public/offline.html', '<title>Kokolett Beauty UK — offline</title>'), True),
    # En dashes count too: a screen reader announces one as nothing at all, so
    # "09:00 – 17:00" reads as two unconnected times.
    (('src/hooks/useUsualHours.ts', '`${times[0]} – ${times[1]}`'), True),
    (('src/lib/errors.ts', "'Sorry, that slot was taken.'"), False),
    (('docs/SOCIAL_PROFILE.md', 'A dash — in a doc is fine'), False),
]

failures = 0


def run(label, pattern, cases):
    global failures
    print(f'\n{label}\n  {pattern}')
    for text, want in cases:
        got = bool(re.search(pattern, text))
        ok = got == want
        failures += not ok
        mark = 'ok  ' if ok else 'FAIL'
        verdict = 'fires' if got else 'quiet'
        print(f'  {mark} {verdict}  {text[:70]}')


def run_conditions(label, name, cases):
    global failures
    conds = conditions_of(name)
    print(f'\n{label}')
    for c in conds:
        print(f'  {c[0]}: {c[1]}')
    for (path, text), want in cases:
        fields = {'file_path': path, 'new_text': text}
        got = all(
            (p in fields[f]) if f == 'new_text' and not any(ch in p for ch in '\\|[(')
            else bool(re.search(p, fields[f]))
            for f, p in conds
        )
        ok = got == want
        failures += not ok
        mark = 'ok  ' if ok else 'FAIL'
        verdict = 'fires' if got else 'quiet'
        print(f'  {mark} {verdict}  {path}  ::  {text[:44]}')


run('unfiltered-delete', pattern_of('hookify.unfiltered-delete-live-data.local.md'), DELETE_CASES)
run('ruflo-force', pattern_of('hookify.ruflo-force-overwrites-claude-md.local.md'), RUFLO_CASES)
run('deploy-checks', pattern_of('hookify.deploy-checks.local.md'), DEPLOY_CASES)
run_conditions('price-in-customer-copy', 'hookify.customer-facing-copy.local.md', PRICE_CASES)
run_conditions('em-dash-in-copy', 'hookify.em-dash-in-copy.local.md', DASH_CASES)

print(f'\n{"all pattern tests pass" if not failures else f"{failures} FAILURES"}')
sys.exit(1 if failures else 0)
