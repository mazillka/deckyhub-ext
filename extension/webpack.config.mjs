import path from "path";
import CopyWebpackPlugin from "copy-webpack-plugin";
import ZipPlugin from "zip-webpack-plugin";

export default (env, argv) => ({
  mode: argv.mode || "development",
  entry: { background: "./src/background.js", contentscript: "./src/contentscript.js" },
  output: { filename: "[name].js", path: path.resolve("./dist"), clean: true },
  devtool: argv.mode === "production" ? false : "source-map",
  plugins: [
    new CopyWebpackPlugin({ patterns: [
      { from: "./manifest.json", to: "manifest.json" },
      { from: "./src/content.css", to: "content.css" },
    ] }),
    new ZipPlugin({ filename: "extension.zip" }),
  ],
});
