declare function BidiValue(props: { kind: string; children: unknown }): JSX.Element;
declare function BookingActionPanel(props: { cancellationDeadline: string }): JSX.Element;

const copy = {
  he: { whatsappBody: "שוחחו איתנו במספר 055-939-8438" },
};
const form = { cover_image_url: "https://example.com/cover.jpg" };
const log = {
  idempotency_key: "delivery:member:123",
  provider_message_id: "openwa-message-456",
};

export function FalseNegativeFixture() {
  const cancellationDeadline = `${new Date(0).toLocaleDateString("he-IL")} · ${new Date(
    0,
  ).toLocaleTimeString("he-IL")}`;

  return (
    <main>
      <p>{copy.he.whatsappBody}</p>
      <input value={form.cover_image_url} />
      <p>{log.idempotency_key}</p>
      <p>{log.provider_message_id}</p>
      <p>
        <BidiValue kind="localized-date">
          {new Date(0).toLocaleString("he-IL", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </BidiValue>
      </p>
      <BookingActionPanel cancellationDeadline={cancellationDeadline} />
    </main>
  );
}
