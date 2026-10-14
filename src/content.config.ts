import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const publicatii = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publicatii' }),
  schema: z.object({
    titlu: z.string().min(5),
    dataPublicarii: z.coerce.date(),
    descriere: z.string().min(20).max(155),
    imaginePrincipala: z.string().min(1),
    categorie: z.string().min(2),
    locatie: z.string().min(2).optional(),
  }),
});

const revista = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/revista' }),
  schema: z.object({
    title: z.string().min(5),
    date: z.coerce.date(),
    author: z.string().min(2),
    image: z.string().min(1),
    description: z.string().min(20).max(155),
  }),
});

export const collections = {
  publicatii,
  revista,
};