import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AttendanceRosterList } from "../../src/components/admin/AttendanceRosterList";

const roster = [
  { id: "booking-maya", member: { name: "Maya Cohen", phone: "050-1111111" } },
  { id: "booking-noa", member: { name: "Noa Levi", phone: "050-2222222" } },
];

function renderRoster(query: string) {
  return renderToStaticMarkup(
    <AttendanceRosterList
      roster={roster}
      query={query}
      lang="en"
      caption="Attendance roster"
      getRowKey={(booking) => booking.id}
      empty={<p>No matching members</p>}
      columns={[
        {
          id: "member",
          label: "Member",
          cell: (booking) => booking.member.name,
        },
      ]}
    />,
  );
}

describe("admin attendance roster", () => {
  test("renders a non-empty ready roster filtered by the current name search", () => {
    const html = renderRoster("maya");

    expect(html).toContain("Maya Cohen");
    expect(html).not.toContain("Noa Levi");
    expect(html).not.toContain("No matching members");
  });

  test("preserves phone search when rendering the ready roster", () => {
    const html = renderRoster("2222");

    expect(html).toContain("Noa Levi");
    expect(html).not.toContain("Maya Cohen");
  });
});
