export function ConciergeEmailPreview({ title, emailHtml }: { title: string; emailHtml: string }) {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={emailHtml}
      className="min-h-[680px] w-full rounded-xl border border-border bg-card"
    />
  );
}
