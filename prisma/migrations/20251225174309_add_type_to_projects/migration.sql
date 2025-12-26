-- Add type discriminator field to projects table
ALTER TABLE "projects" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'project';

