import net from "node:net";
import { resolvePublicIps } from "@/lib/network-guard";

export async function isMinecraftServerReachable(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
	let addresses: string[];
	try {
		addresses = await resolvePublicIps(host);
	} catch {
		return false;
	}

	for (const address of addresses) {
		const reachable = await new Promise<boolean>((resolve) => {
			const socket = new net.Socket();
			let settled = false;

			const finish = (value: boolean) => {
				if (settled) {
					return;
				}
				settled = true;
				socket.destroy();
				resolve(value);
			};

			socket.setTimeout(timeoutMs);
			socket.once("connect", () => finish(true));
			socket.once("timeout", () => finish(false));
			socket.once("error", () => finish(false));
			socket.connect(port, address);
		});
		if (reachable) {
			return true;
		}
	}

	return false;
}
