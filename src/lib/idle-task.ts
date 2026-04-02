export function scheduleIdleTask(callback: () => void, fallbackDelayMs = 600): () => void {
	if (typeof window === "undefined") {
		return () => {};
	}

	if (typeof window.requestIdleCallback === "function") {
		const handle = window.requestIdleCallback(() => {
			callback();
		});

		return () => {
			if (typeof window.cancelIdleCallback === "function") {
				window.cancelIdleCallback(handle);
			}
		};
	}

	const timeoutId = window.setTimeout(() => {
		callback();
	}, fallbackDelayMs);

	return () => {
		window.clearTimeout(timeoutId);
	};
}
