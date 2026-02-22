export type LinkPreview = {
	provider: string;
	kind: string;
	badge: string;
	title: string;
	subtitle: string;
	description?: string;
	imageUrl?: string;
	iconUrl?: string;
	authorName?: string;
	authorAvatarUrl?: string;
	status?: string;
	chips: string[];
	metrics: string[];
	stats?: {
		stars?: number;
		forks?: number;
		issues?: number;
		pulls?: number;
		downloads?: number;
		updatedAt?: string;
		version?: string;
		platforms?: string[];
		environments?: string[];
	};
};
