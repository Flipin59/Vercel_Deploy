import { QuizPage } from "@/features/play/QuizPage";

export default async function Page({ searchParams }: PageProps<"/play/quiz">) {
  return <QuizPage searchParams={await searchParams} />;
}
