// Placeholder shown until a feature owner replaces their entry point.
export function FeatureStub({
  title,
  owner,
  dir,
}: {
  title: string;
  owner: string;
  dir: string;
}) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted">Owner: {owner}</p>
      <code className="text-sm">{dir}/README.md</code>
    </section>
  );
}
