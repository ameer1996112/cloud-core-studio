import type { Key, ReactNode } from "react";

import { AsyncState } from "@/components/ui/async-state";
import {
  ResponsiveDataList,
  type ResponsiveDataListColumn,
} from "@/components/ui/responsive-data-list";
import { deriveAttendanceRosterState } from "@/lib/attendance-view-state";
import type { Lang } from "@/lib/i18n";

type SearchableAttendanceBooking = {
  member?: {
    name?: string | null;
    phone?: string | null;
  } | null;
};

type AttendanceRosterListProps<T extends SearchableAttendanceBooking> = {
  roster: readonly T[];
  query: string;
  lang: Lang;
  caption: string;
  columns: readonly ResponsiveDataListColumn<T>[];
  getRowKey: (item: T, index: number) => Key;
  empty: ReactNode;
};

export function AttendanceRosterList<T extends SearchableAttendanceBooking>({
  roster,
  query,
  lang,
  caption,
  columns,
  getRowKey,
  empty,
}: AttendanceRosterListProps<T>) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRoster = normalizedQuery
    ? roster.filter((booking) => {
        const name = booking.member?.name?.toLocaleLowerCase() ?? "";
        const phone = booking.member?.phone?.toLocaleLowerCase() ?? "";
        return name.includes(normalizedQuery) || phone.includes(normalizedQuery);
      })
    : roster;
  const state = deriveAttendanceRosterState({ isLoading: false, roster, lang });

  return (
    <AsyncState state={state}>
      {() => (
        <ResponsiveDataList
          caption={caption}
          data={filteredRoster}
          columns={columns}
          getRowKey={getRowKey}
          empty={empty}
        />
      )}
    </AsyncState>
  );
}
