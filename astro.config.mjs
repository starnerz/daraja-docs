// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Project site on GitHub Pages, so every URL is prefixed with the repo name.
export default defineConfig({
    site: 'https://starnerz.github.io',
    base: '/daraja-docs',
    integrations: [
        starlight({
            title: 'Laravel Daraja',
            description:
                'A Laravel package for the Safaricom M-Pesa Daraja APIs — STK Push, C2B, B2C, QR, Ratiba, Bill Manager and more.',
            logo: { src: './src/assets/logo.svg', replacesTitle: false },
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
                    items: [{ label: 'v1 to v2', slug: 'upgrade/v1-to-v2' }],
                },
            ],
        }),
    ],
});
