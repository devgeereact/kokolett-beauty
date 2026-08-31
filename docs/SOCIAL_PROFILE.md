# Social and Search Profile: Kokolett Beauty UK

**Date:** 2026-08-31.
**Scope:** The single source of truth for how Kokolett Beauty UK presents itself on Google, on Instagram and on its own site. Parts of this file are written to be pasted straight into the Google Business Profile and Instagram editors, field by field, in the order those editors present them. §9 records what the SEO review found in the codebase and what was changed in response.
**Copy rule:** British English, no em dashes, no en dashes. See `docs/RULES.md` §9.7 and §9.9.

---

## 1. Master identity

Every field below must read identically on the website, on Google, on Instagram and in any directory. When one of them changes, it changes here first.

| Field | Value |
| --- | --- |
| Business name | Kokolett Beauty UK |
| What it is | Women's hair salon |
| Owner | Christy |
| Street | Redbourne Dr |
| Locality | Thamesmead |
| Town | London |
| Postcode | SE28 8RX |
| Country | United Kingdom |
| Phone | +44 7707 906408 (local form 07707 906408) |
| Email | booking@kokolettbeauty.com |
| Website | https://www.kokolettbeauty.com |
| Booking page | https://www.kokolettbeauty.com/book |
| Instagram | https://www.instagram.com/kokolettbeautyuk/ |
| Experience | Over 15 years |
| Areas served | Thamesmead, Abbey Wood, Belvedere, Plumstead, Erith, Woolwich, Charlton, Greenwich, Eltham |
| Positioning line | Women's hair salon in Thamesmead, South East London |
| Service groups | Braids · Twists · Weaves, wigs and extensions · Natural hair and styling · Colour · Treatments |
| Not offered | Locs. Retired 2026-08-31, see §1.3. Also no nails, brows, lashes, aesthetics, barbering, or men's hair. |
| Structured data type | `HairSalon`. Never `BeautySalon`. See `CLAUDE.md`. |

### 1.1 Name variants to eliminate

The codebase has produced four spellings of the business name: `Kokolett Beauty UK`, `Kokolett Beauty`, `Kokolett`, and `Kokolett Beauty, Woolwich`. Only the first is the business name.

`Kokolett` survives in exactly one place, the PWA `short_name` in `vite.config.ts`, which has a platform character limit and is not a search surface. Everywhere else uses the full name.

### 1.2 Thamesmead, not Woolwich

SE28 8RX is Thamesmead, in the **London Borough of Bexley**, ward Thamesmead East. Woolwich is SE18, roughly two miles west, in the Royal Borough of Greenwich.

Thamesmead straddles both boroughs, which is why this is easy to get wrong. An earlier draft of this file said Greenwich; the postcode's own record (Office for National Statistics, via `api.postcodes.io`) says Bexley. Corrected 2026-08-31.

The site previously described itself as a Woolwich salon while the verified Google profile carried an SE28 address. That is the site disagreeing with Google's own record of the same business, and Google ranks local results partly on distance from the searcher regardless of what a page claims about itself.

Thamesmead is now the location claim in titles, headings, meta descriptions and `addressLocality`. Woolwich still appears, in body copy, as one of the areas clients travel from, because that is true.

### 1.3 No locs

Five loc styles (faux, butterfly, soft, starter, and loc retwist) were seeded into
the service menu when the app was built and advertised ever since: on the site, in
the structured data, in the meta descriptions and inside the AI assistant's own
grounding prompt. The owner does not offer them and never has.

They were retired on 2026-08-31 by `0066_retire_locs.sql`, which deactivates the five
rows rather than deleting them, and renames the group from "Twists and locs" to
"Twists".

Twists are a different service and she does do them: Senegalese, passion, spring,
Marley and two strand. Keep the distinction. The group is **Twists**.

Do not advertise locs on any surface. A customer who books on the strength of it
arrives for something that cannot be done, which costs more than the search traffic
is worth.

---

## 2. Source-of-truth map

Three stores hold business facts. Knowing which owns what is how the surfaces stop drifting apart.

| Fact | Lives in | Edited by |
| --- | --- | --- |
| Business name, category, country | `booking_settings` table | Owner, in Settings |
| Address line, phone | `booking_settings` table | Owner, in Settings |
| Instagram URL, Google review URL, Google Place ID | `booking_settings` table | Owner, in Settings |
| Opening hours shown in the footer | Derived from the weekly availability template by `useUsualHours` | Owner, in Weekly Default |
| Positioning line, locality, region, postcode, areas served, service groups, site origin, contact email | `src/lib/business.ts` | Developer, in code |
| Structured data address, phone, hours, `sameAs` | `index.html` JSON-LD, hand-keyed | Developer, in code |
| Name, origin and email inside transactional email | `supabase/functions/_shared/templates.ts` | Developer, in code |

Two of those are deliberate duplicates and need explaining.

**`index.html` cannot read the database.** It is a static file served before any JavaScript runs, which is exactly why the structured data lives there: a crawler sees it without executing anything. The cost is that the address, phone and opening hours in the JSON-LD are hand-keyed and can fall out of step with what the owner has set in Settings. `docs/GO-LIVE.md` §3 carries this as a hand-sync step.

**Edge functions cannot import from `src/`.** They run on Deno, outside the Vite build. `_shared/templates.ts` therefore keeps its own copy of the business name, site origin and contact email. This is the one sanctioned duplicate of those three values.

Live values, read from `booking_settings` on 2026-08-31:

```
instagram_url      https://www.instagram.com/kokolettbeautyuk/
google_review_url  https://g.page/r/CYJMH4E6p4o_EBM/review
google_place_id    ChIJxSluewCv2EcRgkwfgTqnij8
timezone           Europe/London
```

### 2.1 Two Google links, and they are not interchangeable

**Read:** `https://www.google.com/maps/place/?q=place_id:ChIJxSluewCv2EcRgkwfgTqnij8`

Built from the Place ID by `buildGoogleProfileUrl` in `src/lib/business.ts`. This is
the stable, durable form and it is what the structured data's `sameAs` uses. It opens
the profile, where the reviews are.

**Write:** `https://g.page/r/CYJMH4E6p4o_EBM/review`

The link Google hands you under "Give customers a link to review your business". It
opens the write-a-review dialog directly, with no hunting for the button. This is the
value in `booking_settings.google_review_url`, and the review-request email's "Leave a
review" button uses it.

Until 2026-08-31 the app had one field doing both jobs, and it held a
`share.google` redirect. So "Read all reviews on Google" in the homepage footer, each
review card, the Testimonials call to action and the footer's Google icon all pointed
at the same place as the review request. Now the read surfaces use the profile URL and
the write link appears only on explicit "Leave a review" actions: the homepage reviews
block, the Testimonials page, and the email.

A `share.google` link is also not a durable identifier and should never go in
`sameAs`.


---

## 3. Google Business Profile

### 3.1 Business name

```
Kokolett Beauty UK
```

Nothing appended. Not `Kokolett Beauty UK | Hair Salon Thamesmead`, however tempting that looks. Google's representation guidelines treat a keyword-stuffed name as grounds for suspension, and a suspended listing costs far more than the keywords are worth. Location and service belong in the fields built for them, which is what the rest of this section fills in.

### 3.2 Category

Primary:

```
Hair salon
```

Additional, only if the picker offers them and only if accurate:

```
Hairdresser
Hair extension technician
```

Take the exact strings from the live picker rather than from this file, since Google renames categories without notice.

Do not add `Beauty salon`, `Nail salon`, `Barber shop`, `Eyebrow bar` or `Waxing hair removal service`. The business is women's hair only. A category implying otherwise brings in searchers who want something Christy does not do, which costs relevance and earns poor reviews.

### 3.3 Description

Paste as one block. 686 characters, inside Google's 750 limit. No URLs, no prices, no sales language, per the guidelines.

```
Kokolett Beauty UK is a women's hair salon in Thamesmead, South East London. Christy has been doing hair for over fifteen years and takes one client at a time, so appointments are unhurried and the finish gets the attention it needs.

Services cover braids, twists, weaves, cutting, colouring, styling and hair treatments, on natural and relaxed hair.

Booking is online. Times shown in the diary are genuinely free and confirm straight away. If nothing suits, send a request and Christy will come back to you.

Clients travel from Abbey Wood, Belvedere, Plumstead, Erith and Woolwich.
```

### 3.4 Contact

```
Phone:   07707 906408
Website: https://www.kokolettbeauty.com
```

### 3.5 Appointment link

A separate field from the website, and most profiles leave it empty.

```
https://www.kokolettbeauty.com/book
```

Someone who taps Book should land on the diary, not the homepage.

### 3.6 Address and service area

```
Redbourne Dr
London
SE28 8RX
United Kingdom
```

If clients visit the address, leave it shown. If the address is private, switch the listing to a service-area business: Google hides the street but still uses the postcode for distance.

Service areas, in this order:

```
Thamesmead
Abbey Wood
Belvedere
Plumstead
Erith
Woolwich
Charlton
Greenwich
Eltham
```

Belvedere and Erith were added on 2026-08-31. The salon sits on the Bexley side of
Thamesmead, so both are nearer than Charlton, Greenwich and Eltham, which were on the
list from the start. Reverse this if Christy does not actually see clients from them.

Do not add all of London. An oversized service area weakens the local signal instead of widening reach.

### 3.7 Hours

Google's hours, the site footer and the booking diary must agree. These are the current hours, derived from the live weekly availability template: the salon opens at 09:00 every day, and the closing time is the last bookable start plus the 45 minute appointment length.

```
Monday      09:00 to 18:45
Tuesday     09:00 to 16:45
Wednesday   09:00 to 17:45
Thursday    09:00 to 17:45
Friday      09:00 to 17:45
Saturday    09:00 to 17:45
Sunday      09:00 to 17:45
```

Re-derive these whenever the weekly template changes, and update Google, the profile and `index.html` together. `docs/GO-LIVE.md` §3 carries the same instruction.

Use Special hours for holidays and one-off closures. Never edit the regular pattern for a single day, or the profile drifts permanently and nobody remembers what the real pattern was.

### 3.8 Services

Six service groups, taken verbatim from the owner console's service menu, which is the source of truth. Google, Instagram and `/services` all name the same six. Each description sits inside Google's 300 character limit.

Add each group as a Google service, then add its individual styles underneath as separate services where Google allows a custom entry. The individual names matter: people search for "knotless braids" and "silk press", not for "hair styling".

```
Braids
Knotless, box, cornrow, feed-in, Ghana, Fulani, lemonade, stitch, tribal and micro braids, plus braids for children. Sized and parted to suit your hair, with tension talked through before Christy starts.

Twists
Senegalese, passion, spring, Marley and two strand twists, sized and parted to suit your hair.

Weaves, wigs and extensions
Sew-in weaves, closure and frontal installs, quick weaves and crochet braids. Wig installs, customising and revamps. Tape-in and micro-link extensions, and take-down with detangle.

Natural hair and styling
Wash and go, silk press, blow dry and style, twist-outs and braid-outs. Cutting, trimming and shaping, big chop and transitioning support, bridal and occasion styling, relaxer and texturiser.

Colour
Full colour, root touch-ups, highlights and lowlights, bleaching and lifting, toning and glossing. Discussed against your hair's condition before anything is mixed.

Treatments
Deep conditioning, protein and bond repair, scalp treatment, steam treatment, hot oil treatment, and trim with split-end care.
```

**Individual styles worth listing separately on Google**, because each is its own search:

```
Braids                        Knotless braids · Box braids · Cornrows · Feed-in braids
                              Ghana braids · Fulani braids · Lemonade braids · Stitch braids
                              Tribal braids · Micro braids · Kids braids

Twists                        Senegalese twists · Passion twists · Spring twists
                              Marley twists · Two strand twists

Weaves, wigs and extensions   Sew-in weave · Closure and frontal install · Quick weave
                              Crochet braids · Wig install · Wig customising and revamp
                              Tape-in extensions · Micro-link extensions
                              Take-down and detangle

Natural hair and styling      Wash and go · Silk press · Blow dry and style
                              Twist-out and braid-out · Cut, trim and shaping
                              Big chop and transitioning · Bridal and occasion styling
                              Relaxer and texturiser

Colour                        Full colour · Root touch-up · Highlights and lowlights
                              Bleaching and lifting · Toning and glossing

Treatments                    Deep conditioning · Protein and bond repair
                              Scalp treatment · Steam treatment · Hot oil treatment
                              Trim and split-end care
```

That is 44 styles across 6 groups, matching the console exactly. If someone asks for locs, the answer is no: see §1.3. When Christy adds or retires one in the console, change it on Google in the same sitting.

### 3.9 Attributes

Set only what is true. A false attribute is worse than an absent one, because somebody arrives and cannot get in.

Set now:

```
Service options   > Onsite services: yes
Planning          > Appointment required: yes
Planning          > Online appointments: yes
```

Confirm with Christy before ticking:

```
From the business > Identifies as women-owned
Accessibility     > Wheelchair accessible entrance
Accessibility     > Wheelchair accessible toilet
Accessibility     > Wheelchair accessible car park
Amenities         > Toilet
Amenities         > Wi-Fi
Amenities         > Gender-neutral toilet
Payments          > Credit cards, debit cards, NFC mobile payments
Crowd             > LGBTQ+ friendly, transgender safe space
```

### 3.10 Social links

Google's listing now carries social profile fields. Filling them is the other half of the `sameAs` signal the site emits from its structured data: the site says the Instagram account is ours, and the profile agrees.

```
Instagram: https://www.instagram.com/kokolettbeautyuk/
```

Leave Facebook, TikTok, X, LinkedIn, YouTube and Pinterest blank. Those accounts do not exist, and a dead link is worse than an empty field.

### 3.11 Questions and answers

You may post questions on your own profile and answer them. Answers are indexed and appear in the knowledge panel, so they are worth writing properly rather than in one line. Answer the locs one plainly: no, and here is what we do instead. A clear no in the knowledge panel saves an enquiry that was never going to become a booking.

Seed these five, then answer each in Christy's own words:

```
Do you do braids on natural hair?
Do you do locs?
How do I book an appointment?
What happens if there are no times available?
Where exactly are you in Thamesmead?
How long does a full head of braids take?
```

### 3.12 Posts

One a week is enough, and it has to be useful rather than an advert. Rotate through: a finished style, a piece of hair-care advice, availability for the coming week, a client transformation with consent, how the booking flow works, and Christy's answer to a question people keep asking.

---

## 4. Instagram

### 4.1 Profile photo

The logo on a plain background, square, legible at 32 pixels. It renders as a small circle in feed and search, so fine detail and full-width wordmarks disappear.

### 4.2 Name field

Searchable, and capped at 30 characters. Two options fit. Pick one.

```
Kokolett Beauty | Hair Salon
```

28 characters. Tells a stranger what the business does.

```
Kokolett Beauty · Thamesmead
```

28 characters. Tells them where it is.

Instagram's search weights this field more heavily than the bio. The first is the recommendation: someone searching Instagram for a salon does not yet know they want Thamesmead, and the bio carries the location on the very next line anyway.

### 4.3 Username

```
kokolettbeautyuk
```

Keep it. Changing a handle breaks every link pointing at it, including the one on the Google profile.

### 4.4 Bio

Capped at 150 characters. This is 112.

```
Women's hair salon · Thamesmead, SE London
Braids, twists, weaves, colour, cutting
15+ years · Christy
Book below
```

### 4.5 Links

Instagram allows up to five. Use two, and not a link aggregator, since every extra hop loses people.

```
Book an appointment   https://www.kokolettbeauty.com/book
Our work              https://www.kokolettbeauty.com/gallery
```

### 4.6 Category

```
Hair Salon
```

Not `Beauty, Cosmetic & Personal Care`, which is wider than the business.

### 4.7 Contact options

```
Call:      07707 906408
Email:     booking@kokolettbeauty.com
Address:   Redbourne Dr, London SE28 8RX
```

Adding the address turns on the map on the profile and is a real local signal. Leave it off if the address is private, in which case keep Call and Email only.

Instagram's native Book action button only works through an approved booking partner. Kokolett takes bookings on its own site, so that button is not available. The bio link is the route, which is why it points at `/book` rather than the homepage.

### 4.8 Highlights

Nine, not thirteen. A profile with too many covers is one nobody reads. Use the same cover style throughout, in the brand terracotta.

```
BOOK · BRAIDS · TWISTS · WEAVES · NATURAL HAIR · COLOUR · TREATMENTS · REVIEWS · ABOUT
```

### 4.9 Pinned posts

Three slots sit at the top of the grid. Use them for:

1. The strongest braids transformation.
2. Meet Christy, carrying the fifteen years.
3. How booking works.

### 4.10 Content pillars

| Pillar | Share |
| --- | --- |
| Finished hair | 25% |
| Transformations | 20% |
| Hair education | 20% |
| Behind the scenes | 15% |
| Client experience and reviews | 10% |
| Booking and availability | 10% |

Seventy percent gives something away before asking for anything. An account that only posts "book now" stops being followed.

### 4.11 Captions

Write the first line as if it were the whole post, because in the feed it often is. Say what the style is, say where you are, then invite the booking. A shape to copy, not a template to reuse word for word:

```
Knotless braids, taken to mid-back and parted small so they sit flat.

Christy talks through tension before starting, because braids that are
too tight are the fastest way to lose your edges.

Thamesmead, South East London. Availability is on the website.
```

---

## 5. Photography and alt text

### 5.1 The four sets

Upload deliberately rather than in bulk. The same library serves Google, Instagram and the site gallery.

- **Identity:** logo, cover photo, Christy, exterior, entrance, interior, styling station.
- **Work:** braids, twists, weaves, colour, styling, cutting, treatments. At least two finished results each.
- **Experience:** the space before a client arrives, work in progress, close detail on a finish.
- **Trust:** tools, the clean station, the seating.

No blurry shots, no screenshots, no price graphics, no text-heavy posters, no stock photography. Client photographs need explicit consent, recorded.

### 5.2 File naming

Name every file before uploading anywhere.

```
kokolett-beauty-thamesmead-knotless-braids.jpg
kokolett-beauty-thamesmead-senegalese-twists.jpg
kokolett-beauty-womens-hair-colour-thamesmead.jpg
```

### 5.3 Alt text

Formula: subject, service, business, location. It applies on the site, and on Instagram where almost nobody bothers.

```
Finished knotless braids styled at Kokolett Beauty UK, a women's hair
salon in Thamesmead, South East London.
```

Describe the actual image. Do not stack keywords. Alt text is an accessibility feature first and a search signal second, and treating it the other way round produces something useless for both.

---

## 6. Reviews

Every review gets a reply, and the replies are not copy-paste. Reference what the person actually mentioned. A critical review gets a professional acknowledgement in public and the detail moved to a private channel.

Ask for honest feedback, never for five stars, and never offer anything in exchange. Incentivised reviews breach Google's policies and put the listing at risk.

The review-request email already exists and fires a couple of hours after an
appointment is marked complete. It asks for a genuine account of the visit rather than
a rating, which is both the compliant approach and the one that produces reviews
mentioning the things future clients search for.

Two mechanics worth knowing before changing anything here:

- **The email only queues when `google_review_url` is set.** The trigger checks it
  (`0005`, `0015`, `0016`). Clear that field and review requests stop silently.
- **The owner's Template Editor overlay does not apply unless a template is both
  `active` and `include_in_automation`.** Both are `active` with
  `include_in_automation` off today, so the built-in copy in
  `supabase/functions/_shared/templates.ts` is what actually sends, including its
  "Leave a review" button. The `review_request` row in `email_templates` contains no
  link at all, so switching automation on for it without adding one would send a
  review request nobody can act on.

---

## 7. Content plan

Ninety days, one theme a week, one service page's worth of attention at a time.

**Month one, foundation.** Week 1 is profile work: everything in §3 and §4, plus the site changes in §9. Weeks 2 to 4 take braids, then twists, then weaves. Each week: two Instagram posts, one reel, three stories, one Google post.

**Month two, authority.** Weeks 5 to 8 take styling, colour, treatments, then client experience. Same cadence.

**Month three, local.** Week 9 on Thamesmead and the surrounding areas. Week 10 on South East London more widely. Week 11 on Christy and the fifteen years. Week 12 on client proof: reviews, transformations, real experiences.

The engine underneath is that one appointment produces one photograph, and that photograph becomes an Instagram post, a story, a site gallery image, a Google profile photo and a Google post. Content follows the work rather than being invented separately from it.

---

## 8. Keyword and intent map

Five layers, in the order they are winnable.

| Layer | Examples | Where it is won |
| --- | --- | --- |
| Brand | kokolett beauty, kokolett beauty uk, kokolett thamesmead | Profile completeness, consistent naming, `sameAs` |
| Local | hair salon thamesmead, hairdresser thamesmead, women's hair salon se28 | Google profile, categories, reviews, proximity |
| Service plus place | knotless braids thamesmead, passion twists thamesmead, sew-in weave abbey wood, silk press se28 | Google services, site services copy, `makesOffer` |
| Informational | how long do knotless braids last, how long do passion twists last, is a silk press bad for natural hair | FAQ page, Google Q&A, Instagram education posts |
| Brand plus service | kokolett beauty braids, kokolett beauty twists | All of the above, once they agree with each other |

Be honest about the ceiling. A one-chair salon in SE28 competes for searchers near SE28. It does not compete with Treatwell or Fresha nationally, and trying to costs effort that would pay off locally.

---

## 9. SEO review findings

Reviewed 2026-08-31 against the codebase, not against what the docs claim. Severity uses the legend in `docs/KOKO_GAP.md` §1.

| # | Finding | Evidence | Impact | Fix | Priority |
| --- | --- | --- | --- | --- | --- |
| 1 | Every page shared the homepage's canonical, Open Graph and Twitter tags | `useDocumentMeta` set title and description only; canonical, OG and Twitter were static in `index.html` | 🔴 High. Eight pages told Google they were the homepage. Every shared link previewed as the homepage. | Hook extended to manage canonical, OG, Twitter and robots per route | P0 |
| 2 | Six public routes set no metadata at all | Home, Book, Request availability, Subscribe, three policy pages, 404 | 🔴 High. The homepage had no page-level control. | Hook called on all of them, `noindex` on the 404 | P0 |
| 3 | No `sameAs` in the structured data | `index.html` JSON-LD | 🔴 High. Google was never told the Instagram account belongs to this business. | `sameAs` added for Instagram and the Google profile | P0 |
| 4 | Two competing salon entities | `TestimonialsPage` emitted a second `HairSalon` with no `@id` and a trailing-slash URL differing from the first | 🔴 High. The star rating attached to a different entity than the salon. | Shared `@id`, duplicated name and url dropped | P0 |
| 5 | Locality contradiction | JSON-LD said SE28 8RX, About page said Woolwich | 🔴 High. Site and verified profile disagreed on where the business is. | Thamesmead everywhere, Woolwich as an area served | P0 |
| 6 | Owner had two names in production | About page said Christy, the AI assistant prompt said Koko | ⚠️ Both customer-visible | Christy in both | P0 |
| 7 | `areaServed` was the whole United Kingdom | `index.html` JSON-LD | 🟡 Medium. The opposite of a local signal on a one-chair salon. | Replaced with the seven real service areas | P1 |
| 8 | No apex to www redirect | `.htaccess` forced HTTPS and rewrote for the SPA, nothing else | 🟡 Medium. Canonical, sitemap and OG all use `www.`, so the apex was an uncanonicalised duplicate. | 301 added | P1 |
| 9 | Social card was a square app icon | OG and Twitter both pointed at `pwa-512.png`, `twitter:card` was `summary` | 🟡 Medium. Every share looked like an app install. | 1200x630 card, `summary_large_image` | P1 |
| 10 | Structured data missing `@id`, `geo`, `addressRegion`, `logo`, `founder`, `makesOffer` | `index.html` JSON-LD | 🟡 Medium. A thin entity is a weak entity. | All added | P1 |
| 11 | Opening hours existed twice and could disagree | JSON-LD hardcoded 08:00 to 20:00 daily; the footer derived real hours from the availability template | 🟡 Medium. Wrong hours in search results is a real-world failure, not only a ranking one. | Static block corrected, hand-sync step added to `GO-LIVE.md` §3 | P1 |
| 12 | Sitemap `lastmod` frozen at 2026-08-25 | all entries in `public/sitemap.xml` | 🟡 Medium | Refreshed | P1 |
| 13 | No `BreadcrumbList`, no `WebSite` node, no `Service` schema | nowhere in the repo | 🟡 Medium. Forgoes breadcrumb display in results. | All three added | P1 |
| 14 | Business facts scattered across the codebase | the contact email hardcoded in four frontend files, the site origin in about sixteen, the map URL prefix built twice | 🟡 Medium. This is the mechanism by which the surfaces drifted apart. | One `src/lib/business.ts` | P1 |
| 15 | Em and en dashes in customer-visible strings | `lib/errors.ts`, `OfflineBanner`, `ErrorBoundary`, `ResetPasswordPage`, `offline.html`, the PWA manifest, and the live email template seed | 🟡 Medium | Swept, then gated in CI | P1 |
| 16 | Nothing enforced the no-dash rule | the hookify rule was advisory, covered none of those paths, and did not match en dashes | 🟡 Medium. Em dashes reached the live database once already, which is why `0020_subject_lines_without_em_dashes.sql` exists. | Rule widened, `npm run lint:copy` added to CI | P1 |
| 17 | Site services and console services could diverge | `ServicesPage` renders `service_menu`, and nothing tied those rows to what Google and Instagram advertise | 🟡 Medium | All three aligned on the clusters in §3.8 | P1 |
| 18 | `useDocumentMeta` undocumented | `docs/HOOKS.md` documented twenty hooks and omitted it | 🟡 Low | Documented | P2 |
| 19 | PWA manifest description was developer-facing | "passwordless for customers, one dashboard for the owner", shown in the install prompt | 🟡 Low | Rewritten for a customer | P2 |
| 20 | Locs advertised across every surface, and not offered | `service_menu` seeded five loc styles in `0018`; they reached the meta descriptions, the structured data, the footer, the FAQ answer and the AI assistant's grounding prompt | 🔴 High. Not a ranking problem. A customer books, arrives, and the service does not exist. | Retired in `0066_retire_locs.sql`, group renamed to Twists, swept from every surface. See §1.3 | P0 |
| 21 | Gallery photographs were CSS backgrounds on `aria-hidden` divs | `PhotoCard` painted `background-image` on a decorative div | 🟡 Medium. No alt text, and image search cannot index a background image, so the salon's own work was invisible to Google Images. | Rendered as a real `<img>` with alt text built from the style name, business and locality | P1 |
| 22 | Five mild clichés on the About page | About page, and one line on the home page | 🟡 Low | Rewritten, no claim changed | P2 |

### 9.1 Checked and clean

Recorded so nobody re-audits them. `robots.txt` correctly allows crawling and blocks `/dashboard`, `/my`, `/access` and `/login`. The sitemap covers every public route. HTTPS is forced. The marketing pages carry no AI vocabulary, no negative parallelism and no em dashes. Rendered email copy in `_shared/templates.ts` is clean. There is no keyword stuffing anywhere on the site.

### 9.2 Deliberately not done

Prerendering the single-page app. Googlebot renders JavaScript, and a prerender step would collide with the CSP hash and PWA artefact assertions already in CI. Revisit only if Search Console reports rendering failures.

Booking-source tracking and a marketing dashboard. Out of scope by decision.

Facebook and TikTok. Those accounts do not exist.

---

## 10. What not to do

Buying reviews, followers or backlinks. Incentivising five-star reviews. Keyword-stuffing the profile name. Creating a second Google listing for the same business. Building thin location pages for Greenwich, Charlton and Plumstead that say the same thing with the place name swapped. Advertising services Christy does not offer. Changing the business name, handle or category repeatedly. Fake testimonials. Copying a competitor's copy.

Most of these carry a suspension or a manual action. None of them are worth it for a business whose growth comes from doing good hair and being findable by people two miles away.

---

## 11. Measurement

Search Console and the Google profile's own insights are enough. Nothing here requires a change to the application.

From Google: profile views, search versus maps impressions, website clicks, calls, direction requests, review count, average rating, and the search terms the profile surfaced for.

From Search Console: impressions and clicks by query and by page, average position for the terms in §8, coverage and indexing status, and Core Web Vitals.

Review monthly. A local profile moves slowly, and reading it weekly produces noise rather than signal.

---

## 12. Open questions

Answers needed from Christy before the relevant fields are filled.

- The accessibility, amenities, payments and crowd attributes in §3.9.
- The six group descriptions in §3.8, written from the 44 style names live in the console, which she should correct where they misdescribe what she actually does.
- Whether the `geo` coordinate should be the exact shop pin rather than the postcode
  centroid. The structured data now carries **51.512543, 0.126009**, the Office for
  National Statistics centroid for SE28 8RX read from `api.postcodes.io`. That is real,
  sourced data rather than a guess, and it is accurate to the postcode. If the pin on
  the Google profile sits somewhere meaningfully different, use that instead.
- Which of the two Instagram name fields in §4.2 to use. Only one fits in 30 characters.
- Whether the street address stays public on Google and on Instagram, or whether the listing becomes a service-area business.

---

## 13. See also

| Need | File |
| --- | --- |
| Coding standards, including the copy rules | `docs/RULES.md` §9.7, §9.9 |
| Folder layout and routing | `docs/ARCHITECTURE.md` |
| Hand-keyed go-live data | `docs/GO-LIVE.md` §3 |
| Product scope and the no-price policy | `docs/PRD.md` §7 |
| Hook contracts, including `useDocumentMeta` | `docs/HOOKS.md` |
