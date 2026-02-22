type BroadcastPayload = Record<string, unknown>;

interface BroadcastMessage {
	topic: string;
	event: string;
	payload: BroadcastPayload;
}

function resolveRealtimeConfig() {
	const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!projectUrl || !serviceRoleKey) {
		return null;
	}
	return {
		endpoint: `${projectUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`,
		apiKey: serviceRoleKey,
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
				apikey: config.apiKey,
				Authorization: `Bearer ${config.apiKey}`,
			},
			body: JSON.stringify({
				messages: [
					{
						topic: message.topic,
						event: message.event,
						payload: message.payload,
					},
				],
			}),
			cache: "no-store",
		});
	} catch (error) {
		console.error("[realtime] broadcast failed:", error);
	}
}
