export function AppHeader({ title }: { title: string }) {
  return (
    <header className="px-6 py-6 md:px-10">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
    </header>
  );
}
