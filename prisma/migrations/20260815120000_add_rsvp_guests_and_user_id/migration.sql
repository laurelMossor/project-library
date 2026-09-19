-- Add optional member link on RSVPs (anonymous path keeps userId null)
ALTER TABLE "rsvps" ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "rsvp_guests" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "rsvp_guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rsvp_guests_rsvpId_idx" ON "rsvp_guests"("rsvpId");

-- CreateIndex
CREATE INDEX "rsvps_userId_idx" ON "rsvps"("userId");

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_guests" ADD CONSTRAINT "rsvp_guests_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "rsvps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
