import { execFileSync } from "node:child_process";

const asRoot = process.getuid?.() === 0;

/** Runs a command without a shell and returns its stdout. */
export function exec(cmd: string, args: string[]): string {
	// `input: ""` closes stdin so interactive tools fail instead of hanging.
	return execFileSync(cmd, args, { encoding: "utf8", input: "" });
}

/** Runs a command as root, through sudo unless we already are root. */
export function sudo(cmd: string, ...args: string[]): string {
	return asRoot ? exec(cmd, args) : exec("sudo", [cmd, ...args]);
}

/** Whether `bin` is on the PATH. */
export function has(bin: string): boolean {
	try {
		exec("sh", ["-c", `command -v ${bin}`]);
		return true;
	} catch {
		return false;
	}
}
