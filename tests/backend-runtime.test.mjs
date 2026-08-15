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
      UPLOAD_DIR: join(directory, "uploads"),
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

    const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const imageForm = new FormData();
    imageForm.append("image", new Blob([pngBytes], { type:"image/png" }), "test-bouquet.png");
    const uploadedImage = await json(await fetch(`${origin}/api/images`, {
      method: "POST",
      headers: ownerHeaders,
      body: imageForm,
    }));
    assert.match(uploadedImage.url, /^\/api\/images\?file=[0-9a-f-]+\.png$/);
    const servedImage = await fetch(`${origin}${uploadedImage.url}`);
    assert.equal(servedImage.status, 200);
    assert.equal(servedImage.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await servedImage.arrayBuffer()), pngBytes);

    const consultations = await json(await fetch(`${origin}/api/owner/consultations`, { headers: ownerHeaders }));
    assert.equal(consultations.consultations[0].customerName, "测试顾客");

    const createdMember = await json(await fetch(`${origin}/api/owner/members`, {
      method: "POST",
      headers: { ...ownerHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ action:"create", name:"测试会员", contact:"test-contact" }),
    }));
    assert.equal(createdMember.member.name, "测试会员");

    const referredConsultation = await json(await fetch(`${origin}/api/consultations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bouquetId:"FL-002", bouquetName:"暮色花园", size:"M", materialPlan:"原版花材", priceRange:"599–1299", customerName:"推荐顾客", referralCode:createdMember.member.code }),
    }));
    const consultationRows = await json(await fetch(`${origin}/api/owner/consultations`, { headers:ownerHeaders }));
    const referredOrder = consultationRows.consultations.find(row => row.reference === referredConsultation.reference);
    assert.ok(referredOrder);
    await json(await fetch(`${origin}/api/owner/consultations`, {
      method: "PATCH",
      headers: { ...ownerHeaders, "Content-Type":"application/json" },
      body: JSON.stringify({ id:referredOrder.id, status:"purchased", purchaseAmount:699 }),
    }));
    const rewardedMembers = await json(await fetch(`${origin}/api/owner/members`, { headers:ownerHeaders }));
    assert.equal(rewardedMembers.members[0].balance, 10);
    const deletedOrder = await json(await fetch(`${origin}/api/owner/consultations`, {
      method: "DELETE",
      headers: { ...ownerHeaders, "Content-Type":"application/json" },
      body: JSON.stringify({ id:referredOrder.id }),
    }));
    assert.equal(deletedOrder.reversedReward, true);
    const membersAfterDeletion = await json(await fetch(`${origin}/api/owner/members`, { headers:ownerHeaders }));
    assert.equal(membersAfterDeletion.members[0].balance, 0);
    const ordersAfterDeletion = await json(await fetch(`${origin}/api/owner/consultations`, { headers:ownerHeaders }));
    assert.ok(!ordersAfterDeletion.consultations.some(row => row.id === referredOrder.id));

    const changedCatalog = structuredClone(initialCatalog);
    changedCatalog.bouquets[0].name = "已保存的测试花礼";
    changedCatalog.bouquets[0].image = uploadedImage.url;
    changedCatalog.bouquets[1].image = `data:image/png;base64,${pngBytes.toString("base64")}`;
    const catalogSave = await json(await fetch(`${origin}/api/catalog`, {
      method: "PUT",
      headers: { ...ownerHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(changedCatalog),
    }));
    assert.equal(catalogSave.catalog.bouquets[0].image, uploadedImage.url);
    assert.match(catalogSave.catalog.bouquets[1].image, /^\/api\/images\?file=[0-9a-f-]+\.png$/);
    const savedCatalog = await json(await fetch(`${origin}/api/catalog`));
    assert.equal(savedCatalog.bouquets[0].name, "已保存的测试花礼");
    assert.equal(savedCatalog.bouquets[0].image, uploadedImage.url);
    assert.ok(!savedCatalog.bouquets.some(bouquet => bouquet.image.startsWith("data:image/")));

    const catalogAfterBouquetDeletion = structuredClone(savedCatalog);
    catalogAfterBouquetDeletion.bouquets = catalogAfterBouquetDeletion.bouquets.filter(bouquet => bouquet.id !== "FL-001");
    await json(await fetch(`${origin}/api/catalog`, {
      method: "PUT",
      headers: { ...ownerHeaders, "Content-Type":"application/json" },
      body: JSON.stringify(catalogAfterBouquetDeletion),
    }));
    const catalogWithoutDeletedBouquet = await json(await fetch(`${origin}/api/catalog`));
    assert.ok(!catalogWithoutDeletedBouquet.bouquets.some(bouquet => bouquet.id === "FL-001"));

    const editor = await fetch(`${origin}/owner/editor`, { headers: ownerHeaders, redirect:"manual" });
    assert.equal(editor.status, 200);
    const editorHtml = await editor.text();
    assert.match(editorHtml, /店主编辑台/);
    assert.match(editorHtml, /花礼管理/);
    assert.match(editorHtml, /场景管理/);
    assert.match(editorHtml, /新增花礼/);
    assert.match(editorHtml, /删除当前花礼/);

  } finally {
    server.kill("SIGTERM");
    await new Promise(resolve => server.once("exit", resolve));
    await rm(directory, { recursive:true, force:true });
  }
});
