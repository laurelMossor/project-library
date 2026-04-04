-- CreateTable
CREATE TABLE "signup_invites" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "signup_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signup_invites_tokenHash_key" ON "signup_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "signup_invites_email_idx" ON "signup_invites"("email");
