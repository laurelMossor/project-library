import "dotenv/config";
import { prisma } from "@/lib/utils/server/prisma";
// import { PrismaPg } from "@prisma/adapter-pg";
// import pg from "pg";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

// Use the same Prisma setup as your app
// const pool = new pg.Pool({
// 	connectionString: process.env.DATABASE_URL,
// });
// const adapter = new PrismaPg(pool);
// const prisma = new PrismaClient({ adapter });

// Load seed data from JSON files
const usersData = JSON.parse(
	readFileSync(join(process.cwd(), "prisma", "seed-data", "users.json"), "utf-8")
);
const projectsData = JSON.parse(
	readFileSync(join(process.cwd(), "prisma", "seed-data", "projects.json"), "utf-8")
);
const eventsData = JSON.parse(
	readFileSync(join(process.cwd(), "prisma", "seed-data", "events.json"), "utf-8")
);

async function main() {
	// Clear existing data (optional - comment out if you want to keep existing data)
	console.log("Clearing existing data...");
	await prisma.projectEntry.deleteMany();
	await prisma.project.deleteMany();
	await prisma.event.deleteMany();
	await prisma.user.deleteMany();

	// Create users from JSON data
	console.log("Creating users...");
	const createdUsers = [];
	for (const userData of usersData) {
		// Hash password for database storage (even though it's simple for seed data)
		const passwordHash = await bcrypt.hash(userData.password, 10);
		
		const user = await prisma.user.create({
			data: {
				email: userData.email,
				username: userData.username,
				passwordHash,
				name: userData.name,
				headline: userData.headline,
				bio: userData.bio,
				interests: userData.interests,
				location: userData.location,
			},
		});
		createdUsers.push(user);
		console.log(`✅ Created user: ${user.username} (password: ${userData.password})`);
	}

	// Create projects from JSON data
	console.log("\nCreating projects...");
	const projectsWithEntries = [];
	for (const projectData of projectsData) {
		// Find the owner by index (ownerId in JSON is 1-based, array is 0-based)
		const ownerIndex = projectData.ownerId - 1;
		const owner = createdUsers[ownerIndex];
		
		if (!owner) {
			console.warn(`⚠️  Skipping project "${projectData.title}" - owner ID "${projectData.ownerId}" not found`);
			continue;
		}

		const project = await prisma.project.create({
			data: {
				title: projectData.title,
				description: projectData.description,
				tags: projectData.tags,
				imageUrl: projectData.imageUrl || null,
				ownerId: owner.id,
				createdAt: projectData.createdAt ? new Date(projectData.createdAt) : undefined,
			},
		});
		console.log(`✅ Created project: "${project.title}" by ${owner.username}`);

		// Track projects that should have entries
		if (projectData.hasEntries) {
			projectsWithEntries.push(project);
		}
	}

	// Create project entries for projects that have them
	console.log("\nCreating project entries...");
	for (const project of projectsWithEntries) {
		const entry1 = await prisma.projectEntry.create({
			data: {
				projectId: project.id,
				title: "Progress Update",
				content: "Made great progress on this project! The initial phases are complete and I'm excited to share the results. More updates coming soon.",
				createdAt: new Date(project.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after project creation
			},
		});
		console.log(`✅ Created entry for project: "${project.title}"`);

		// Add a second entry
		const entry2 = await prisma.projectEntry.create({
			data: {
				projectId: project.id,
				title: "Final Update",
				content: "Project is complete! Learned a lot during the process and happy with the final result. Planning to start a similar project soon.",
				createdAt: new Date(project.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days after project creation
			},
		});
		console.log(`✅ Created second entry for project: "${project.title}"`);
	}

	// Create events from JSON data
	console.log("\nCreating events...");
	for (const eventData of eventsData) {
		// Find the owner by index (ownerId in JSON is 1-based, array is 0-based)
		const ownerIndex = eventData.ownerId - 1;
		const owner = createdUsers[ownerIndex];
		
		if (!owner) {
			console.warn(`⚠️  Skipping event "${eventData.title}" - owner ID "${eventData.ownerId}" not found`);
			continue;
		}

		const event = await prisma.event.create({
			data: {
				title: eventData.title,
				description: eventData.description,
				dateTime: new Date(eventData.dateTime),
				location: eventData.location,
				latitude: eventData.latitude || null,
				longitude: eventData.longitude || null,
				tags: eventData.tags,
				imageUrls: eventData.imageUrls || [],
				ownerId: owner.id,
				createdAt: eventData.createdAt ? new Date(eventData.createdAt) : undefined,
			},
		});
		console.log(`✅ Created event: "${event.title}" by ${owner.username}`);
	}

	console.log("\n🎉 Successfully seeded database!");
	console.log(`   - ${createdUsers.length} users created`);
	console.log(`   - ${projectsData.length} projects created`);
	console.log(`   - ${projectsWithEntries.length} projects with entries`);
	console.log(`   - ${eventsData.length} events created`);
	console.log("\n📝 Login credentials:");
	usersData.forEach((userData: { email: string; password: string; username: string }) => {
		console.log(`   ${userData.email} / ${userData.password}`);
	});
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
