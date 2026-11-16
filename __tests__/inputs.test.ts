import { readInputs } from "../src/inputs.js";

const CERT = "-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----";
const KEY = "-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----";

const base: Record<string, string> = {
	server: "vpn.example.com",
	port: "443",
	username: "alice",
	password: "pw",
};
const read = (overrides: Record<string, string> = {}) => {
	const all = { ...base, ...overrides };
	return readInputs((name) => all[name] ?? "");
};

describe("readInputs", () => {
	it("applies defaults and coerces types", () => {
		expect(read()).toEqual({
			server: "vpn.example.com",
			port: 443,
			hub: "DEFAULT",
			send_all_traffic: false,
			timeout: 30,
			authentication_method: "password",
			username: "alice",
			password: "pw",
		});
	});

	it("parses booleans and numbers", () => {
		const i = read({ send_all_traffic: "true", timeout: "60", hub: "OPS" });
		expect(i).toMatchObject({
			send_all_traffic: true,
			timeout: 60,
			hub: "OPS",
		});
	});

	it("accepts certificate auth", () => {
		const i = read({
			authentication_method: "certificate",
			password: "",
			client_cert: CERT,
			client_key: KEY,
		});
		expect(i).toMatchObject({
			authentication_method: "certificate",
			client_cert: CERT,
			client_key: KEY,
		});
	});

	it("accepts anonymous auth without a username", () => {
		expect(
			read({ authentication_method: "anonymous", username: "", password: "" }),
		).toMatchObject({
			authentication_method: "anonymous",
			username: "anonymous",
		});
	});

	it.each([
		[{ server: "" }, "server is required"],
		[{ port: "abc" }, "port"],
		[{ port: "70000" }, "port"],
		[{ username: "" }, "username is required"],
		[{ password: "" }, "password is required"],
		[{ send_all_traffic: "maybe" }, "send_all_traffic"],
		[{ timeout: "-1" }, "timeout"],
		[{ server_ca: "not a pem" }, "server_ca must be a PEM certificate"],
		[{ authentication_method: "certificate" }, "client_cert is required"],
		[
			{
				authentication_method: "certificate",
				client_cert: "nope",
				client_key: KEY,
			},
			"client_cert must be a PEM",
		],
		[
			{ authentication_method: "kerberos" },
			"authentication_method must be one of",
		],
	])("rejects %o", (overrides, message) => {
		expect(() => read(overrides)).toThrow(message);
	});

	it("never echoes input values in errors", () => {
		expect(() => read({ server_ca: "s3cret-value" })).toThrow(
			expect.objectContaining({
				message: expect.not.stringContaining("s3cret-value"),
			}),
		);
	});
});
