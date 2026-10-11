import { notFound } from "next/navigation";
import { getTeacherCohorts } from "@/features/auth/cohort";
import CohortView from "@/features/auth/CohortView";

// A teacher's classes. Anyone who isn't a teacher (role is set by an admin) gets a 404.
export default async function Page() {
  const cohorts = await getTeacherCohorts();
  if (!cohorts) notFound();
  return <CohortView cohorts={cohorts} />;
}
