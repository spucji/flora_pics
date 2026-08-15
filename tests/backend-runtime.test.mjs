import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const port = 3199;
const origin = `http://127.0.0.1:${port}`;

async function json(response) {
  const payload = await response.json();
  assert.ok(response.ok, JSON.stringify(payload));
  return payload;
}

test("consultations, members and catalog persist through the Alibaba Node runtime", { timeout: 30_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "flora-runtime-"));
  const server = spawn("npm", ["run", "start"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: join(directory, "flora.sqlite"),
      OWNER_USERNAME: "test-owner",
      OWNER_PASSWORD: "test-password",
      OWNER_SESSION_SECRET: "test-session-secret-with-sufficient-length",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "";
  server.stdout.on("data", chunk => { diagnostics += chunk; });
  server.stderr.on("data", chunk => { diagnostics += chunk; });
  try {
    const startedAt = Date.now();
    while (!diagnostics.includes("Production server running")) {
      if (server.exitCode !== null) assert.fail(`server exited early\n${diagnostics}`);
      if (Date.now() - startedAt > 12_000) assert.fail(`server did not start\n${diagnostics}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const initialCatalog = await json(await fetch(`${origin}/api/catalog`));
    assert.equal(initialCatalog.bouquets[0].id, "FL-001");

    const consultation = await json(await fetch(`${origin}/api/consultations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bouquetId:"FL-001", bouquetName:"雾林来信", size:"M", materialPlan:"原版花材", priceRange:"399–899", customerName:"测试顾客" }),
    }));
    assert.match(consultation.reference, /^FL-/);

    const loginResponse = await fetch(`${origin}/api/owner/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username:"test-owner", password:"test-password", returnTo:"/owner" }),
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get("set-cookie");
    assert.ok(cookie?.includes("flora_owner_session="));
    const ownerHeaders = { Cookie: cookie.split(";")[0] };

    const consultations = await json(await fetch(`${origin}/api/owner/consultations`, { headers: ownerHeaders }));
    assert.equal(consultations.consultations[0].customerName, "测试顾客");

    const createdMember = await json(await fetch(`${origin}/api/owner/members`, {
      method: "POST",
      headers: { ...ownerHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ action:"create", name:"测试会员", contact:"test-contact" }),
    }));
    assert.equal(createdMember.member.name, "测试会员");

    const changedCatalog = structuredClone(initialCatalog);
    changedCatalog.bouquets[0].name = "已保存的测试花礼";
    await json(await fetch(`${origin}/api/catalog`, {
      method: "PUT",
      headers: { ...ownerHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(changedCatalog),
    }));
    const savedCatalog = await json(await fetch(`${origin}/api/catalog`));
    assert.equal(savedCatalog.bouquets[0].name, "已保存的测试花礼");

    const editor = await fetch(`${origin}/owner/editor`, { headers: ownerHeaders, redirect:"manual" });
    assert.equal(editor.status, 200);
  } finally {
    server.kill("SIGTERM");
    await new Promise(resolve => server.once("exit", resolve));
    await rm(directory, { recursive:true, force:true });
  }
});
