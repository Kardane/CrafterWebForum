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

function hasMissingColumnPattern(message: string, tableName: string, columnName: string): boolean {
	return (
		message.includes(`no such column: ${tableName}.${columnName}`) ||
		message.includes(`no such column: main.${tableName}.${columnName}`) ||
		message.includes(`column \"${columnName}\" does not exist`) ||
		message.includes(`unknown column '${columnName}'`) ||
		(message.includes(tableName) && message.includes(columnName) && message.includes("no such column")) ||
		(message.includes(tableName) && message.includes(columnName) && message.includes("does not exist"))
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

export function isMissingPostBoardColumnError(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return hasMissingColumnPattern(message, "post", "board");
}

export function isMissingPostServerAddressColumnError(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return hasMissingColumnPattern(message, "post", "serveraddress");
}

export function isMissingPostCommentCountColumnError(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return hasMissingColumnPattern(message, "post", "commentcount");
}

export function isMissingPostBoardMetadataColumnError(error: unknown): boolean {
	return isMissingPostBoardColumnError(error) || isMissingPostServerAddressColumnError(error);
}

export function isMissingLegacyPostListColumnError(error: unknown): boolean {
	return isMissingPostBoardMetadataColumnError(error) || isMissingPostCommentCountColumnError(error);
}
