// See: https://rollupjs.org/introduction/

import commonjs from "@rollup/plugin-commonjs";
import swc from "@rollup/plugin-swc";
import { nodeResolve } from "@rollup/plugin-node-resolve";

// swc only strips types; type checking is `tsc --noEmit` (see "typecheck").
const config = {
	input: "src/index.ts",
	output: {
		esModule: true,
		file: "dist/index.js",
		format: "es",
		sourcemap: true,
	},
	plugins: [
		commonjs(),
		nodeResolve({ preferBuiltins: true, extensions: [".ts", ".js"] }),
		swc({
			swc: { jsc: { target: "es2024", parser: { syntax: "typescript" } } },
		}),
	],
};

export default config;
