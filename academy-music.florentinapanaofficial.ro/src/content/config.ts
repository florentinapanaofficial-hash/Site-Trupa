import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const revista = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/revista' }),
    schema: z.object({
        titlu: z.string().min(1).max(150),
        descriere: z.string().min(1).max(300),
        data_publicarii: z.coerce.date(),
        imagine_cover: z.string().refine((value) => value.startsWith('/') && !value.startsWith('//'), 'Folosește o imagine locală din public/.'),
    }),
});

export const collections = { revista };