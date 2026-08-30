import { defineConfig } from "astro/config";

// Project Pages site: served from https://juansilvadesign.github.io/fork-sentinel
// `base` is load-bearing — every asset reference must go through import.meta.env.BASE_URL
// or it 404s in production while working fine in dev.
export default defineConfig({
  site: "https://juansilvadesign.github.io",
  base: "/fork-sentinel",
  output: "static",
  trailingSlash: "ignore",
});
