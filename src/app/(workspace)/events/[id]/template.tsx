export default function EventTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="workspace-transition">{children}</div>;
}
