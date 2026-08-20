# Moving to a custom domain

The site is a GitHub Pages *project* site, so it is served from
`starnerz.github.io/daraja-docs/`. That caps what the site can do: `robots.txt`
is only read from the root of a domain, authority accrues to `github.io` rather
than to you, and the display URL is a poor one to put on anything commercial.

Everything in the repository derives its URLs from two lines in
`astro.config.mjs`, so the move is small. This is the whole checklist.

## 1. Buy the domain

Short and literal beats clever — `laraveldaraja.com`, `daraja.dev`,
`usedaraja.com`. Around $12–15 a year.

## 2. Point DNS at GitHub Pages

For an apex domain (`example.com`), four `A` records:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

For a `www` or other subdomain, one `CNAME` record to `starnerz.github.io`.

Use the apex plus a `www` redirect, and confirm the current addresses in
[GitHub's docs](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site)
before trusting the list above.

## 3. Tell the repository

Create `public/CNAME` containing the bare hostname and nothing else:

```
laraveldaraja.com
```

Committing it survives redeploys; setting the domain only in Settings → Pages
does not, because each Actions deploy replaces the published tree.

## 4. Flip the two lines

In `astro.config.mjs`:

```js
const SITE = 'https://laraveldaraja.com';
const BASE = undefined;
```

That single change corrects the canonical tags, the sitemap, `robots.txt`, the
OpenGraph image URLs, the JSON-LD, `llms.txt` and every internal link. Run
`npm run build` and check `dist/robots.txt` and `dist/index.html` before pushing.

## 5. Enforce HTTPS

Settings → Pages → **Enforce HTTPS**, once the certificate has been issued
(usually a few minutes, occasionally an hour). GitHub then 301-redirects the old
`starnerz.github.io/daraja-docs/*` URLs to the new domain, so nothing already
published or linked is lost.

## 6. Update the places that name the old URL

- `laravel-daraja/composer.json` — `homepage` and `support.docs`
- `laravel-daraja/README.md` — the documentation links
- `laravel-daraja/CHANGELOG.md` — the upgrade-guide link
- Both repositories' **About → Website** field (`gh repo edit --homepage …`)
- Packagist picks up `composer.json` on the next release

## 7. Register the new domain with search engines

- **Google Search Console** — add the domain property, verify by DNS `TXT`, and
  submit `https://<domain>/sitemap-index.xml`. Set the verification token as the
  `GOOGLE_SITE_VERIFICATION` repository variable if you would rather verify by
  meta tag.
- **Bing Webmaster Tools** — import from Search Console, or set
  `BING_SITE_VERIFICATION`. Bing is what feeds ChatGPT's search.

Six weeks of Search Console query data is worth more than any keyword tool for
deciding what to write next.

## 8. Turn analytics on

Set **one** of these as a repository variable (Settings → Secrets and variables
→ Actions → Variables). The deploy workflow passes them to the build:

| Variable | Effect |
| --- | --- |
| `PLAUSIBLE_DOMAIN` | Cookieless analytics. No consent banner needed. |
| `GA4_MEASUREMENT_ID` | Google Analytics 4. Required for Google Ads conversion import. |

`GA4_MEASUREMENT_ID` sets cookies, which means a consent banner is required for
EU/UK visitors and consent is the safer reading of Kenya's Data Protection Act
(2019) too. There is no banner in this repository — add one before enabling GA4,
or stay on Plausible. The privacy policy adjusts itself to whichever is set.
