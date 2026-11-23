import { requireStaff } from "@/lib/auth";
import { AchievementForm } from "@/components/AchievementForm";
import { PageTitle } from "@/components/ui";

export default async function NewAchievement() {
  await requireStaff("ISSUER");
  return (
    <>
      <PageTitle title="New achievement" subtitle="Saved as a draft. Publish it when you're ready to issue." />
      <AchievementForm />
    </>
  );
}
