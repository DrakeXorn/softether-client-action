import { setTimeout as sleep } from "node:timers/promises";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Calls `fn` every second until it returns true or `seconds` elapse. */
export async function waitFor(
	what: string,
	seconds: number,
	fn: () => boolean,
): Promise<void> {
	const deadline = Date.now() + seconds * 1000;
	let last = "";
	let finished = false;
	while (!finished) {
		try {
			if (fn()) finished = true;
		} catch (e) {
			last = `: ${message(e)}`;
		}
		if (Date.now() >= deadline)
			throw new Error(`Timed out after ${seconds}s waiting for ${what}${last}`);
		await sleep(1000);
	}
}

export type Step = [name: string, run: () => unknown];

/** Runs every step even if some fail, logging failures with `log`. */
export function bestEffort(steps: Step[], log: (msg: string) => void): void {
	for (const [name, run] of steps) {
		try {
			run();
		} catch (e) {
			log(`${name}: ${message(e)}`);
		}
	}
}
