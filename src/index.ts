/**
 * Entrypoint for both the main and post steps. State saved during main is
 * only visible in post, which is how the two are told apart.
 */
import * as core from "@actions/core";
import { cleanup, run } from "./main.js";

if (core.getState("isPost")) {
	await cleanup();
} else {
	core.saveState("isPost", "true");
	await run();
}
