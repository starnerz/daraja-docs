# daraja-docs

Documentation for [starnerz/laravel-daraja](https://github.com/starnerz/laravel-daraja),
a Laravel package for the Safaricom M-Pesa Daraja APIs.

Published at **https://starnerz.github.io/daraja-docs/** — moving to a custom
domain, see [DOMAIN-SWITCH.md](DOMAIN-SWITCH.md).

## Local development

Requires Node 22.12 or higher — Astro rejects older and odd-numbered releases.
`.nvmrc` pins the major version.

```bash
npm install
npm run dev      # http://localhost:4321/daraja-docs
npm run build    # writes to dist/
npm run preview  # serve the built site
```

Regenerate the lock file with the npm the CI runner uses, not whatever is
installed locally. Node 22 ships npm 10; npm 11 omits optional dependencies —
`@emnapi/runtime`, reached through sharp's wasm fallback — that npm 10's
`npm ci` then refuses to install:

```bash
npx npm@10 install --package-lock-only
```

## Structure

```
src/
├── content/docs/
│   ├── index.mdx             landing page
│   ├── getting-started/      install, configure, sandbox
│   ├── apis/                 one page per API family
│   ├── guides/               callbacks, testing, credentials, going live
│   ├── reference/            config, events, exceptions, commands, error codes
│   ├── upgrade/              4.x to 5.0
│   ├── changelog.md          generated — see below
│   └── legal/                privacy policy
├── components/               HireMe, AnalyticsPolicy
├── pages/
│   ├── og/[...route].ts      one OpenGraph card per page
│   └── robots.txt.ts
├── routeData.ts              search titles, OG tags, JSON-LD
└── seo.ts                    the search-title map
```

Sidebar order is defined in `astro.config.mjs`, not inferred from the file tree.

## Search titles

Starlight uses one `title` for the sidebar label, the `<h1>` and the `<title>`.
Sidebar labels want to be short; `<title>` wants the words people actually type.
`src/seo.ts` maps route ids to search titles and `src/routeData.ts` swaps them
in, so the two can differ. A page with no entry there keeps Starlight's default.

## Structured data

`src/routeData.ts` emits JSON-LD on every page: `SoftwareSourceCode` and
`SoftwareApplication` on the home page, `TechArticle` elsewhere, and
`BreadcrumbList` throughout. Pages may also declare `faq` in their frontmatter
to publish `FAQPage` markup:

```yaml
faq:
    - question: What are the Daraja sandbox test credentials?
      answer: >-
        The Test Credentials page in the developer portal supplies …
```

Only ever mark up answers that are **visible on the page**. Invisible FAQ markup
is a rich-results violation and the fastest way to lose them.

Validate changes with [Google's Rich Results Test](https://search.google.com/test/rich-results)
or [Schema.org's validator](https://validator.schema.org).

## OpenGraph images

`src/pages/og/[...route].ts` renders a 1200×630 card per page from its title and
description, using the fonts in `src/fonts/` and `src/assets/logo-og.png`. They
are cached in `node_modules/.astro-og-canvas` between local builds. To restyle
them, edit `getImageOptions` and delete that cache.

Regenerate `src/assets/logo-og.png` from the SVG with:

```bash
node -e "require('sharp')('src/assets/logo.svg',{density:600}).resize(160,160).png().toFile('src/assets/logo-og.png')"
```

## Repository social previews

`npm run social` renders `social/laravel-daraja.png` and
`social/daraja-docs.png` at 1280×640 — the image GitHub shows when a repo is
shared on Slack, X or WhatsApp. There is no API for setting it, so upload each
one under Settings → Social preview on the matching repository.

## Machine-readable docs

`starlight-llms-txt` publishes `/llms.txt`, `/llms-small.txt` and
`/llms-full.txt` — a clean corpus for AI coding assistants, which is an
increasingly large share of "which M-Pesa package should I use". Configured
under `plugins` in `astro.config.mjs`.

## Changelog page

`src/content/docs/changelog.md` is generated from the package's `CHANGELOG.md`
and committed. Refresh it after each release:

```bash
npm run sync:changelog                              # from the package's default branch
npm run sync:changelog -- ../laravel-daraja/CHANGELOG.md   # from a local checkout
```

## Analytics and verification

No analytics ship by default. The build emits tags only for the environment
variables that are set, passed through by the deploy workflow from repository
variables:

| Variable | Effect |
| --- | --- |
| `PLAUSIBLE_DOMAIN` | Cookieless analytics. |
| `GA4_MEASUREMENT_ID` | Google Analytics 4. Sets cookies — read [DOMAIN-SWITCH.md](DOMAIN-SWITCH.md) first. |
| `GOOGLE_SITE_VERIFICATION` | `google-site-verification` meta tag. |
| `BING_SITE_VERIFICATION` | `msvalidate.01` meta tag. |

The privacy policy renders itself from the same variables, so it cannot drift
from what the deployed site actually measures.

## Deployment

Pushing to `main` builds and deploys via `.github/workflows/deploy.yml`.
GitHub Pages must be set to **GitHub Actions** as its source under
Settings → Pages.

## Source of truth

API details come from the Safaricom developer portal, recorded in the package
repository under `docs/api-specs/`. When Safaricom changes an endpoint, update
the spec there first, then the page here.

## Built with

[Astro](https://astro.build) and [Starlight](https://starlight.astro.build).
