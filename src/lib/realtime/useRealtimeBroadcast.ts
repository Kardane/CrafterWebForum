"use client";

import { useEffect, useRef } from "react";
import { getRealtimeClient } from "@/lib/realtime/client";

type EventHandler = (payload: Record<string, unknown>) => void;

export function useRealtimeBroadcast(topic: string | null, handlers: Record<string, EventHandler>) {
	const handlersRef = useRef(handlers);

	useEffect(() => {
		handlersRef.current = handlers;
	}, [handlers]);

	const eventKey = Object.keys(handlers).sort().join("\n");

	useEffect(() => {
		if (!topic) {
			return;
		}
		const client = getRealtimeClient();
		if (!client) {
			return;
		}

		const unsubscribes = Object.keys(handlersRef.current).map((event) =>
			client.subscribe(topic, event, (payload) => {
				const handler = handlersRef.current[event];
				handler?.((payload ?? {}) as Record<string, unknown>);
			})
		);

		return () => {
			for (const unsubscribe of unsubscribes) {
				unsubscribe();
			}
		};
	}, [topic, eventKey]);
}
