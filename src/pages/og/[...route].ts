import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import { ogImageId, routeId, seoTitles } from '../../seo';

/**
 * One 1200×630 card per docs page, rendered at build time and cached in
 * `node_modules/.astro-og-canvas` between builds. Referenced from every page
 * by `src/routeData.ts`.
 */
const entries = await getCollection('docs');

const pages = Object.fromEntries(
    entries.map((entry) => [
        ogImageId(entry.id),
        {
            title: seoTitles[routeId(entry.id)] ?? entry.data.title,
            description: entry.data.description ?? '',
        },
    ]),
);

export const { getStaticPaths, GET } = await OGImageRoute({
    pages,
    getImageOptions: (_path, page: { title: string; description: string }) => ({
        title: page.title,
        description: page.description,
        logo: { path: './src/assets/logo-og.png', size: [76] },
        // Same palette as the site: deep green ground, Safaricom-adjacent accent.
        bgGradient: [
            [13, 42, 21],
            [23, 32, 27],
        ],
        border: { color: [23, 132, 59], width: 20, side: 'inline-start' },
        padding: 70,
        fonts: ['./src/fonts/inter-700.ttf', './src/fonts/inter-400.ttf'],
        font: {
            title: {
                families: ['Inter'],
                weight: 'Bold',
                size: 62,
                lineHeight: 1.15,
                color: [255, 255, 255],
            },
            description: {
                families: ['Inter'],
                weight: 'Normal',
                size: 30,
                lineHeight: 1.4,
                color: [166, 233, 189],
            },
        },
    }),
});
