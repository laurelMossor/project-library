// Owner information included with projects (subset of User)
export interface ProjectOwner {
	id: string;
	username: string;
	name: string | null;
}

export interface Project {
	id: string;
	title: string;
	description: string;
	tags: string[];
	imageUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
	owner: ProjectOwner;
}

export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
	imageUrl?: string; // optional image URL/path
}