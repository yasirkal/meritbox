import type { Achievement } from "@prisma/client";
import { saveAchievement } from "@/actions/dashboard";
import { ActionForm, Submit } from "./ActionForm";
import { Field, Select, TextArea, typeLabel } from "./ui";
import { ACHIEVEMENT_TYPES, AQF_LEVELS, ASC_CORE_COMPETENCIES, ASSESSMENT_TYPES, DELIVERY_MODES } from "@/lib/catalog";
import { BADGE_ICONS, BADGE_SHAPES } from "@/lib/badge-svg";
import { db } from "@/lib/db";

export async function AchievementForm({ a }: { a?: Achievement }) {
  const tga = await db.tgaComponent.findMany({ orderBy: { code: "asc" }, take: 2000 });
  const skills = (a?.skills as { name: string; framework?: string }[] | undefined) ?? [];
  const core = new Set(skills.filter((s) => s.framework === "Australian Skills Classification").map((s) => s.name));
  const custom = skills.filter((s) => s.framework !== "Australian Skills Classification").map((s) => s.name).join(", ");
  const opt = (xs: readonly string[]) => [{ value: "", label: "—" }, ...xs.map((x) => ({ value: x, label: x }))];
  return (
    <ActionForm action={saveAchievement} className="space-y-6">
      {a && <input type="hidden" name="id" value={a.id} />}
      <fieldset className="card p-5 space-y-4">
        <legend className="font-semibold px-1">Basics</legend>
        <Field label="Name" name="name" required maxLength={140} defaultValue={a?.name} placeholder="e.g. Data Literacy Foundations" />
        <Select label="Type" name="achievementType" defaultValue={a?.achievementType ?? "MicroCredential"} options={ACHIEVEMENT_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))} />
        <TextArea label="Description" name="description" required minLength={10} maxLength={4000} defaultValue={a?.description} hint="What the learner can now do. Shown publicly." />
        <TextArea label="Criteria" name="criteria" required minLength={5} maxLength={4000} defaultValue={a?.criteria} hint="How the credential is earned, e.g. assessment requirements." />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Field of study" name="fieldOfStudy" defaultValue={a?.fieldOfStudy ?? ""} placeholder="e.g. Information Technology" />
          <Field label="Expires after (days)" name="expiresAfterDays" type="number" min={1} defaultValue={a?.expiresAfterDays ?? ""} hint="Leave blank if it never expires (e.g. first aid: 1095)." />
        </div>
        <Field label="Tags" name="tags" defaultValue={a?.tags.join(", ")} hint="Comma separated." />
      </fieldset>

      <fieldset className="card p-5 space-y-4">
        <legend className="font-semibold px-1">National Microcredentials Framework</legend>
        <p className="hint -mt-2">These details travel inside the signed credential so employers and other providers can assess it for credit.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Volume of learning (hours)" name="volumeOfLearningHours" type="number" min={1} defaultValue={a?.volumeOfLearningHours ?? ""} />
          <Select label="AQF level alignment" name="aqfLevel" defaultValue={a?.aqfLevel?.toString() ?? ""} options={[{ value: "", label: "Not aligned" }, ...Object.entries(AQF_LEVELS).map(([k, v]) => ({ value: k, label: `Level ${k} — ${v}` }))]} />
          <Select label="Assessment" name="assessmentType" defaultValue={a?.assessmentType ?? ""} options={opt(ASSESSMENT_TYPES)} />
          <Select label="Delivery mode" name="deliveryMode" defaultValue={a?.deliveryMode ?? ""} options={opt(DELIVERY_MODES)} />
          <Field label="Credit points" name="creditPoints" type="number" step="0.5" min={0} defaultValue={a?.creditPoints?.toString() ?? ""} />
        </div>
        <TextArea label="Credit recognition / pathways" name="creditRecognition" defaultValue={a?.creditRecognition ?? ""} hint="e.g. 'Credit towards the Graduate Certificate in Data Science (6 cp)'" />
        <TextArea label="Industry endorsement" name="industryEndorsement" defaultValue={a?.industryEndorsement ?? ""} />
      </fieldset>

      <fieldset className="card p-5 space-y-4">
        <legend className="font-semibold px-1">Alignment</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Field label="training.gov.au code" name="tgaCode" list="tga-codes" defaultValue={a?.tgaCode ?? ""} placeholder="e.g. HLTAID011" hint="Unit, qualification or skill set (nationally recognised training)." />
            <datalist id="tga-codes">
              {tga.map((t) => (
                <option key={t.code} value={t.code}>{t.title}</option>
              ))}
            </datalist>
          </div>
          <Field label="training.gov.au title" name="tgaTitle" defaultValue={a?.tgaTitle ?? ""} hint="Filled in automatically for known codes." />
        </div>
        <div>
          <p className="label">Australian Skills Classification — core competencies</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {ASC_CORE_COMPETENCIES.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input type="checkbox" name="ascSkill" value={s} defaultChecked={core.has(s)} /> {s}
              </label>
            ))}
          </div>
        </div>
        <Field label="Other skills" name="customSkills" defaultValue={custom} hint="Comma separated, e.g. 'SQL, Data visualisation'." />
      </fieldset>

      <fieldset className="card p-5 space-y-4">
        <legend className="font-semibold px-1">Badge design</legend>
        <div className="grid sm:grid-cols-4 gap-4">
          <Select label="Shape" name="badgeShape" defaultValue={a?.badgeShape ?? "hexagon"} options={BADGE_SHAPES.map((s) => ({ value: s, label: s }))} />
          <Select label="Icon" name="badgeIcon" defaultValue={a?.badgeIcon ?? "star"} options={BADGE_ICONS.map((s) => ({ value: s, label: s }))} />
          <Field label="Main colour" name="badgeColor" type="color" defaultValue={a?.badgeColor ?? "#0f4c81"} className="input h-10 p-1" />
          <Field label="Accent colour" name="badgeAccent" type="color" defaultValue={a?.badgeAccent ?? "#f2a900"} className="input h-10 p-1" />
        </div>
      </fieldset>
      <Submit pendingText="Saving…">{a ? "Save changes" : "Create achievement"}</Submit>
    </ActionForm>
  );
}
