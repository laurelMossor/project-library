import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

// Use the same Prisma setup as your app
const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Load seed data from JSON files
const usersData = JSON.parse(
	readFileSync(join(process.cwd(), "prisma", "seed-data", "users.json"), "utf-8")
);
const projectsData = JSON.parse(
	readFileSync(join(process.cwd(), "prisma", "seed-data", "projects.json"), "utf-8")
);

async function main() {
	// Clear existing data (optional - comment out if you want to keep existing data)
	console.log("Clearing existing data...");
	await prisma.project.deleteMany();
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
	console.log("Creating projects...");
	for (const projectData of projectsData) {
		// Find the owner by index (ownerId 1-7 corresponds to array index 0-6)
		// ownerId in JSON is 1-based, array is 0-based
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
			},
		});
		console.log(`✅ Created project: "${project.title}" by ${owner.username} (ID: ${projectData.ownerId})`);
	}

	console.log("\n🎉 Successfully seeded database!");
	console.log(`   - ${createdUsers.length} users created`);
	console.log(`   - ${projectsData.length} projects created`);
	console.log("\n📝 Login credentials:");
	usersData.forEach((user) => {
		console.log(`   ${user.email} / ${user.password}`);
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
