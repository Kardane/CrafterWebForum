import net from "node:net";

export async function isMinecraftServerReachable(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const socket = new net.Socket();
		let resolved = false;

		const finish = (value: boolean) => {
			if (resolved) {
				return;
			}
			resolved = true;
			socket.destroy();
			resolve(value);
		};

		socket.setTimeout(timeoutMs);
		socket.once("connect", () => finish(true));
		socket.once("timeout", () => finish(false));
		socket.once("error", () => finish(false));
		socket.connect(port, host);
	});
}
