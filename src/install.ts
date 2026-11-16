import * as core from "@actions/core";
import { has, sudo } from "./exec.js";

function aptInstall(...pkgs: string[]): void {
	core.info(`Installing ${pkgs.join(" ")}`);
	sudo("apt-get", "update", "-qq");
	sudo(
		"env",
		"DEBIAN_FRONTEND=noninteractive",
		"apt-get",
		"install",
		"-y",
		"-qq",
		...pkgs,
	);
}

/** Installs the SoftEther client and a DHCP client if missing, then starts the client service. */
export function installAndStartClient(): void {
	if (!has("vpncmd")) aptInstall("softether-vpnclient", "softether-vpncmd");
	if (!has("dhclient")) aptInstall("isc-dhcp-client");
	try {
		sudo("systemctl", "start", "softether-vpnclient");
	} catch {
		// No systemd (e.g. inside a container).
		sudo("vpnclient", "start");
	}
}
