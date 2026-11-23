import type { Metadata } from "next";
import Link from "next/link";
import { signup } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field, Select } from "@/components/ui";

export const metadata: Metadata = { title: "Create an issuer account" };

export default function Signup() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold">Create your issuer account</h1>
      <p className="muted mt-1">Set up your institution and start issuing in minutes.</p>
      <ActionForm action={signup} className="card p-6 mt-6 space-y-4">
        <Field label="Institution name" name="orgName" required maxLength={120} placeholder="e.g. Southern Coast TAFE" />
        <Select
          label="Institution type"
          name="orgType"
          options={[
            { value: "TAFE", label: "TAFE" },
            { value: "UNIVERSITY", label: "University" },
            { value: "RTO", label: "Registered Training Organisation (RTO)" },
            { value: "PROFESSIONAL_BODY", label: "Professional body" },
            { value: "EMPLOYER", label: "Employer / workplace training" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Field label="Your name" name="name" required autoComplete="name" />
        <Field label="Work email" name="email" type="email" required autoComplete="email" />
        <Field label="Password" name="password" type="password" required minLength={12} autoComplete="new-password" hint="At least 12 characters. You'll set up two-factor authentication next." />
        <Submit pendingText="Creating account…">Create account</Submit>
        <p className="text-sm muted">
          Already issuing with Meritbox? <Link className="link" href="/login">Sign in</Link>
        </p>
      </ActionForm>
    </div>
  );
}
