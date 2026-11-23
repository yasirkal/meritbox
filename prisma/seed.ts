/**
 * Demo data. Run with `npm run db:seed`. Creates a fictional TAFE ("Southern Coast Institute of TAFE"),
 * an owner account, achievements aligned to training.gov.au and the NMF, a stackable pathway and credentials.
 *
 *   Staff sign-in:  demo@meritbox.test / demo-password-123   (MFA not enforced for the demo org)
 *   Learner wallet: request a magic link for alex.nguyen@example.com and open it from /dev/outbox
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { generateSigningKey } from "../src/lib/keys";
import { issueCredential } from "../src/lib/issuance";
import { TGA_SAMPLE } from "../src/lib/catalog";

const db = new PrismaClient();

async function main() {
  for (const t of TGA_SAMPLE) await db.tgaComponent.upsert({ where: { code: t.code }, create: t, update: t });

  if (await db.organization.findUnique({ where: { slug: "southern-coast-tafe" } })) {
    console.log("Demo data already present — skipping.");
    return;
  }
  const owner = await db.user.create({
    data: { email: "demo@meritbox.test", name: "Sam Taylor", passwordHash: await hashPassword("demo-password-123"), emailVerifiedAt: new Date() },
  });
  const org = await db.organization.create({
    data: {
      slug: "southern-coast-tafe",
      name: "Southern Coast Institute of TAFE",
      type: "TAFE",
      rtoCode: "99999",
      website: "https://example.edu.au",
      email: "credentials@example.edu.au",
      description: "A fictional TAFE used for Meritbox demonstrations.",
      brandColor: "#0f4c81",
      requireMfa: false,
      memberships: { create: { userId: owner.id, role: "OWNER" } },
    },
  });
  await generateSigningKey(org.id, "RS256");

  const base = { organizationId: org.id, status: "PUBLISHED" as const };
  const firstAid = await db.achievement.create({
    data: {
      ...base,
      name: "Provide First Aid",
      description: "Recognises the skills and knowledge required to provide a first aid response to a casualty in line with first aid guidelines.",
      criteria: "Successful completion of practical and knowledge assessment for HLTAID011.",
      achievementType: "Competency",
      tgaCode: "HLTAID011",
      tgaTitle: "Provide First Aid",
      volumeOfLearningHours: 18,
      assessmentType: "Competency-based (VET)",
      deliveryMode: "Blended",
      expiresAfterDays: 1095,
      skills: [{ name: "Problem solving", framework: "Australian Skills Classification" }, { name: "Oral communication", framework: "Australian Skills Classification" }],
      tags: ["health", "safety"],
      badgeShape: "shield",
      badgeIcon: "heart",
      badgeColor: "#b42318",
      badgeAccent: "#ffffff",
    },
  });
  const data1 = await db.achievement.create({
    data: {
      ...base,
      name: "Data Literacy Foundations",
      description: "Learners can read, interpret and communicate with data, including spreadsheets, basic statistics and charts.",
      criteria: "Complete four online modules and pass a summative assessment with 70% or higher.",
      achievementType: "MicroCredential",
      volumeOfLearningHours: 30,
      aqfLevel: 4,
      assessmentType: "Summative — knowledge",
      deliveryMode: "Online",
      creditRecognition: "Credit towards ICT50220 Diploma of Information Technology (by RPL).",
      industryEndorsement: "Developed with the (fictional) Regional Digital Skills Alliance.",
      skills: [{ name: "Numeracy", framework: "Australian Skills Classification" }, { name: "Digital engagement", framework: "Australian Skills Classification" }],
      tags: ["data", "digital"],
      badgeIcon: "spark",
    },
  });
  const data2 = await db.achievement.create({
    data: {
      ...base,
      name: "Data Visualisation in Practice",
      description: "Learners design clear, accessible charts and dashboards for real workplace data.",
      criteria: "Portfolio of three visualisations assessed against a published rubric.",
      achievementType: "MicroCredential",
      volumeOfLearningHours: 30,
      aqfLevel: 4,
      assessmentType: "Portfolio",
      deliveryMode: "Online",
      skills: [{ name: "Digital engagement", framework: "Australian Skills Classification" }, { name: "Writing", framework: "Australian Skills Classification" }],
      badgeIcon: "gear",
      badgeColor: "#2f7d5b",
    },
  });
  const capstone = await db.achievement.create({
    data: {
      ...base,
      name: "Applied Data Skills (Stack)",
      description: "Awarded on completing both data microcredentials, recognising 60 hours of applied data learning.",
      criteria: "Hold Data Literacy Foundations and Data Visualisation in Practice.",
      achievementType: "Award",
      volumeOfLearningHours: 60,
      aqfLevel: 4,
      badgeShape: "rosette",
      badgeIcon: "star",
      badgeColor: "#061f36",
    },
  });
  await db.pathway.create({
    data: {
      organizationId: org.id,
      name: "Applied Data Skills",
      description: "Two microcredentials that stack into a recognised award.",
      rewardAchievementId: capstone.id,
      steps: { create: [{ achievementId: data1.id, position: 0 }, { achievementId: data2.id, position: 1 }] },
    },
  });

  const people = [
    ["alex.nguyen@example.com", "Alex Nguyen", "VX4K7MNP2Q"],
    ["priya.sharma@example.com", "Priya Sharma", null],
    ["jack.oconnor@example.com", "Jack O'Connor", null],
    ["mia.wilson@example.com", "Mia Wilson", null],
  ] as const;
  for (const [email, name, usi] of people) {
    await issueCredential({ org, achievement: firstAid, actorUserId: owner.id }, { email, name, usi, studentId: `S${Math.floor(1e6 + Math.random() * 9e6)}` });
    await issueCredential({ org, achievement: data1, actorUserId: owner.id }, { email, name });
  }
  // Alex completes the stack, so the pathway reward is issued automatically
  await issueCredential({ org, achievement: data2, actorUserId: owner.id }, { email: "alex.nguyen@example.com", name: "Alex Nguyen" });

  console.log("Seeded demo TAFE. Sign in as demo@meritbox.test / demo-password-123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
