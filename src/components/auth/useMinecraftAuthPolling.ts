"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface MinecraftAuthCodeResult {
	code: string;
	expiresIn: number;
}

export interface MinecraftAuthPollResult {
	verified: boolean;
	nickname?: string | null;
}

interface UseMinecraftAuthPollingOptions {
	createCode: (signal: AbortSignal) => Promise<MinecraftAuthCodeResult>;
	pollVerification: (params: { code: string; signal: AbortSignal }) => Promise<MinecraftAuthPollResult>;
	onVerified: (result: MinecraftAuthPollResult & { code: string }) => void;
	onCodeError?: (error: unknown) => void;
	onPollError?: (error: unknown) => void;
	autoStart?: boolean;
	refreshOnExpire?: boolean;
	pollIntervalMs?: number;
	tickIntervalMs?: number;
	codeErrorMessage?: string;
	expireErrorMessage?: string;
}

type IntervalHandle = ReturnType<typeof setInterval>;

export function useMinecraftAuthPolling(options: UseMinecraftAuthPollingOptions) {
	const optionsRef = useRef(options);
	optionsRef.current = options;

	const [code, setCode] = useState("");
	const [timeRemaining, setTimeRemaining] = useState(0);
	const [isPolling, setIsPolling] = useState(false);
	const [isLoading, setIsLoading] = useState(Boolean(options.autoStart));
	const [error, setError] = useState<string | null>(null);

	const timerRef = useRef<IntervalHandle | null>(null);
	const pollRef = useRef<IntervalHandle | null>(null);
	const codeControllerRef = useRef<AbortController | null>(null);
	const pollControllerRef = useRef<AbortController | null>(null);
	const startRef = useRef<() => Promise<void>>(async () => {});

	const clearTimers = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}, []);

	const stop = useCallback(() => {
		clearTimers();
		codeControllerRef.current?.abort();
		pollControllerRef.current?.abort();
		setIsPolling(false);
	}, [clearTimers]);

	const start = useCallback(async () => {
		const currentOptions = optionsRef.current;
		stop();
		setError(null);
		setIsLoading(true);

		const codeController = new AbortController();
		codeControllerRef.current = codeController;

		try {
			const nextCode = await currentOptions.createCode(codeController.signal);
			const normalizedCode = nextCode.code.trim();
			if (!normalizedCode) {
				throw new Error("code_generation_failed");
			}

			const expiresIn = Math.max(1, Number(nextCode.expiresIn || 60));
			setCode(normalizedCode);
			setTimeRemaining(expiresIn);
			setIsLoading(false);
			setIsPolling(true);

			timerRef.current = setInterval(() => {
				setTimeRemaining((prev) => {
					if (prev <= 1) {
						clearTimers();
						if (optionsRef.current.refreshOnExpire) {
							void startRef.current();
						} else {
							setIsPolling(false);
							if (optionsRef.current.expireErrorMessage) {
								setError(optionsRef.current.expireErrorMessage);
							}
						}
						return 0;
					}
					return prev - 1;
				});
			}, currentOptions.tickIntervalMs ?? 1000);

			pollRef.current = setInterval(async () => {
				pollControllerRef.current?.abort();
				const pollController = new AbortController();
				pollControllerRef.current = pollController;
				try {
					const pollResult = await optionsRef.current.pollVerification({
						code: normalizedCode,
						signal: pollController.signal,
					});
					if (!pollResult.verified) {
						return;
					}
					stop();
					optionsRef.current.onVerified({
						...pollResult,
						code: normalizedCode,
					});
				} catch (nextError) {
					if (nextError instanceof Error && nextError.name === "AbortError") {
						return;
					}
					optionsRef.current.onPollError?.(nextError);
				} finally {
					if (pollControllerRef.current === pollController) {
						pollControllerRef.current = null;
					}
				}
			}, currentOptions.pollIntervalMs ?? 2000);
		} catch (nextError) {
			if (nextError instanceof Error && nextError.name === "AbortError") {
				return;
			}
			if (currentOptions.codeErrorMessage) {
				setError(currentOptions.codeErrorMessage);
			}
			currentOptions.onCodeError?.(nextError);
			setIsPolling(false);
			setIsLoading(false);
		} finally {
			if (codeControllerRef.current === codeController) {
				codeControllerRef.current = null;
			}
		}
	}, [clearTimers, stop]);

	useEffect(() => {
		startRef.current = start;
	}, [start]);

	useEffect(() => {
		if (options.autoStart) {
			void startRef.current();
		} else {
			setIsLoading(false);
		}
		return () => {
			stop();
		};
	}, [options.autoStart, stop]);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	return {
		code,
		timeRemaining,
		isPolling,
		isLoading,
		error,
		start,
		stop,
		clearError,
	};
}
