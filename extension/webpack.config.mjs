import path from "path";
import CopyWebpackPlugin from "copy-webpack-plugin";
import ZipPlugin from "zip-webpack-plugin";

// One source, two packages (--env browser=...):
// - chromium (the default, in dist/): Chrome, Edge, Opera, Brave, Vivaldi and other Chromium browsers.
// - firefox (in dist-firefox/): Firefox has no background service worker and needs an add-on ID.
const FIREFOX = {
  background: { scripts: ["background.js"] },
  browser_specific_settings: {
    gecko: {
      id: "security@deckyhub.com",
      // Host permissions are granted at install from 127 on; before that the panel would never show.
      strict_min_version: "127.0",
      // Nothing is collected: the extension only downloads public registry files.
      data_collection_permissions: { required: ["none"] },
    },
  },
};

export default (env = {}, argv) => {
  const browser = env.browser || "chromium";
  if (!["chromium", "firefox"].includes(browser)) throw new Error(`Unknown browser "${browser}": chromium or firefox`);
  const manifest = (content) =>
    browser === "firefox" ? JSON.stringify({ ...JSON.parse(content), ...FIREFOX }, null, 2) : content;
  return {
    mode: argv.mode || "development",
    entry: { background: "./src/background.ts", contentscript: "./src/contentscript.ts", popup: "./src/popup.ts" },
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [{ test: /\.ts$/, loader: "ts-loader", options: { compilerOptions: { noEmit: false } }, exclude: /node_modules/ }] },
    output: {
      filename: "[name].js",
      path: path.resolve(browser === "chromium" ? "./dist" : `./dist-${browser}`),
      clean: true,
    },
    devtool: argv.mode === "production" ? false : "source-map",
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: "./manifest.json", to: "manifest.json", transform: manifest },
          { from: "./src/content.css", to: "content.css" },
          { from: "./src/popup.html", to: "popup.html" },
          { from: "./src/popup.css", to: "popup.css" },
          { from: "./icons", to: "icons" },
        ],
      }),
      new ZipPlugin({ filename: `deckyhub-security-${browser}.zip` }),
    ],
  };
};
