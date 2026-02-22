"use client";

import { useEffect } from "react";
import { getRealtimeClient } from "@/lib/realtime/client";

type EventHandler = (payload: Record<string, unknown>) => void;

export function useRealtimeBroadcast(topic: string | null, handlers: Record<string, EventHandler>) {
	useEffect(() => {
		if (!topic) {
			return;
		}
		const client = getRealtimeClient();
		if (!client) {
			return;
		}

		const channel = client.channel(topic);
		for (const [event, handler] of Object.entries(handlers)) {
			channel.on("broadcast", { event }, ({ payload }) => {
				handler((payload ?? {}) as Record<string, unknown>);
			});
		}

		channel.subscribe();
		return () => {
			void client.removeChannel(channel);
		};
	}, [topic, handlers]);
}
