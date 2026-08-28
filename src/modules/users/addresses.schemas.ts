import { z } from "zod";

// Field-for-field match with the frontend's Address type
// (bansalnx-regal-suite/src/data/types.ts) minus `id`, which the DB assigns.
export const createAddressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(10).max(15),
  line1: z.string().trim().min(1).max(200),
  locality: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  pincode: z.string().trim().min(1).max(12),
  country: z.string().trim().min(1).max(60),
  isDefault: z.boolean().optional().default(false),
});
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
