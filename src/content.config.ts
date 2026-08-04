import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const manual = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/manual' }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    orden: z.number(),
  }),
})

export const collections = { manual }
