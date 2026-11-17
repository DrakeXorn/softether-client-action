import { sudo } from "./exec.js";
import type { Inputs } from "./inputs.js";

export const ACCOUNT = "gha";
export const NIC = "vpn";
/** SoftEther prefixes virtual NIC names with "vpn_". */
export const IFACE = `vpn_${NIC}`;

/** Paths of the PEM inputs, written to disk. */
export interface PemFiles {
	cert?: string;
	key?: string;
	ca?: string;
}

/** Runs `vpncmd /CLIENT /CMD <args>` against the local client service. */
export function vpncmd(args: string[]): string {
	try {
		return sudo("vpncmd", "localhost", "/CLIENT", "/CMD", ...args);
	} catch (e) {
		// Only name the command: its arguments may hold the password.
		const out = (e as { stdout?: string }).stdout?.trim() ?? "";
		throw new Error(`vpncmd ${args[0]} failed${out ? `:\n${out}` : ""}`);
	}
}

/** True once the session is up; otherwise throws the current status, so a timeout reports why. */
export function isConnected(): boolean {
	const out = vpncmd(["AccountStatusGet", ACCOUNT]);
	if (/Session Established/i.test(out)) return true;
	throw new Error(
		out.match(/Session Status\s*\|(.+)/)?.[1]?.trim() ?? out.trim(),
	);
}

/** The vpncmd argument lists that configure and start the connection, in order. */
export function buildCommands(i: Inputs, files: PemFiles): string[][] {
	const cmds: string[][] = [
		["NicCreate", NIC],
		[
			"AccountCreate",
			ACCOUNT,
			`/SERVER:${i.server}:${i.port}`,
			`/HUB:${i.hub}`,
			`/USERNAME:${i.username}`,
			`/NICNAME:${NIC}`,
		],
	];

	switch (i.authentication_method) {
		case "password":
		case "radius":
			cmds.push([
				"AccountPasswordSet",
				ACCOUNT,
				`/PASSWORD:${i.password}`,
				`/TYPE:${i.authentication_method === "password" ? "standard" : "radius"}`,
			]);
			break;
		case "certificate":
			if (!files.cert || !files.key)
				throw new Error("client_cert and client_key files were not written");
			cmds.push([
				"AccountCertSet",
				ACCOUNT,
				`/LOADCERT:${files.cert}`,
				`/LOADKEY:${files.key}`,
			]);
			break;
		case "anonymous":
			cmds.push(["AccountAnonymousSet", ACCOUNT]);
			break;
	}

	if (files.ca)
		cmds.push(["CAAdd", files.ca], ["AccountServerCertEnable", ACCOUNT]);
	else cmds.push(["AccountServerCertDisable", ACCOUNT]);

	cmds.push(["AccountConnect", ACCOUNT]);
	return cmds;
}

/** Commands that undo `buildCommands`. */
export const cleanupCommands: string[][] = [
	["AccountDisconnect", ACCOUNT],
	["AccountDelete", ACCOUNT],
	["NicDelete", NIC],
];
