import { requireStaff, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { deletePathway, savePathway } from "@/actions/dashboard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field, PageTitle, Select, TextArea } from "@/components/ui";

export default async function Pathways() {
  const { org, membership } = await requireStaff();
  const [pathways, achievements] = await Promise.all([
    db.pathway.findMany({ where: { organizationId: org.id }, include: { steps: { include: { achievement: true }, orderBy: { position: "asc" } }, reward: true }, orderBy: { createdAt: "desc" } }),
    db.achievement.findMany({ where: { organizationId: org.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
  ]);
  const admin = hasRole(membership.role, "ADMIN");
  return (
    <>
      <PageTitle title="Pathways" subtitle="Stack microcredentials. When a learner holds every step, the reward credential is issued automatically." />
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-4">
          {pathways.map((p) => (
            <section key={p.id} className="card p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-sm muted">{p.description}</p>
                </div>
                {admin && (
                  <form action={deletePathway}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-sm link">Delete</button>
                  </form>
                )}
              </div>
              <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {p.steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden>+</span>}
                    <span className="pill bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">{s.achievement.name}</span>
                  </li>
                ))}
                {p.reward && <li className="flex items-center gap-2"><span aria-hidden>→</span><span className="pill bg-amber-100 text-amber-900">🏆 {p.reward.name}</span></li>}
              </ol>
            </section>
          ))}
          {pathways.length === 0 && <div className="card p-8 muted text-center">No pathways yet.</div>}
        </div>
        {admin && (
          <ActionForm action={savePathway} className="card p-5 space-y-4" resetOnOk>
            <h2 className="font-semibold">New pathway</h2>
            <Field label="Name" name="name" required />
            <TextArea label="Description" name="description" />
            <fieldset>
              <legend className="label">Steps (choose two or more)</legend>
              <div className="space-y-1 text-sm max-h-60 overflow-y-auto">
                {achievements.map((a) => (
                  <label key={a.id} className="flex gap-2 items-center"><input type="checkbox" name="steps" value={a.id} /> {a.name}</label>
                ))}
              </div>
            </fieldset>
            <Select label="Reward on completion" name="rewardAchievementId" options={[{ value: "", label: "None (track only)" }, ...achievements.map((a) => ({ value: a.id, label: a.name }))]} hint="Must be published to be awarded." />
            <Submit>Create pathway</Submit>
          </ActionForm>
        )}
      </div>
    </>
  );
}
