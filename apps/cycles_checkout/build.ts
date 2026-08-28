import esbuild from "esbuild";
import copyStaticFiles from "esbuild-copy-static-files";
import { sassPlugin } from "esbuild-sass-plugin";
import { readFile, writeFile } from "node:fs/promises";
import type { BuildOptions } from "esbuild";

const outdir = "./dist/web";

async function stripRemoteDiagnostics(): Promise<void> {
  for (const filename of ["main.js", "service.js"]) {
    const path = `${outdir}/${filename}`;
    const source = await readFile(path, "utf8");
    const sanitized = source.replaceAll("https://react.dev/errors/", "#react-error-");
    if (sanitized !== source) {
      await writeFile(path, sanitized);
    }
  }
}

const config: BuildOptions = {
  entryPoints: { main: "./src/index.tsx", service: "./src/service.ts" },
  outdir,
  entryNames: "[name]",
  bundle: true,
  minify: true,
  external: [],
  format: "esm",
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx" },
  platform: "browser",
  plugins: [
    sassPlugin(),
    {
      name: "neutron-self-contained-assets",
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            await stripRemoteDiagnostics();
          }
        });
      },
    },
    copyStaticFiles({
      src: "./public",
      dest: "./dist/web",
      dereference: true,
      errorOnExist: false,
      preserveTimestamps: true,
      recursive: true,
    }),
  ],
};

const args = process.argv.slice(2);

if (args[0] === "watch") {
  const ctx = await esbuild.context(config);
  await ctx.watch();

  console.log("Watching local files for changes...");
} else {
  try {
    await esbuild.build(config);
  } catch {
    process.exit(1);
  }
}
