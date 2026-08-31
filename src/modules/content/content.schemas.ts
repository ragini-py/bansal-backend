import { z } from "zod";

const sectionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  visible: z.boolean(),
});

export const updateContentSchema = z
  .object({
    announcement: z.object({ enabled: z.boolean(), text: z.string().max(500) }),
    hero: z.object({
      eyebrow: z.string().max(200),
      heading: z.string().max(200),
      subheading: z.string().max(500),
      primaryCta: z.string().max(60),
      secondaryCta: z.string().max(60),
    }),
    editorial: z.object({
      heading: z.string().max(200),
      caption: z.string().max(500),
      cta: z.string().max(60),
    }),
    promo: z.object({
      heading: z.string().max(200),
      caption: z.string().max(500),
      cta: z.string().max(60),
    }),
    story: z.object({
      heading: z.string().max(200),
      body: z.string().max(2000),
      cta: z.string().max(60),
    }),
    sections: z.array(sectionSchema),
    featuredCollectionIds: z.array(z.string().min(1)),
    featuredProductIds: z.array(z.string().min(1)),
  })
  .partial();
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
