import { describe, expect, it } from "vitest";
import { renderBadgeSvg } from "@/lib/badge-svg";
import { webhookUrlProblem } from "@/lib/webhooks";
import { USI_RE } from "@/lib/issuance";

describe("badge SVG", () => {
  it("escapes user-controlled text and rejects bad colours", () => {
    const svg = renderBadgeSvg({ name: `<script>alert(1)</script>"`, issuer: "A&B", shape: "x", color: "red;}", accent: "#ffffff", icon: "nope" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("A&amp;B");
    expect(svg).toContain('fill="#0f4c81"');
  });
});

describe("webhook URL validation (SSRF guard)", () => {
  it.each([
    ["http://example.com/hook", false],
    ["https://localhost/hook", false],
    ["https://127.0.0.1/hook", false],
    ["https://10.1.2.3/hook", false],
    ["https://172.20.0.1/hook", false],
    ["https://192.168.1.1/hook", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["https://[::1]/hook", false],
    ["https://sms.example.edu.au/hooks/meritbox", true],
  ])("%s → allowed=%s", (url, allowed) => {
    expect(webhookUrlProblem(url) === null).toBe(allowed);
  });
});

describe("USI format", () => {
  it.each([
    ["ABCDE23456", true],
    ["abcde23456", false],
    ["ABCDE2345", false],
    ["ABCDEI3456", false],
    ["ABCDE01456", false],
  ])("%s → %s", (usi, ok) => expect(USI_RE.test(usi)).toBe(ok));
});
