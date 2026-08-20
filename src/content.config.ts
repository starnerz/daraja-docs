import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
    docs: defineCollection({
        loader: docsLoader(),
        schema: docsSchema({
            extend: z.object({
                /**
                 * Questions and answers to publish as `FAQPage` structured data,
                 * emitted by `src/routeData.ts`. Only mark up answers that are
                 * genuinely visible on the page — Google treats invisible FAQ
                 * markup as a violation, and it is a fast way to lose rich results.
                 */
                faq: z
                    .array(z.object({ question: z.string(), answer: z.string() }))
                    .optional(),
            }),
        }),
    }),
};
