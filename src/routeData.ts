import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { ogImageId, sectionLabels, seoTitles } from './seo';

const PACKAGE_REPO = 'https://github.com/starnerz/laravel-daraja';
const AUTHOR = { '@type': 'Person', name: 'Stanley Mbaabu' } as const;

/** JSON is inlined into a `<script>`, so no raw `<` may survive. */
function jsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, '\u003c');
}

/**
 * Adds what Starlight does not: search-facing `<title>`s, a per-page
 * OpenGraph image, and structured data. Registered as `routeMiddleware`
 * in `astro.config.mjs`, so it runs for every page.
 */
export const onRequest = defineRouteMiddleware((context) => {
    const route = context.locals.starlightRoute;
    const { entry, id, head } = route;
    const site = context.site;

    // Search title, independent of the sidebar label. Starlight has already
    // put a `<title>` in the head, so replace it rather than adding a second.
    const seoTitle = seoTitles[id];
    if (seoTitle) {
        const title = head.find((tag) => tag.tag === 'title');
        if (title) title.content = seoTitle;
        else head.push({ tag: 'title', content: seoTitle });
    }

    if (!site) return;

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const absolute = (path: string) => new URL(`${base}${path}`, site).href;
    const pageUrl = new URL(context.url.pathname, site).href;
    const ogImage = absolute(`/og/${ogImageId(id)}.png`);

    // Every share currently renders a blank card: `twitter:card` is set to
    // `summary_large_image` but no image is ever supplied.
    head.push(
        { tag: 'meta', attrs: { property: 'og:image', content: ogImage } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        {
            tag: 'meta',
            attrs: { property: 'og:image:alt', content: seoTitle ?? entry.data.title },
        },
        { tag: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
    );

    const graph: Record<string, unknown>[] = [];

    if (id === '') {
        graph.push(
            {
                '@type': 'WebSite',
                '@id': `${absolute('/')}#website`,
                url: absolute('/'),
                name: 'Laravel Daraja',
                description: entry.data.description,
                inLanguage: 'en',
            },
            {
                '@type': 'SoftwareSourceCode',
                '@id': `${absolute('/')}#package`,
                name: 'starnerz/laravel-daraja',
                description:
                    'Every Safaricom M-Pesa Daraja API as ordinary Laravel code — STK Push, C2B, B2C, QR, Ratiba. Typed responses, cached tokens, testable callbacks.',
                codeRepository: PACKAGE_REPO,
                programmingLanguage: { '@type': 'ComputerLanguage', name: 'PHP' },
                runtimePlatform: 'Laravel',
                license: 'https://opensource.org/licenses/MIT',
                url: absolute('/'),
                author: AUTHOR,
            },
            {
                '@type': 'SoftwareApplication',
                name: 'Laravel Daraja',
                applicationCategory: 'DeveloperApplication',
                operatingSystem: 'Any',
                url: absolute('/'),
                downloadUrl: 'https://packagist.org/packages/starnerz/laravel-daraja',
                softwareRequirements: 'PHP 8.3+, Laravel 12 or 13',
                author: AUTHOR,
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            },
        );
    } else {
        graph.push({
            '@type': 'TechArticle',
            '@id': `${pageUrl}#article`,
            headline: seoTitle ?? entry.data.title,
            name: entry.data.title,
            description: entry.data.description,
            url: pageUrl,
            inLanguage: 'en',
            author: AUTHOR,
            publisher: { '@type': 'Organization', name: 'Laravel Daraja', url: absolute('/') },
            isPartOf: { '@id': `${absolute('/')}#website` },
            ...(route.lastUpdated ? { dateModified: route.lastUpdated.toISOString() } : {}),
        });
    }

    // Breadcrumbs mirror the sidebar: home → section → page.
    const section = id.includes('/') ? id.split('/')[0]! : undefined;
    const crumbs = [
        { name: 'Laravel Daraja', item: absolute('/') },
        ...(section && sectionLabels[section] ? [{ name: sectionLabels[section]! }] : []),
        ...(id === '' ? [] : [{ name: entry.data.title, item: pageUrl }]),
    ];

    graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            ...(crumb.item ? { item: crumb.item } : {}),
        })),
    });

    // Pages may declare `faq` in their frontmatter — see `src/content.config.ts`.
    // Only ever mark up answers that are visible on the page itself.
    const faq = (entry.data as { faq?: { question: string; answer: string }[] }).faq;
    if (faq?.length) {
        graph.push({
            '@type': 'FAQPage',
            '@id': `${pageUrl}#faq`,
            mainEntity: faq.map(({ question, answer }) => ({
                '@type': 'Question',
                name: question,
                acceptedAnswer: { '@type': 'Answer', text: answer },
            })),
        });
    }

    head.push({
        tag: 'script',
        attrs: { type: 'application/ld+json' },
        content: jsonLd({ '@context': 'https://schema.org', '@graph': graph }),
    });
});
