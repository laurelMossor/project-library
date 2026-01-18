import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse, PartialPageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { serverError, badRequest } from "@/lib/utils/errors";

type Ticket = {
	title: string;
	description: string;
	status?: string;
	priority?: string;
	epic?: string;
};

/**
 * GET /api/notion/tickets
 * Fetches P0 tickets with status "In Progress" or "Not Started" and Epic "Orgs"
 * Returns tickets with title and description for AI agent to create next steps plan
 */
export async function GET() {
	const notionKey = process.env.NOTION_KEY;
	const notionDbId = process.env.NOTION_TICKETS_DB;

	if (!notionKey || !notionDbId) {
		return badRequest("Notion configuration missing. Please set NOTION_KEY and NOTION_TICKETS_DB environment variables.");
	}

	try {
		// Extract database ID from URL if provided as full URL
		// Notion database IDs are 32 character hex strings, optionally with dashes
		let databaseId = notionDbId;
		if (notionDbId.includes("notion.so") || notionDbId.includes("/")) {
			// Extract ID from URL format: https://www.notion.so/{workspace}/{database_id}?v=...
			const match = notionDbId.match(/([a-f0-9]{32})/i);
			if (match) {
				databaseId = match[1];
			} else {
				// Try extracting from path
				const parts = notionDbId.split("/");
				const lastPart = parts[parts.length - 1];
				const idPart = lastPart.split("?")[0];
				if (idPart.length === 32) {
					databaseId = idPart;
				}
			}
		}
		
		// Format database ID with dashes (Notion API format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
		const formattedDbId = databaseId.length === 32 
			? `${databaseId.slice(0, 8)}-${databaseId.slice(8, 12)}-${databaseId.slice(12, 16)}-${databaseId.slice(16, 20)}-${databaseId.slice(20, 32)}`
			: databaseId;

		// Use direct HTTP request to Notion API since SDK v5+ doesn't expose databases.query
		// POST https://api.notion.com/v1/databases/{database_id}/query
		const response = await fetch(`https://api.notion.com/v1/databases/${formattedDbId}/query`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${notionKey}`,
				"Notion-Version": "2022-06-28",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				filter: {
					and: [
						{
							property: "Priority",
							select: {
								equals: "P0",
							},
						},
						{
							property: "Epic",
							select: {
								equals: "𝚫 ORGS",
							},
						},
						{
							or: [
								{
									property: "Status",
									status: {
										equals: "In Progress",
									},
								},
								{
									property: "Status",
									status: {
										equals: "Not Started",
									},
								},
							],
						},
					],
				},
				sorts: [
					{
						timestamp: "created_time",
						direction: "descending",
					},
				],
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Notion API error:", response.status, errorText);
			if (response.status === 401) {
				return badRequest("Invalid Notion API key");
			}
			if (response.status === 404) {
				return badRequest("Notion database not found. Please check NOTION_TICKETS_DB.");
			}
			throw new Error(`Notion API error: ${response.status} - ${errorText}`);
		}

		const data = await response.json();
		const filteredPages = data.results as (PageObjectResponse | PartialPageObjectResponse)[];

		// Transform Notion pages into a format optimized for AI agent planning
		const tickets = filteredPages.map((page: PageObjectResponse | PartialPageObjectResponse) => {
			if (!("properties" in page)) {
				return null;
			}

			const properties = page.properties;
			const ticket: Ticket = {
				title: "",
				description: "",
			};

			// Extract title and description specifically
			Object.keys(properties).forEach((key) => {
				const prop = properties[key];
				const normalizedKey = key.toLowerCase().replace(/\s+/g, "_");

				// Extract title
				if (prop.type === "title" && "title" in prop && prop.title.length > 0) {
					ticket.title = prop.title.map((t: { plain_text: string }) => t.plain_text).join("");
				}

				// Extract description (look for common description field names)
				if (prop.type === "rich_text" && "rich_text" in prop) {
					const fullText = prop.rich_text.map((rt: { plain_text: string }) => rt.plain_text).join("");
					if (fullText) {
						// If there's a field explicitly named "description", use it
						// Otherwise, collect all rich_text fields
						if (normalizedKey.includes("description") || normalizedKey === "description") {
							ticket.description = fullText;
						} else if (!ticket.description) {
							// Use first rich_text field as description if no explicit description found
							ticket.description = fullText;
						}
					}
				}

				// Extract status, priority, epic for context
				if (prop.type === "status" && "status" in prop && prop.status) {
					ticket.status = prop.status.name;
				} else if (normalizedKey === "priority" && prop.type === "select" && "select" in prop && prop.select) {
					ticket.priority = prop.select.name;
				} else if (normalizedKey === "epic" && prop.type === "select" && "select" in prop && prop.select) {
					ticket.epic = prop.select.name;
				}
			});

			return ticket;
		}).filter((ticket: Ticket | null): ticket is Ticket => ticket !== null && ticket.title !== ""); // Only return tickets with titles

		return NextResponse.json({
			tickets,
			count: tickets.length,
			summary: `Found ${tickets.length} P0 tickets in the "Orgs" epic with status "In Progress" or "Not Started". Use this information to create a next steps plan.`,
		});
	} catch (error) {
		console.error("Error fetching Notion tickets:", error);
		
		if (error instanceof Error) {
			// Notion API specific errors
			if (error.message.includes("unauthorized") || error.message.includes("401")) {
				return badRequest("Invalid Notion API key");
			}
			if (error.message.includes("not found") || error.message.includes("404")) {
				return badRequest("Notion database not found. Please check NOTION_TICKETS_DB.");
			}
		}

		return serverError("Failed to fetch tickets from Notion");
	}
}
