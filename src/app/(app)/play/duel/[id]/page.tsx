import { DuelPage } from "@/features/play/DuelPage";

export default async function Page({ params }: PageProps<"/play/duel/[id]">) {
  return <DuelPage id={(await params).id} />;
}
