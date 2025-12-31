import "dotenv/config";
import { prisma } from "@/lib/utils/server/prisma";
// import { PrismaPg } from "@prisma/adapter-pg";
// import pg from "pg";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { supabase } from "@/lib/utils/server/supabase";

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
const imagesData = JSON.parse(
	readFileSync(join(process.cwd(), "prisma", "seed-data", "images.json"), "utf-8")
);

async function main() {
	// Clear existing data (optional - comment out if you want to keep existing data)
	console.log("Clearing existing data...");
	await prisma.image.deleteMany();
	await prisma.entry.deleteMany();
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
	const createdProjects = [];
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
				ownerId: owner.id,
				createdAt: projectData.createdAt ? new Date(projectData.createdAt) : undefined,
			},
		});
		createdProjects.push({ project, owner, projectData });
		console.log(`✅ Created project: "${project.title}" by ${owner.username}`);

		// Track projects that should have entries
		if (projectData.hasEntries) {
			projectsWithEntries.push(project);
		}
	}

	// Create entries for projects that have them
	// Using polymorphic Entry model with collectionType + collectionId
	console.log("\nCreating entries...");
	for (const project of projectsWithEntries) {
		const entry1 = await prisma.entry.create({
			data: {
				collectionType: "project",
				collectionId: project.id,
				title: "Progress Update",
				content: "Made great progress on this project! The initial phases are complete and I'm excited to share the results. More updates coming soon.",
				createdAt: new Date(project.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after project creation
			},
		});
		console.log(`✅ Created entry for project: "${project.title}"`);

		// Add a second entry
		const entry2 = await prisma.entry.create({
			data: {
				collectionType: "project",
				collectionId: project.id,
				title: "Final Update",
				content: "Project is complete! Learned a lot during the process and happy with the final result. Planning to start a similar project soon.",
				createdAt: new Date(project.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days after project creation
			},
		});
		console.log(`✅ Created second entry for project: "${project.title}"`);
	}

	// Create events from JSON data
	console.log("\nCreating events...");
	const createdEvents = [];
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
				ownerId: owner.id,
				createdAt: eventData.createdAt ? new Date(eventData.createdAt) : undefined,
			},
		});
		createdEvents.push({ event, owner, eventData });
		console.log(`✅ Created event: "${event.title}" by ${owner.username}`);
	}

	// Upload and create images from local files
	console.log("\nUploading and creating images...");
	let imagesCreated = 0;
	const BUCKET_NAME = "uploads";
	const EXAMPLES_FOLDER = "examples";

	// Create a map of filename -> imageData for quick lookup
	const imageDataMap = new Map<string, typeof imagesData[0]>();
	for (const imageData of imagesData) {
		imageDataMap.set(imageData.filename, imageData);
	}

	// Track which files have been uploaded to avoid duplicate uploads
	const uploadedFiles = new Set<string>();

	// Helper function to upload file and get URL
	async function uploadImageFile(filename: string): Promise<string | null> {
		const storagePath = `${EXAMPLES_FOLDER}/${filename}`;
		
		// If already uploaded, just return the URL
		if (uploadedFiles.has(filename)) {
			const { data: { publicUrl } } = supabase.storage
				.from(BUCKET_NAME)
				.getPublicUrl(storagePath);
			return publicUrl;
		}

		// Read the local image file
		const localImagePath = join(process.cwd(), "public", "static", "examples", filename);
		if (!existsSync(localImagePath)) {
			console.warn(`⚠️  Skipping image "${filename}" - file not found at ${localImagePath}`);
			return null;
		}

		const imageBuffer = readFileSync(localImagePath);
		const fileExtension = filename.split(".").pop()?.toLowerCase() || "png";
		
		// Determine content type based on extension
		const contentType = fileExtension === "png" ? "image/png" : 
		                   fileExtension === "jpg" || fileExtension === "jpeg" ? "image/jpeg" :
		                   fileExtension === "webp" ? "image/webp" : "image/png";

		try {
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from(BUCKET_NAME)
				.upload(storagePath, imageBuffer, {
					contentType,
					upsert: true, // Allow overwriting if file already exists
				});

			if (uploadError) {
				console.error(`❌ Failed to upload "${filename}":`, uploadError.message);
				return null;
			}

			uploadedFiles.add(filename);
			
			// Get the public URL
			const { data: { publicUrl } } = supabase.storage
				.from(BUCKET_NAME)
				.getPublicUrl(storagePath);
			return publicUrl;
		} catch (error) {
			console.error(`❌ Error uploading image "${filename}":`, error instanceof Error ? error.message : String(error));
			return null;
		}
	}

	// Process images for each project
	for (const { project, owner, projectData } of createdProjects) {
		// Skip if project doesn't have imageFilenames
		if (!projectData.imageFilenames || !Array.isArray(projectData.imageFilenames)) {
			continue;
		}

		// The project owner is the uploader
		const uploader = owner;

		for (const filename of projectData.imageFilenames) {
			const imageData = imageDataMap.get(filename);
			
			if (!imageData) {
				console.warn(`⚠️  Skipping image "${filename}" - image data not found in images.json`);
				continue;
			}

			const publicUrl = await uploadImageFile(filename);
			if (!publicUrl) {
				continue;
			}

			// Create image record in database
			try {
				const storagePath = `${EXAMPLES_FOLDER}/${filename}`;
				const image = await prisma.image.create({
					data: {
						url: publicUrl,
						path: storagePath,
						altText: imageData.altText || null,
						projectId: project.id,
						uploadedById: uploader.id,
					},
				});
				
				imagesCreated++;
				console.log(`✅ Created image for project: "${project.title}" (${filename})`);
			} catch (error) {
				console.error(`❌ Error creating image record for "${filename}":`, error instanceof Error ? error.message : String(error));
			}
		}
	}

	// Process images for each event
	for (const { event, owner, eventData } of createdEvents) {
		// Skip if event doesn't have imageFilenames
		if (!eventData.imageFilenames || !Array.isArray(eventData.imageFilenames)) {
			continue;
		}

		// The event owner is the uploader
		const uploader = owner;

		for (const filename of eventData.imageFilenames) {
			const imageData = imageDataMap.get(filename);
			
			if (!imageData) {
				console.warn(`⚠️  Skipping image "${filename}" - image data not found in images.json`);
				continue;
			}

			const publicUrl = await uploadImageFile(filename);
			if (!publicUrl) {
				continue;
			}

			// Create image record in database
			try {
				const storagePath = `${EXAMPLES_FOLDER}/${filename}`;
				const image = await prisma.image.create({
					data: {
						url: publicUrl,
						path: storagePath,
						altText: imageData.altText || null,
						eventId: event.id,
						uploadedById: uploader.id,
					},
				});
				
				imagesCreated++;
				console.log(`✅ Created image for event: "${event.title}" (${filename})`);
			} catch (error) {
				console.error(`❌ Error creating image record for "${filename}":`, error instanceof Error ? error.message : String(error));
			}
		}
	}

	console.log("\n🎉 Successfully seeded database!");
	console.log(`   - ${createdUsers.length} users created`);
	console.log(`   - ${projectsData.length} projects created`);
	console.log(`   - ${projectsWithEntries.length} projects with entries`);
	console.log(`   - ${eventsData.length} events created`);
	console.log(`   - ${imagesCreated} images created`);
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
