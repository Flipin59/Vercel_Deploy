import { notFound } from "next/navigation";
import { ChoiceSim } from "@/features/play/ChoiceSim";
import { isChoiceSim } from "@/features/play/sim";

export default async function Page({ params }: PageProps<"/play/sim/[id]">) {
  const { id } = await params;
  if (!isChoiceSim(id)) notFound();
  return <ChoiceSim id={id} />;
}
