function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "";
}

function hasMissingTablePattern(message: string, tableName: string): boolean {
	return (
		message.includes(`no such table: main.${tableName}`) ||
		message.includes(`table \`main.${tableName}\` does not exist`) ||
		message.includes(`relation \"${tableName}\" does not exist`) ||
		(message.includes(tableName) && message.includes("no such table")) ||
		(message.includes(tableName) && message.includes("does not exist")) ||
		(message.includes("p2021") && message.includes(tableName))
	);
}

export function isMissingPostSubscriptionTableError(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return hasMissingTablePattern(message, "postsubscription");
}

export function isMissingNotificationDeliveryTableError(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return hasMissingTablePattern(message, "notificationdelivery");
}
