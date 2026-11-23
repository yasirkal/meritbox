import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueBulk, issueSingle } from "@/actions/dashboard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Empty, Field, PageTitle, Select, TextArea } from "@/components/ui";

export default async function Issue({ searchParams }: { searchParams: Promise<{ achievement?: string }> }) {
  const { org } = await requireStaff("ISSUER");
  const { achievement } = await searchParams;
  const published = await db.achievement.findMany({ where: { organizationId: org.id, status: "PUBLISHED" }, orderBy: { name: "asc" } });
  if (!published.length)
    return (
      <>
        <PageTitle title="Issue credentials" />
        <Empty title="Publish an achievement first">
          <Link className="link" href="/dashboard/achievements">Go to achievements</Link>
        </Empty>
      </>
    );
  const options = published.map((a) => ({ value: a.id, label: a.name }));
  const notify = (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="notify" value="on" defaultChecked /> Email recipients a claim link
      <input type="hidden" name="notify" value="off" />
    </label>
  );
  return (
    <>
      <PageTitle title="Issue credentials" subtitle="Each credential is signed with your institution's key the moment it's issued." />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <ActionForm action={issueSingle} className="card p-5 space-y-4" resetOnOk>
          <h2 className="font-semibold text-lg">One recipient</h2>
          <Select label="Achievement" name="achievementId" options={options} defaultValue={achievement} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Recipient name" name="name" required />
            <Field label="Recipient email" name="email" type="email" required />
            <Field label="USI (optional)" name="usi" maxLength={10} pattern="[A-HJ-NP-Za-hj-np-z2-9]{10}" hint="Encrypted at rest; never shown publicly." />
            <Field label="Student ID (optional)" name="studentId" maxLength={40} />
            <Field label="Date achieved" name="issuedOn" type="date" hint="Defaults to today." />
            <Field label="Evidence URL (optional)" name="evidenceUrl" type="url" />
          </div>
          <TextArea label="Evidence narrative (optional)" name="narrative" maxLength={2000} />
          {notify}
          <Submit pendingText="Signing…">Issue credential</Submit>
        </ActionForm>
        <ActionForm action={issueBulk} className="card p-5 space-y-4">
          <h2 className="font-semibold text-lg">Bulk from CSV</h2>
          <Select label="Achievement" name="achievementId" options={options} defaultValue={achievement} />
          <div>
            <label htmlFor="file" className="label">CSV file</label>
            <input id="file" name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
            <p className="hint">
              Columns: <code>email</code>, <code>name</code> (required); <code>usi</code>, <code>student_id</code>, <code>issued_on</code> (YYYY-MM-DD), <code>evidence_url</code>, <code>narrative</code>. Up to 5,000 rows. <a className="link" href="/meritbox-bulk-template.csv" download>Download a template</a>.
            </p>
          </div>
          {notify}
          <Submit pendingText="Issuing — this can take a minute…">Upload and issue</Submit>
          <p className="hint">Rows with errors are skipped and listed; everything else is issued.</p>
        </ActionForm>
      </div>
    </>
  );
}
