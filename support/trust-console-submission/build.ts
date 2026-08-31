import esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
await esbuild.build({ entryPoints: { main: "./demo.tsx" }, outdir: "./dist", entryNames: "[name]", bundle: true, format: "esm", jsx: "automatic", platform: "browser", loader: { ".ts": "ts", ".tsx": "tsx" }, plugins: [sassPlugin()] });
