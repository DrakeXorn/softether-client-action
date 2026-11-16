/**
 * Unit tests for src/main.ts. `@actions/core`, `child_process` and DNS are
 * mocked so no real VPN or sudo is involved.
 */
import { jest } from "@jest/globals";
import * as core from "../__fixtures__/core.js";

const execFileSync = jest.fn<(cmd: string, args: string[]) => string>();

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core);
jest.unstable_mockModule("node:child_process", () => ({ execFileSync }));
jest.unstable_mockModule("node:dns/promises", () => ({
	lookup: async () => ({ address: "203.0.113.5", family: 4 }),
}));

const { run, cleanup } = await import("../src/main.js");

const inputs: Record<string, string> = {
	server: "vpn.example.com",
	port: "443",
	username: "alice",
	password: "s3cret",
	authentication_method: "password",
};

/** Fakes a runner where everything is installed and the VPN connects. */
function fakeSystem(cmd: string, args: string[]): string {
	const line = [cmd, ...args].join(" ");
	if (line.includes("AccountStatusGet"))
		return "Session Status |Connection Completed (Session Established)";
	if (line.includes("route get"))
		return "203.0.113.5 via 10.1.0.1 dev eth0 src 10.1.0.4";
	if (line.includes("route show default"))
		return "default via 192.168.30.1 metric 0";
	if (line.includes("addr show"))
		return "5: vpn_vpn    inet 192.168.30.10/24 brd 192.168.30.255";
	return "";
}

const calls = () =>
	execFileSync.mock.calls.map(([cmd, args]) => [cmd, ...args].join(" "));

describe("main.ts", () => {
	beforeEach(() => {
		core.getInput.mockImplementation((name) => inputs[name] ?? "");
		core.getState.mockReturnValue("");
		execFileSync.mockImplementation(fakeSystem);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it("connects, sets outputs and masks the password", async () => {
		await run();

		expect(core.setFailed).not.toHaveBeenCalled();
		expect(core.setSecret).toHaveBeenCalledWith("s3cret");
		expect(core.saveState).toHaveBeenCalledWith("started", "true");
		expect(core.saveState).toHaveBeenCalledWith("hostRoute", "203.0.113.5/32");
		expect(core.setOutput).toHaveBeenCalledWith("interface", "vpn_vpn");
		expect(core.setOutput).toHaveBeenCalledWith("ip", "192.168.30.10");
		expect(calls().some((c) => c.endsWith("AccountConnect gha"))).toBe(true);
		// send_all_traffic=false drops the default route the VPN's DHCP pushed.
		expect(
			calls().some((c) => c.endsWith("ip route del default dev vpn_vpn")),
		).toBe(true);
	});

	it("keeps the VPN default route when send_all_traffic is true", async () => {
		core.getInput.mockImplementation(
			(name) => ({ ...inputs, send_all_traffic: "true" })[name] ?? "",
		);
		await run();

		expect(core.setFailed).not.toHaveBeenCalled();
		expect(calls().some((c) => c.includes("route del default"))).toBe(false);
	});

	it("fails on invalid inputs before touching the system", async () => {
		core.getInput.mockImplementation((name) =>
			name === "password" ? "" : (inputs[name] ?? ""),
		);
		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			expect.stringContaining("password is required"),
		);
		expect(calls().some((c) => c.includes("vpncmd"))).toBe(false);
	});

	it("does not leak vpncmd arguments in errors", async () => {
		execFileSync.mockImplementation((cmd, args) => {
			if (args.includes("AccountPasswordSet"))
				throw Object.assign(new Error(args.join(" ")), {
					stdout: "Error code: 1",
				});
			return fakeSystem(cmd, args);
		});
		await run();

		const msg = String(core.setFailed.mock.calls[0]?.[0]);
		expect(msg).toContain("vpncmd AccountPasswordSet failed");
		expect(msg).not.toContain("s3cret");
	});

	it("cleanup tears down and never fails", async () => {
		core.getState.mockImplementation(
			(name) =>
				({ started: "true", hostRoute: "203.0.113.5/32", tmp: "" })[name] ?? "",
		);
		execFileSync.mockImplementation(() => {
			throw new Error("boom");
		});
		await cleanup();

		expect(core.setFailed).not.toHaveBeenCalled();
		expect(core.warning).toHaveBeenCalled();
		expect(calls().some((c) => c.endsWith("AccountDelete gha"))).toBe(true);
		expect(calls().some((c) => c.endsWith("ip route del 203.0.113.5/32"))).toBe(
			true,
		);
	});
});
