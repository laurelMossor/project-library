

export interface Project {
	id: string;
	title: string;
	description: string;
	tags: string[];
	imageUrl: string | null;
	createdAt: string;
	owner: {
		id: string;
		username: string;
		name: string | null;
	};
}

export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
	imageUrl?: string; // optional image URL/path
}