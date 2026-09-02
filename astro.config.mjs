// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

/*
 * ---------------------------------------------------------------------------
 * Site URL
 *
 * The docs are served from an apex custom domain, so pages sit at the root and
 * BASE stays undefined. `public/CNAME` is committed because each Actions deploy
 * replaces the published tree and a domain set only in Settings → Pages does
 * not survive that. Nothing else in the site hard-codes a URL — canonicals,
 * sitemap, robots.txt, OG images and JSON-LD all derive from these two lines.
 * Moving back to a project site means setting BASE to '/<repo>' again.
 * ---------------------------------------------------------------------------
 */
const SITE = 'https://laraveldaraja.com';
/** @type {string | undefined} */
const BASE = undefined;

/*
 * Analytics and search-engine verification come from the environment, so
 * turning them on later is a repository-variable change rather than a code
 * change. The deploy workflow passes them through; unset means no tag.
 */
const { PLAUSIBLE_DOMAIN, GA4_MEASUREMENT_ID, GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION } =
    process.env;

/** @type {NonNullable<Parameters<typeof starlight>[0]['head']>} */
const head = [];

if (GOOGLE_SITE_VERIFICATION) {
    head.push({
        tag: 'meta',
        attrs: { name: 'google-site-verification', content: GOOGLE_SITE_VERIFICATION },
    });
}

if (BING_SITE_VERIFICATION) {
    head.push({ tag: 'meta', attrs: { name: 'msvalidate.01', content: BING_SITE_VERIFICATION } });
}

// Plausible is cookieless, which keeps the site clear of consent banners.
if (PLAUSIBLE_DOMAIN) {
    head.push({
        tag: 'script',
        attrs: {
            defer: true,
            'data-domain': PLAUSIBLE_DOMAIN,
            src: 'https://plausible.io/js/script.js',
        },
    });
}

// GA4 sets cookies. Only worth it if Google Ads conversion import is wanted,
// and the privacy policy needs updating when it goes on.
if (GA4_MEASUREMENT_ID) {
    head.push(
        {
            tag: 'script',
            attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`,
            },
        },
        {
            tag: 'script',
            content: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA4_MEASUREMENT_ID}');`,
        },
    );
}

export default defineConfig({
    site: SITE,
    base: BASE,
    integrations: [
        starlight({
            title: 'Laravel Daraja',
            description:
                'A Laravel package for the Safaricom M-Pesa Daraja APIs — STK Push, C2B, B2C, QR, Ratiba, Bill Manager and more.',
            logo: { src: './src/assets/logo.svg', replacesTitle: false },
            head,
            // Starlight's footer, plus the trademark notice under it.
            components: {
                Footer: './src/components/Footer.astro',
            },
            // Search titles, OpenGraph images and JSON-LD.
            routeMiddleware: './src/routeData.ts',
            plugins: [
                starlightLlmsTxt({
                    projectName: 'starnerz/laravel-daraja',
                    description:
                        'A Laravel package wrapping every Safaricom M-Pesa Daraja API — STK Push (M-Pesa Express), C2B, B2C, B2B, Dynamic QR, M-Pesa Ratiba, Bill Manager, Pull Transactions and Lipa na Bonga — with typed responses, cached OAuth tokens, and callbacks that can be tested with Http::fake().',
                    details: [
                        'Install with `composer require starnerz/laravel-daraja`. Requires PHP 8.3+ and Laravel 12 or 13.',
                        'Everything is reached through the `Daraja` facade, e.g. `Daraja::stk()->push(...)`.',
                        'Callbacks arrive as typed Laravel events rather than raw JSON payloads.',
                    ].join('\n\n'),
                    optionalLinks: [
                        {
                            label: 'Packagist',
                            url: 'https://packagist.org/packages/starnerz/laravel-daraja',
                            description: 'Released versions and the install command.',
                        },
                        {
                            label: 'Source',
                            url: 'https://github.com/starnerz/laravel-daraja',
                            description: 'The package itself, including its test suite.',
                        },
                        {
                            label: 'Safaricom Daraja portal',
                            url: 'https://developer.safaricom.co.ke',
                            description: 'Safaricom API documentation and credentials.',
                        },
                    ],
                }),
            ],
            social: [
                {
                    icon: 'github',
                    label: 'GitHub',
                    href: 'https://github.com/starnerz/laravel-daraja',
                },
            ],
            editLink: {
                baseUrl: 'https://github.com/starnerz/daraja-docs/edit/main/',
            },
            customCss: ['./src/styles/custom.css'],
            lastUpdated: true,
            sidebar: [
                {
                    label: 'Getting started',
                    items: [
                        { label: 'Introduction', slug: 'getting-started/introduction' },
                        { label: 'Installation', slug: 'getting-started/installation' },
                        { label: 'Configuration', slug: 'getting-started/configuration' },
                        { label: 'Sandbox credentials', slug: 'getting-started/sandbox' },
                    ],
                },
                {
                    label: 'APIs',
                    items: [
                        { label: 'Overview', slug: 'apis/overview' },
                        { label: 'M-Pesa Express (STK Push)', slug: 'apis/mpesa-express' },
                        { label: 'Customer to Business', slug: 'apis/c2b' },
                        { label: 'Business to Customer', slug: 'apis/b2c' },
                        { label: 'Business to Business', slug: 'apis/b2b' },
                        { label: 'Account services', slug: 'apis/account-services' },
                        { label: 'Dynamic QR', slug: 'apis/dynamic-qr' },
                        { label: 'M-Pesa Ratiba', slug: 'apis/standing-orders' },
                        { label: 'Bill Manager', slug: 'apis/bill-manager' },
                        { label: 'Pull Transactions', slug: 'apis/pull-transactions' },
                        { label: 'Lipa na Bonga', slug: 'apis/lipa-na-bonga' },
                    ],
                },
                {
                    label: 'Guides',
                    items: [
                        { label: 'Handling callbacks', slug: 'guides/callbacks' },
                        { label: 'Testing', slug: 'guides/testing' },
                        { label: 'Security credentials', slug: 'guides/security-credentials' },
                        { label: 'Going live', slug: 'guides/going-live' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'Configuration', slug: 'reference/configuration' },
                        { label: 'Events', slug: 'reference/events' },
                        { label: 'Exceptions', slug: 'reference/exceptions' },
                        { label: 'Artisan commands', slug: 'reference/commands' },
                        { label: 'Error codes', slug: 'reference/error-codes' },
                    ],
                },
                {
                    label: 'Upgrading',
                    items: [{ label: '4.x to 5.0', slug: 'upgrade/v4-to-v5' }],
                },
                {
                    label: 'Project',
                    items: [
                        { label: 'Changelog', slug: 'changelog' },
                        { label: 'Privacy', slug: 'legal/privacy' },
                    ],
                },
            ],
        }),
    ],
});
