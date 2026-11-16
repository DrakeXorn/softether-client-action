import { jest } from "@jest/globals";

// vpncmd.ts imports exec.ts, which imports child_process; keep it inert.
jest.unstable_mockModule("node:child_process", () => ({
	execFileSync: jest.fn(),
}));

const { buildCommands } = await import("../src/vpncmd.js");
const { InputsSchema } = await import("../src/inputs.js");

const parse = (raw: Record<string, string>) =>
	InputsSchema.parse({
		server: "vpn.example.com",
		port: "443",
		username: "alice",
		...raw,
	});

const names = (cmds: string[][]) => cmds.map((c) => c[0]);

describe("buildCommands", () => {
	it("password auth with defaults", () => {
		expect(
			buildCommands(
				parse({ authentication_method: "password", password: "pw" }),
				{},
			),
		).toEqual([
			["NicCreate", "vpn"],
			[
				"AccountCreate",
				"gha",
				"/SERVER:vpn.example.com:443",
				"/HUB:DEFAULT",
				"/USERNAME:alice",
				"/NICNAME:vpn",
			],
			["AccountPasswordSet", "gha", "/PASSWORD:pw", "/TYPE:standard"],
			["AccountServerCertDisable", "gha"],
			["AccountConnect", "gha"],
		]);
	});

	it("radius auth", () => {
		expect(
			buildCommands(
				parse({ authentication_method: "radius", password: "pw" }),
				{},
			)[2],
		).toEqual(["AccountPasswordSet", "gha", "/PASSWORD:pw", "/TYPE:radius"]);
	});

	it("certificate auth", () => {
		const inputs = parse({
			authentication_method: "certificate",
			client_cert: "-----BEGIN CERTIFICATE-----",
			client_key: "-----BEGIN PRIVATE KEY-----",
		});
		expect(
			buildCommands(inputs, { cert: "/t/c.pem", key: "/t/k.pem" })[2],
		).toEqual([
			"AccountCertSet",
			"gha",
			"/LOADCERT:/t/c.pem",
			"/LOADKEY:/t/k.pem",
		]);
		expect(() => buildCommands(inputs, {})).toThrow("were not written");
	});

	it("anonymous auth", () => {
		const cmds = buildCommands(
			parse({ authentication_method: "anonymous", username: "" }),
			{},
		);
		expect(cmds[1]).toContain("/USERNAME:anonymous");
		expect(cmds[2]).toEqual(["AccountAnonymousSet", "gha"]);
	});

	it("verifies the server certificate when a CA is given", () => {
		const cmds = buildCommands(
			parse({ authentication_method: "password", password: "pw", hub: "OPS" }),
			{
				ca: "/t/ca.pem",
			},
		);
		expect(cmds[1]).toContain("/HUB:OPS");
		expect(names(cmds)).toEqual([
			"NicCreate",
			"AccountCreate",
			"AccountPasswordSet",
			"CAAdd",
			"AccountServerCertEnable",
			"AccountConnect",
		]);
	});
});
