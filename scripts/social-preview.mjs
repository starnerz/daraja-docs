/**
 * Renders the 1280×640 social preview images GitHub shows when a repository is
 * shared. Upload the results under Settings → Social preview on each repo —
 * GitHub has no API for this, so it is the one manual step.
 *
 *   npm run social
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { generateOpenGraphImage } from 'astro-og-canvas';

const OUT = new URL('../social/', import.meta.url);

const base = {
    logo: { path: './src/assets/logo-og.png', size: [88] },
    bgGradient: [
        [13, 42, 21],
        [23, 32, 27],
    ],
    border: { color: [23, 132, 59], width: 22, side: 'inline-start' },
    padding: 72,
    fonts: ['./src/fonts/inter-700.ttf', './src/fonts/inter-400.ttf'],
    font: {
        title: {
            families: ['Inter'],
            weight: 'Bold',
            size: 64,
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
};

const repos = {
    'laravel-daraja': {
        title: 'starnerz/laravel-daraja',
        description:
            'Every Safaricom M-Pesa Daraja API as ordinary Laravel code — STK Push, C2B, B2C, QR, Ratiba.',
    },
    'daraja-docs': {
        title: 'Laravel Daraja documentation',
        description: 'Guides and API reference for the M-Pesa Daraja package for Laravel.',
    },
};

await mkdir(OUT, { recursive: true });

for (const [name, page] of Object.entries(repos)) {
    const card = await generateOpenGraphImage({ ...base, ...page });

    // The renderer is fixed at 1200×630; GitHub crops to 2:1, so do the crop
    // here rather than letting it trim the text.
    const resized = await sharp(Buffer.from(card))
        .resize(1280, 640, { fit: 'cover' })
        .png()
        .toBuffer();

    const file = new URL(`${name}.png`, OUT);
    await writeFile(file, resized);
    console.log(`Wrote social/${name}.png (${Math.round(resized.length / 1024)} KB)`);
}
