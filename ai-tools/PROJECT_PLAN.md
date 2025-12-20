# MVP Project Plan

## Overview

A small, scalable web platform that allows users to:

* Create accounts and maintain personal profiles
* Post projects visible on a public listing
* Match with other users based on profile data
* Send and receive private messages

The initial build should stay lean, with clear room for future expansion.

## Mission/Vision
The Project Library is about connection and sharing: Teaching-- Learning-- Creating Community. This website facilitates sharing and building of expertise and craft. 

## Guiding Principles
Lifelong Learning, Creativity, Care, Respect, Transparency

## 1. Core Tech Stack (MVP)

**Frontend + Backend:** Next.js (App Router, TypeScript)
**Database:** PostgreSQL
**ORM:** Prisma or Drizzle
**Auth:** NextAuth (email + password for MVP)
**UI Styling:** Tailwind CSS
**Hosting (preferred):**

* App: Vercel or simple Docker deployment
* DB: Supabase, Neon, or RDS if on AWS

## 2. Base Features & Milestones

### Milestone A — Authentication

**Goals:**

* Sign up, log in, and log out
* Store hashed passwords
* Session state handled server-side
* Simple UI screens

**Deliverables:**

* `/signup`, `/login` pages
* Auth configuration
* Protected routes checks

### Milestone B — User Profile

**Goals:**

* Basic personal info
* Editable form
* Public-facing profile page

**Profile Data:**

* Name
* Headline
* Bio
* Skills list
* Optional location

**Deliverables:**

* `/profile/edit`
* `/u/[username]`
* Profile CRUD API routes

### Milestone C — Projects

**Goals:**

* Create projects
* Public project listing with search
* Project detail pages

**Project Data:**

* Title
* Description
* Tags
* Created date
* Owner link

**Deliverables:**

* `/api/projects`
* `/api/projects/:id`
* `/projects` UI list
* `/projects/new`

### Milestone D — Matching [ON HOLD]

**Goals:**

* Simple overlap-based matching
* No ML yet

**Logic:**

* Match skills overlap
* Sort by relevancy

**Deliverables:**

* `/api/matches`
* Matches



### Milestone E — Enhanced Projects & Messaging

**Goals:**

* Add photo/image support to project postings
* Enhance project-to-profile navigation
* Enable direct messaging between users

**Project Enhancements:**

* Image upload for projects (single image for MVP)
* Improved project cards with images
* Enhanced navigation between projects and user profiles

**Messaging:**

* Send and receive private messages
* Simple conversation view
* Link to message from user profiles

**Deliverables:**

* Image upload in project creation
* Updated project display with images
* `/messages` page for viewing conversations
* `/messages/[userId]` for individual conversation
* `/api/messages` API routes
* Message database model 