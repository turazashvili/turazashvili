// Updates the DEV.to followers badge in README.md.
// Based on https://dev.to/annavi11arrea1/sharing-dev-followers-count-on-github-profile-bj3
const fs = require("fs");
const path = require("path");

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const DEVTO_USERNAME = process.env.DEVTO_USERNAME || "axrisi";
const README_FILE = path.join(__dirname, "..", "README.md");
const START_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:START -->";
const END_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:END -->";
const PER_PAGE = 1000;

if (!DEVTO_API_KEY) {
  console.error("Missing required DEVTO_API_KEY environment variable.");
  process.exit(1);
}

async function fetchFollowersPage(page) {
  const res = await fetch(
    `https://dev.to/api/followers/users?page=${page}&per_page=${PER_PAGE}`,
    {
      headers: {
        "api-key": DEVTO_API_KEY,
        Accept: "application/vnd.forem.api-v1+json",
        "User-Agent": "turazashvili-github-profile",
      },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    const body = (await res.text()).trim().slice(0, 500) || "<empty>";
    throw new Error(`DEV.to API request failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("DEV.to followers endpoint returned an invalid response.");
  }
  return data;
}

async function getFollowersCount() {
  let total = 0;
  for (let page = 1; ; page++) {
    const followers = await fetchFollowersPage(page);
    total += followers.length;
    if (followers.length < PER_PAGE) return total;
  }
}

function renderBadge(count) {
  const label = `${count.toLocaleString("en-US")} followers`;
  const encoded = encodeURIComponent(label).replace(/-/g, "--");
  // HTML (not markdown): markdown is not parsed when GitHub treats the
  // surrounding comment markers as a raw HTML block.
  return `<a href="https://dev.to/${DEVTO_USERNAME}"><img src="https://img.shields.io/badge/DEV-${encoded}-0A0A0A?style=flat&logo=devdotto&logoColor=white" alt="DEV: ${label}" /></a>`;
}

async function main() {
  const count = await getFollowersCount();
  const readme = fs.readFileSync(README_FILE, "utf8");
  const regex = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);
  if (!regex.test(readme)) {
    throw new Error(`Markers ${START_MARKER} / ${END_MARKER} not found in README.md`);
  }
  const updated = readme.replace(regex, `${START_MARKER}${renderBadge(count)}${END_MARKER}`);
  fs.writeFileSync(README_FILE, updated);
  console.log(`DEV.to followers: ${count}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
