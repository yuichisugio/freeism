export function LocalDateTime({ value }: Readonly<{ value: string }>) {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return <span>{value}</span>;
  const absolute = new Date(epoch).toISOString();
  const local = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "long",
  }).format(epoch);
  return (
    <time dateTime={absolute} title={absolute}>
      {local} <span className="absolute-time">({absolute})</span>
    </time>
  );
}
