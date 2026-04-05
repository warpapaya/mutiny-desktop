#!/usr/bin/env node

const target = process.argv[2] || "https://app.mutinyapp.gg";

const res = await fetch(target, {
  redirect: "follow",
  headers: {
    "user-agent": "mutiny-desktop-smoke-test/1.0",
  },
});

if (!res.ok) {
  throw new Error(`Request failed for ${target}: ${res.status} ${res.statusText}`);
}

const html = await res.text();

if (!html.includes("<title>Mutiny</title>")) {
  throw new Error(`Expected Mutiny title at ${target}`);
}

if (/Stoat|stoat|Revolt|revolt/.test(html)) {
  throw new Error(`Found upstream branding in hosted app response for ${target}`);
}

console.log(`✅ Hosted app smoke test passed for ${target}`);
