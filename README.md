# daraja-docs

Documentation for [starnerz/laravel-daraja](https://github.com/starnerz/laravel-daraja),
a Laravel package for the Safaricom M-Pesa Daraja APIs.

Published at **https://starnerz.github.io/daraja-docs/**

## Local development

Requires Node 22.12 or higher — Astro rejects older and odd-numbered releases.
`.nvmrc` pins the major version.

```bash
npm install
npm run dev      # http://localhost:4321/daraja-docs
npm run build    # writes to dist/
npm run preview  # serve the built site
```

## Structure

```
src/content/docs/
├── index.mdx                 landing page
├── getting-started/          install, configure, sandbox
├── apis/                     one page per API family
├── guides/                   callbacks, testing, credentials, going live
├── reference/                config, events, exceptions, commands, error codes
└── upgrade/                  v1 to v2
```

Sidebar order is defined in `astro.config.mjs`, not inferred from the file tree.

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
