import esbuild from "esbuild";
import copyStaticFiles from "esbuild-copy-static-files";
import { sassPlugin } from "esbuild-sass-plugin";
const config: esbuild.BuildOptions = { entryPoints: { main: "./src/index.tsx", service: "./src/service.ts" }, outdir: "./dist/web", entryNames: "[name]", bundle: true, minify: true, format: "esm", jsx: "automatic", platform: "browser", loader: { ".ts": "ts", ".tsx": "tsx" }, plugins: [sassPlugin(), copyStaticFiles({ src: "./public", dest: "./dist/web", dereference: true, errorOnExist: false, preserveTimestamps: true, recursive: true })] };
if (process.argv[2] === "watch") { const context = await esbuild.context(config); await context.watch(); } else await esbuild.build(config);
