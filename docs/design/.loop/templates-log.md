# Templates + Template Editor screens — design-match log

Targets: `TemplatesPage.tsx` (`docs/design/templetes.png`) and
`TemplateEditorPage.tsx` (`docs/design/Email-Template-Editor.png`), routes
`/dashboard/templates` and `/dashboard/templates/:key/edit`.

## Already built — and unusually complete

Both screens were already real, working, DB-backed builds, closely
matching both references. `TemplatesPage.tsx`: a real catalogue (18 fixed
transactional templates, hard-coded in
`supabase/functions/_shared/templates.ts` — not user-creatable, matching
the file's own honest comment), category tabs, search, and a detail view
showing real usage counts + the most recent real send example pulled from
`email_messages`. `TemplateEditorPage.tsx`: a real `contentEditable`
rich-text editor (bold/italic/underline/strike/lists/align/link, variable
insertion, paragraph-style select), backed by a genuinely editable
`email_templates` DB row (`getEmailTemplate`/`updateEmailTemplate`), a live
preview pane substituting sample values for `{{tokens}}`, an Email/Mobile
preview toggle, and the three settings toggles (Active/Allow editing before
sending/Include in automation) all wired to real columns. Verified Save
live — "Template saved." toast, real persistence.

This reconciles what first looked like a contradiction: the catalog
(*which* templates exist) is fixed and hard-coded; each template's
*content* (subject/body/settings) is a real, separately editable DB row.
Both facts are true at once, and the build already reflected that
correctly.

## Iteration 1 — one real accuracy bug: the preview lied in dark mode

The Preview pane used this app's own theme tokens (`bg-card`,
`text-foreground`, `bg-tint-pending`, etc.), so switching the *dashboard*
into dark mode also darkened the *email preview* — but the real email
(`supabase/functions/_shared/templates.ts`) hardcodes its own colours with
no dark-mode branch at all (`<meta name="color-scheme" content="light">`,
literal hex throughout: `PAPER #e8ebed`, `INK #333333`, `MUTED #6b7280`,
`LINE #dcdfe2`, `BRAND #e05d38`). Transactional email has no concept of the
owner's dashboard theme — a customer's inbox renders it light regardless.
So a token-based preview doesn't just look different, it actively
misrepresents what gets sent whenever the owner happens to be in dark mode.

Fixed by hardcoding the preview pane to those exact literal hex values
(sourced directly from the real template file, not invented) via inline
`style`, with a comment explaining why raw hex is deliberately correct here
— the one place in this app where matching a design token would be the
wrong call, because the thing being previewed exists entirely outside this
app's theme system.

While fixing this, corrected the masthead itself to match the real
template's actual structure — it was showing an invented centred
"Kokolett / BEAUTY UK" band with no basis in the real HTML; the real
masthead is left-aligned "Kokolett **Beauty** UK" (brand-orange highlight
on the middle word only) with a right-aligned "Women's hair salon" label,
white background, bottom border. Verified against
`supabase/functions/_shared/templates.ts:159-167` directly rather than
guessing from the reference screenshot alone.

Verified live in both dashboard themes — the preview now renders
identically in each, as it should, matching the real masthead layout.

## Not implemented — logged, not guessed at

- Reference's `TemplatesPage` sidebar "Template storage" quota card
  ("12 of 50 templates used") — no per-plan quota concept exists; the
  catalogue is a fixed, hard-coded 18 (not a limit that can be raised on a
  paid tier).
- "New template" / custom-template creation — no create path exists; the
  catalogue is fixed by what the send pipeline actually knows how to
  render.
- SMS channel badges — no SMS provider is wired into this app; every real
  template is Email.
- Image upload in the editor toolbar — already correctly disabled in the
  existing build (`title="Image upload isn't wired up yet"`), not
  something this pass needed to touch.

## Verification

Dark theme and mobile (390×844) checked for both screens — clean.
`npx vitest run`: 154/154 passing. `tsc --noEmit` clean for every file this
change touched (pre-existing, unrelated errors in `DayView.tsx` and
`CustomersPage.tsx`/`customerService.ts` excluded — neither touched this
session, not this task's to fix).

## Stop

Converged after 1 iteration — closed the one real gap (a preview that
actively misrepresented the real send in dark mode) on top of an
already-thorough, honestly-scoped build.
