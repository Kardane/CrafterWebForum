import { put } from "@vercel/blob";
import { createThumbnail } from "@/lib/image-optimizer";
import { toBlobObjectPath } from "@/lib/upload";

interface ImageThumbnailJob {
	uploadRelativeDir: string;
	baseName: string;
	mainBuffer: Buffer;
	blobToken: string;
}

interface UploadQueueState {
	jobs: ImageThumbnailJob[];
	running: boolean;
}

const MAX_QUEUED_JOBS = 64;
const globalUploadQueue = globalThis as typeof globalThis & {
	imageThumbnailQueue?: UploadQueueState;
};

function getQueueState(): UploadQueueState {
	if (!globalUploadQueue.imageThumbnailQueue) {
		globalUploadQueue.imageThumbnailQueue = {
			jobs: [],
			running: false,
		};
	}
	return globalUploadQueue.imageThumbnailQueue;
}

async function processImageThumbnailJob(job: ImageThumbnailJob): Promise<void> {
	const thumb150 = await createThumbnail(job.mainBuffer, 150);
	const thumb300 = await createThumbnail(job.mainBuffer, 300);
	const thumb150ObjectPath = toBlobObjectPath(job.uploadRelativeDir, `${job.baseName}-150.webp`);
	const thumb300ObjectPath = toBlobObjectPath(job.uploadRelativeDir, `${job.baseName}-300.webp`);

	await Promise.all([
		put(thumb150ObjectPath, thumb150, {
			access: "public",
			addRandomSuffix: false,
			contentType: "image/webp",
			token: job.blobToken,
		}),
		put(thumb300ObjectPath, thumb300, {
			access: "public",
			addRandomSuffix: false,
			contentType: "image/webp",
			token: job.blobToken,
		}),
	]);
}

async function drainQueue(): Promise<void> {
	const queue = getQueueState();
	if (queue.running) {
		return;
	}

	queue.running = true;
	try {
		while (queue.jobs.length > 0) {
			const job = queue.jobs.shift();
			if (!job) {
				continue;
			}
			try {
				await processImageThumbnailJob(job);
			} catch (error) {
				console.error("[UploadQueue] Image thumbnail post-processing failed:", error);
			}
		}
	} finally {
		queue.running = false;
	}
}

export function enqueueImageThumbnailJob(job: ImageThumbnailJob): void {
	const queue = getQueueState();
	if (queue.jobs.length >= MAX_QUEUED_JOBS) {
		console.warn("[UploadQueue] Queue full, dropping thumbnail job");
		return;
	}

	queue.jobs.push(job);
	void drainQueue();
}
