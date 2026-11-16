import { lookup } from "node:dns/promises";
import { exec, sudo } from "./exec.js";
import { IFACE } from "./vpncmd.js";

/**
 * Pins the route to the VPN server through the current gateway, so a default
 * route pushed by the VPN can't swallow the tunnel itself. Returns the pinned
 * route, or undefined when the server is directly reachable (e.g. localhost).
 */
export async function pinServerRoute(
	server: string,
): Promise<string | undefined> {
	const ip = (await lookup(server, { family: 4 })).address;
	const via = exec("ip", ["-4", "route", "get", ip]).match(
		/ via (\S+) dev (\S+)/,
	);
	if (!via?.[1] || !via[2]) return undefined;
	const route = `${ip}/32`;
	sudo("ip", "route", "replace", route, "via", via[1], "dev", via[2]);
	return route;
}

/** Gets an address over DHCP, then keeps or drops the VPN's default route. Returns the IPv4 address. */
export function configureInterface(sendAllTraffic: boolean): string {
	sudo("dhclient", "-1", IFACE);

	const vpnDefault = exec("ip", [
		"-4",
		"route",
		"show",
		"default",
		"dev",
		IFACE,
	]).trim();
	if (sendAllTraffic && !vpnDefault)
		throw new Error(
			"send_all_traffic is true but the VPN's DHCP offered no default gateway",
		);
	if (!sendAllTraffic && vpnDefault)
		sudo("ip", "route", "del", "default", "dev", IFACE);

	return (
		exec("ip", ["-4", "-o", "addr", "show", "dev", IFACE]).match(
			/inet (\S+?)\//,
		)?.[1] ?? ""
	);
}

/** Releases the DHCP lease, which also removes the routes it added. */
export const releaseInterface = () => sudo("dhclient", "-r", IFACE);

export const unpinRoute = (route: string) => sudo("ip", "route", "del", route);
