// The only settings on the site.
// WORKER_URL: paste the address of your Cloudflare Worker here to turn the AI on, e.g. "https://protocol.yourname.workers.dev"
// Leave it empty and the site still works: it answers by searching the syllabus and uses the written explanations.
window.PROTOCOL = {
  WORKER_URL: "",
  INTRO: "first-visit"        // "first-visit" | "always" | "never"
};
