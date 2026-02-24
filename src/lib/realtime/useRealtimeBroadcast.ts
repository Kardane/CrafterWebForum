"use client";

import { useEffect, useRef } from "react";
import { getRealtimeClient } from "@/lib/realtime/client";

type EventHandler = (payload: Record<string, unknown>) => void;

export function useRealtimeBroadcast(topic: string | null, handlers: Record<string, EventHandler>) {
	const handlersRef = useRef(handlers);

	useEffect(() => {
		handlersRef.current = handlers;
	}, [handlers]);

	useEffect(() => {
		if (!topic) {
			return;
		}
		const client = getRealtimeClient();
		if (!client) {
			return;
		}

		const channel = client.channel(topic);
		for (const event of Object.keys(handlersRef.current)) {
			channel.on("broadcast", { event }, ({ payload }) => {
				const handler = handlersRef.current[event];
				handler?.((payload ?? {}) as Record<string, unknown>);
			});
		}

		channel.subscribe();
		return () => {
			void client.removeChannel(channel);
		};
	}, [topic]);
}
