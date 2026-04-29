type BroadcastPayload = Record<string, unknown>;

interface BroadcastMessage {
	topic: string;
	event: string;
	payload: BroadcastPayload;
}

const PLACEHOLDER_SERVER_SECRET = "replace-with-realtime-server-secret";

function resolveRealtimeConfig() {
	const endpoint = process.env.REALTIME_BROADCAST_URL?.trim();
	const serverSecret = process.env.REALTIME_SERVER_SECRET?.trim();
	if (!endpoint || !serverSecret || serverSecret === PLACEHOLDER_SERVER_SECRET) {
		return null;
	}
	return {
		endpoint,
		serverSecret,
	};
}

export async function broadcastRealtime(message: BroadcastMessage) {
	const config = resolveRealtimeConfig();
	if (!config) {
		return;
	}

	try {
		await fetch(config.endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.serverSecret}`,
			},
			body: JSON.stringify(message),
			cache: "no-store",
		});
	} catch (error) {
		console.error("[realtime] broadcast failed:", error);
	}
}
