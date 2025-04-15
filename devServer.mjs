import * as esbuild from "esbuild"

const ctx = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	outdir: "www/.esbuild",
	format: "esm",
	loader: {
		".wgsl": "text",
	},
})

ctx.watch()

const {host, port} = await ctx.serve({
	servedir: "www",
})

console.log("esbuild up @", {host, port})
