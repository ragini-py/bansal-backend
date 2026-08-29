import { z } from "zod";

export const replaceWishlistSchema = z.object({
  productIds: z.array(z.string().min(1)),
});
export type ReplaceWishlistInput = z.infer<typeof replaceWishlistSchema>;
