import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as core from "@actions/core";
import { readInputs } from "./inputs.js";
import { installAndStartClient } from "./install.js";
import {
	configureInterface,
	pinServerRoute,
	releaseInterface,
	unpinRoute,
} from "./network.js";
import { bestEffort, type Step, waitFor } from "./util.js";
import {
	buildCommands,
	cleanupCommands,
	IFACE,
	isConnected,
	type PemFiles,
	vpncmd,
} from "./vpncmd.js";

/** Writes the PEM inputs to a private temp dir, so vpncmd can load them. */
function writePemFiles(
	pems: Record<keyof PemFiles, string | undefined>,
): PemFiles {
	const dir = mkdtempSync(join(tmpdir(), "softether-"));
	core.saveState("tmp", dir);
	const files: PemFiles = {};
	for (const [name, content] of Object.entries(pems) as [
		keyof PemFiles,
		string | undefined,
	][]) {
		if (!content) continue;
		files[name] = join(dir, `${name}.pem`);
		writeFileSync(files[name], content, { mode: 0o600 });
	}
	return files;
}

export async function run(): Promise<void> {
	try {
		for (const secret of ["password", "client_key"]) {
			const value = core.getInput(secret);
			if (value) core.setSecret(value);
		}
		const inputs = readInputs((name) => core.getInput(name));

		const certificate =
			inputs.authentication_method === "certificate" ? inputs : undefined;
		const files = writePemFiles({
			cert: certificate?.client_cert,
			key: certificate?.client_key,
			ca: inputs.server_ca,
		});
		const cmds = buildCommands(inputs, files);

		installAndStartClient();
		await waitFor(
			"the SoftEther client service",
			15,
			() => vpncmd(["AccountList"]) !== undefined,
		);

		// Leftovers from an earlier run on a self-hosted runner; usually absent.
		bestEffort(
			cleanupCommands.map((c): Step => [`vpncmd ${c[0]}`, () => vpncmd(c)]),
			core.debug,
		);

		core.saveState("started", "true");
		for (const c of cmds) {
			core.info(`vpncmd ${c[0]}`);
			vpncmd(c);
		}
		await waitFor("the VPN session", inputs.timeout, isConnected);
		core.info("VPN session established");

		const route = await pinServerRoute(inputs.server);
		if (route) core.saveState("hostRoute", route);

		core.info(`Requesting an address on ${IFACE} via DHCP`);
		const ip = configureInterface(inputs.send_all_traffic);

		core.info(`Connected: ${IFACE} ${ip}`);
		core.setOutput("interface", IFACE);
		core.setOutput("ip", ip);
	} catch (error) {
		core.setFailed(error instanceof Error ? error.message : String(error));
	}
}

/** Post step: tears everything down. Never fails the job. */
export async function cleanup(): Promise<void> {
	const hostRoute = core.getState("hostRoute");
	const tmp = core.getState("tmp");
	const steps: Step[] = [];
	if (core.getState("started"))
		steps.push(
			["dhclient -r", releaseInterface],
			...cleanupCommands.map((c): Step => [`vpncmd ${c[0]}`, () => vpncmd(c)]),
		);
	if (hostRoute) steps.push(["remove host route", () => unpinRoute(hostRoute)]);
	if (tmp)
		steps.push([
			"remove temp files",
			() => rmSync(tmp, { recursive: true, force: true }),
		]);
	bestEffort(steps, core.warning);
	core.info("VPN disconnected");
}
