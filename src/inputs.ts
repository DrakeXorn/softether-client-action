import { z } from "zod";

const nonEmpty = (name: string) =>
	z.string({ error: `${name} is required` }).min(1, `${name} is required`);

const common = z.object({
	server: nonEmpty("server"),
	port: z.coerce
		.number({ error: "port must be a number between 1 and 65535" })
		.int()
		.min(1, "port must be a number between 1 and 65535")
		.max(65535, "port must be a number between 1 and 65535"),
	hub: z.string().default("DEFAULT"),
	server_ca: z
		.string()
		.includes("BEGIN CERTIFICATE", {
			error: "server_ca must be a PEM certificate",
		})
		.optional(),
	send_all_traffic: z.stringbool().default(false),
	timeout: z.coerce
		.number({ error: "timeout must be a number of seconds" })
		.int()
		.positive("timeout must be a positive number of seconds")
		.default(30),
});

/** Each authentication method carries exactly the fields it needs. */
const auth = z.discriminatedUnion(
	"authentication_method",
	[
		z.object({
			authentication_method: z.literal(["password", "radius"]),
			username: nonEmpty("username"),
			password: nonEmpty("password"),
		}),
		z.object({
			authentication_method: z.literal("certificate"),
			username: nonEmpty("username"),
			client_cert: nonEmpty("client_cert").includes("BEGIN CERTIFICATE", {
				error: "client_cert must be a PEM certificate",
			}),
			client_key: nonEmpty("client_key").includes("PRIVATE KEY", {
				error: "client_key must be a PEM private key",
			}),
		}),
		z.object({
			authentication_method: z.literal("anonymous"),
			username: z
				.string()
				.optional()
				.transform((u) => u || "anonymous"),
		}),
	],
	{
		error:
			"authentication_method must be one of password, radius, certificate, anonymous",
	},
);

export const InputsSchema = z.intersection(common, auth);
export type Inputs = z.infer<typeof InputsSchema>;

const NAMES = [
	"server",
	"port",
	"hub",
	"server_ca",
	"send_all_traffic",
	"timeout",
	"authentication_method",
	"username",
	"password",
	"client_cert",
	"client_key",
] as const;

/**
 * Reads and validates the action inputs. `get` is `core.getInput`; unset
 * inputs come back as "" and are treated as missing so defaults apply.
 */
export function readInputs(get: (name: string) => string): Inputs {
	const raw: Record<string, string> = {};
	for (const name of NAMES) {
		const value = get(name).trim();
		if (value) raw[name] = value;
	}
	raw.authentication_method ??= "password";

	const result = InputsSchema.safeParse(raw);
	if (!result.success)
		throw new Error(`Invalid inputs:\n${z.prettifyError(result.error)}`);
	return result.data;
}
