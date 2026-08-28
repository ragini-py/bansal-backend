// Mirrors the frontend's User["role"] union exactly
// (bansalnx-regal-suite/src/data/types.ts: "customer" | AdminRole, where
// AdminRole = "admin").
export const ROLES = ["customer", "admin"] as const;
export type Role = (typeof ROLES)[number];
