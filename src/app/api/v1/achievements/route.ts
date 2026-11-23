import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  const key = await withApiKey(req, "achievements:read");
  if (key instanceof Response) return key;
  const list = await db.achievement.findMany({ where: { organizationId: key.organizationId }, orderBy: { name: "asc" } });
  return Response.json({
    data: list.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status.toLowerCase(),
      achievement_type: a.achievementType,
      tga_code: a.tgaCode,
      volume_of_learning_hours: a.volumeOfLearningHours,
      aqf_level: a.aqfLevel,
      image_url: `${env.appUrl}/api/badge/${a.id}`,
      url: `${env.appUrl}/achievements/${a.id}`,
    })),
  });
}
