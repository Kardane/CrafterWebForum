function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "";
}

export function isMissingPostSubscriptionTableError(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return (
		message.includes("no such table: main.postsubscription") ||
		message.includes("table `main.postsubscription` does not exist") ||
		message.includes("relation \"postsubscription\" does not exist") ||
		(message.includes("postsubscription") && message.includes("no such table")) ||
		(message.includes("postsubscription") && message.includes("does not exist")) ||
		(message.includes("p2021") && message.includes("postsubscription"))
	);
}
