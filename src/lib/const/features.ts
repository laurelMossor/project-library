// Feature flags — compile-time constants, flipped in code (not env vars, not a
// flag service). They gate finished-but-not-yet-enabled surfaces.
//
// Pure constants: no `server-only` guard, no env access, no Prisma import, so both
// server routes and client components import the same value. Flip a value here (a
// one-line PR) to turn a surface on everywhere.
//
// Membership is no longer a flag. A page turns members on by setting
// `membershipPolicy` (see roles.ts `assignableRoles`). This object stays so the
// next flag has a home.

export const FEATURES = {} as const;

export type FeatureFlag = keyof typeof FEATURES;
