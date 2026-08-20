import type { APIRoute } from 'astro';

/**
 * Crawlers only read robots.txt from the root of a domain, so while the site
 * lives under `/daraja-docs/` this file is served but ignored. It starts
 * working the moment the custom domain is in place — see DOMAIN-SWITCH.md.
 */
export const GET: APIRoute = ({ site }) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const sitemap = site ? new URL(`${base}/sitemap-index.xml`, site).href : undefined;

    const body = [
        'User-agent: *',
        'Allow: /',
        // Note /og/ is deliberately crawlable: facebookexternalhit and
        // Twitterbot both honour robots.txt, so disallowing the generated
        // cards would break the link previews they exist for.
        ...(sitemap ? ['', `Sitemap: ${sitemap}`] : []),
        '',
    ].join('\n');

    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
};
