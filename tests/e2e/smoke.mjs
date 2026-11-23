/**
 * End-to-end smoke test against a running server (default http://localhost:3000).
 *   node tests/e2e/smoke.mjs [baseUrl]
 * Walks the full journey: sign up → enforced MFA → create & publish achievement → issue (UI, CSV, API)
 * → public page → verify → tamper detection → revoke → learner claims into wallet.
 */
import { createRequire } from "node:module";
// Uses the project dependency if installed, else a globally provisioned Playwright.
const { chromium } = createRequire(import.meta.url)("playwright");
import * as OTPAuth from "otpauth";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const run = Date.now().toString(36);
const email = `owner-${run}@uni.example`;
const learner = `learner-${run}@student.example`;
const results = [];
const check = (name, cond, extra = "") => {
  results.push([cond ? "PASS" : "FAIL", name, extra]);
  if (!cond) console.error(`FAIL: ${name} ${extra}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const cspErrors = [];
page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text()));

// 1. Sign up
await page.goto(`${BASE}/signup`);
await page.fill("#orgName", `Test University ${run}`);
await page.selectOption("#orgType", "UNIVERSITY");
await page.fill("#name", "Robin Lee");
await page.fill("#email", email);
await page.fill("#password", "correct-horse-battery-staple");
await page.click("button[type=submit]");
await page.waitForURL(/\/dashboard\/security\?enrol=1/);
check("signup forces MFA enrolment", page.url().includes("enrol=1"));

// 2. Enrol TOTP
await page.click("text=Set up two-factor authentication");
await page.click("text=Can't scan?");
const secret = (await page.textContent("details code")).trim();
const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
await page.fill("#code", totp.generate());
await page.click("button:has-text('Turn on')");
await page.waitForURL(/\/dashboard\?mfa=1/);
check("MFA enrolment completes", true);

// 3. Create + publish achievement
await page.goto(`${BASE}/dashboard/achievements/new`);
await page.fill("#name", "Cyber Security Essentials");
await page.fill("#description", "Learners can apply foundational cyber hygiene, including the Essential Eight.");
await page.fill("#criteria", "Pass the final assessment.");
await page.fill("#volumeOfLearningHours", "20");
await page.selectOption("#aqfLevel", "5");
await page.fill("#tgaCode", "BSBCRT511");
await page.check("input[value='Problem solving']");
await page.click("button:has-text('Create achievement')");
await page.waitForURL(/\/dashboard\/achievements\/[0-9a-f-]+\?created=1/);
const achievementId = page.url().match(/achievements\/([0-9a-f-]+)/)[1];
await page.click("button:has-text('Publish')");
await page.waitForSelector("text=Published");
check("achievement created and published", true);

// 4. Issue one
await page.goto(`${BASE}/dashboard/issue?achievement=${achievementId}`);
const single = page.locator("form").filter({ hasText: "One recipient" });
await single.locator("#name").fill("Taylor Learner");
await single.locator("#email").fill(learner);
await single.locator("#usi").fill("AB3CD4EF5G");
await single.locator("button[type=submit]").click();
const okText = await page.locator("[role=status]").first().textContent({ timeout: 15000 });
const credId = okText.match(/\/c\/([0-9a-f-]{36})/)?.[1];
check("single issuance succeeds", !!credId, okText);

// 5. Bulk CSV
const dir = mkdtempSync(join(tmpdir(), "mbx-"));
const csv = join(dir, "cohort.csv");
writeFileSync(csv, `email,name,usi,student_id\na-${run}@x.example,Ada One,,S1\nb-${run}@x.example,Ben Two,BADUSI,S2\nc-${run}@x.example,Cai Three,,S3\n`);
const bulk = page.locator("form").filter({ hasText: "Bulk from CSV" });
await bulk.locator("#file").setInputFiles(csv);
await bulk.locator("button[type=submit]").click();
const bulkMsg = await bulk.locator("[role=alert]").textContent({ timeout: 20000 });
check("bulk CSV issues valid rows and reports bad ones", /Issued 2 of 3/.test(bulkMsg) && /row 3/.test(bulkMsg), bulkMsg);

// 6. Public credential page + standards endpoints
const pub = await browser.newPage();
pub.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text()));
await pub.goto(`${BASE}/c/${credId}`);
check("public page shows verified", await pub.isVisible("text=Verified credential"));
check("public page shows NMF info", await pub.isVisible("text=Microcredential information"));
check("USI not exposed on public page", !(await pub.content()).includes("AB3CD4EF5G"));
const jwt = await (await fetch(`${BASE}/c/${credId}/credential`)).text();
const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
check("credential is an OpenBadgeCredential", payload.type.includes("OpenBadgeCredential"));
check("recipient email is hashed", JSON.stringify(payload).includes("sha256$") && !JSON.stringify(payload).includes(learner));
check("TGA alignment embedded", JSON.stringify(payload).includes("BSBCRT511"));
const statusUrl = payload.credentialStatus.statusListCredential;
const statusRes = await fetch(statusUrl.replace(/^https?:\/\/[^/]+/, BASE));
check("status list served as vc+jwt", statusRes.headers.get("content-type") === "application/vc+jwt");

const verify = async (credential) => (await fetch(`${BASE}/api/v1/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }) })).json();
let v = await verify(jwt);
check("API verify: valid", v.verified === true && v.status === "valid", JSON.stringify(v.checks));
const [h, p, s] = jwt.split(".");
const forged = JSON.parse(Buffer.from(p, "base64url").toString());
forged.credentialSubject.name = "Mallory";
v = await verify(`${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${s}`);
check("API verify: tampering detected", v.verified === false && v.checks.some((c) => c.id === "signature" && c.status === "fail"));

// 7. API key + API issuance
await page.goto(`${BASE}/dashboard/developers`);
const keyForm = page.locator("form").filter({ hasText: "Create API key" });
await keyForm.locator("#name").fill("LMS");
await keyForm.locator("input[value='credentials:revoke']").check();
await keyForm.locator("button[type=submit]").click();
const apiKey = (await keyForm.locator("code.select-all").textContent({ timeout: 10000 })).trim();
const auth = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
const list = await (await fetch(`${BASE}/api/v1/achievements`, { headers: auth })).json();
check("API lists achievements", list.data?.length === 1);
const issued = await fetch(`${BASE}/api/v1/credentials`, { method: "POST", headers: auth, body: JSON.stringify({ achievement_id: achievementId, recipient: { email: `api-${run}@x.example`, name: "Api Person" }, notify: false }) });
const issuedJson = await issued.json();
check("API issues credential (201)", issued.status === 201 && !!issuedJson.data?.vc_jwt);
const bad = await fetch(`${BASE}/api/v1/achievements`, { headers: { authorization: "Bearer mbx_live_AAAAAAAA_" + "x".repeat(43) } });
check("API rejects bad key (401)", bad.status === 401);
const revoked = await fetch(`${BASE}/api/v1/credentials/${issuedJson.data.id}/revoke`, { method: "POST", headers: auth, body: JSON.stringify({ reason: "Test revocation via API" }) });
check("API revokes", revoked.status === 200);
v = await verify(issuedJson.data.vc_jwt);
check("revoked credential fails verification", v.status === "revoked");

// 8. Revoke via dashboard
await page.goto(`${BASE}/dashboard/credentials/${credId}`);
await page.fill("#reason", "Issued in error");
await page.click("button:has-text('Revoke credential')");
await page.waitForSelector("button:has-text('Reinstate')", { timeout: 10000 });
await pub.reload();
check("public page reflects revocation", await pub.isVisible("text=This credential has been revoked"));
await page.click("button:has-text('Reinstate')");
await page.waitForTimeout(1000);
check("reinstated credential verifies again", (await verify(jwt)).status === "valid");

// 9. Learner claims via emailed link
const learnerCtx = await browser.newContext();
const lp = await learnerCtx.newPage();
await lp.goto(`${BASE}/dev/outbox`);
const claimHref = await lp.locator(`article:has-text("${learner}") a[href*='/claim/']`).first().getAttribute("href");
await lp.goto(claimHref);
await lp.click("button:has-text('Add to my wallet')");
await lp.waitForURL(/\/wallet\?claimed=/);
check("learner claims credential into wallet", await lp.isVisible("text=Cyber Security Essentials"));
await lp.click("button:has-text('Make private')");
await lp.waitForSelector("text=Private");
const anon = await fetch(`${BASE}/c/${credId}`);
check("private credential hidden from public", anon.status === 404);
await lp.goto(claimHref);
await lp.click("button:has-text('Add to my wallet')");
check("claim link is single-use", await lp.waitForSelector("text=expired or has already been used", { timeout: 10000 }).then(() => true, () => false));

// 10. Security headers & access control
const home = await fetch(BASE);
check("CSP header present", /nonce-/.test(home.headers.get("content-security-policy") ?? ""));
check("HSTS header present", !!home.headers.get("strict-transport-security"));
const anonDash = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
check("dashboard requires auth", [302, 303, 307].includes(anonDash.status));
await lp.goto(`${BASE}/dashboard`);
check("learner cannot reach dashboard", lp.url().endsWith("/wallet"));
check("no CSP violations in browser console", cspErrors.length === 0, cspErrors.join(" | "));

await browser.close();
const failed = results.filter((r) => r[0] === "FAIL");
for (const r of results) console.log(r[0], r[1]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
