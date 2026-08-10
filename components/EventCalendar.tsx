import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import type { FeedEvent } from "@/lib/cms";
import { siteHref } from "@/lib/cms";

function dayKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function EventCalendar({ events, locale }: { events: FeedEvent[]; locale: string }) {
  const now = new Date();
  const firstUpcoming = events.find((event) => new Date(event.end).getTime() >= now.getTime());
  const initialDate = firstUpcoming ? new Date(firstUpcoming.start) : events[0] ? new Date(events[0].start) : now;
  const [month, setMonth] = useState(() => monthStart(initialDate));
  const [selected, setSelected] = useState(() => dayKey(initialDate));

  const eventsByDay = useMemo(() => {
    const map = new Map<string, FeedEvent[]>();
    events.forEach((event) => {
      const key = dayKey(event.start);
      map.set(key, [...(map.get(key) || []), event]);
    });
    return map;
  }, [events]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = (month.getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const selectedEvents = eventsByDay.get(selected) || [];
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + index)).replace(".", ""));
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);

  function changeMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    const firstEvent = events.find((event) => {
      const date = new Date(event.start);
      return date.getFullYear() === next.getFullYear() && date.getMonth() === next.getMonth();
    });
    setSelected(firstEvent ? dayKey(firstEvent.start) : dayKey(next));
  }

  function goToday() {
    setMonth(monthStart(now));
    setSelected(dayKey(now));
  }

  return (
    <div className="event-calendar">
      <div className="calendar-main">
        <div className="calendar-toolbar">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Föregående månad"><ArrowLeft aria-hidden="true" /></button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Nästa månad"><ArrowRight aria-hidden="true" /></button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
        <div className="calendar-grid" role="grid" aria-label={monthLabel}>
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-empty" key={`empty-${index}`} aria-hidden="true" />;
            const date = new Date(month.getFullYear(), month.getMonth(), day);
            const key = dayKey(date);
            const count = eventsByDay.get(key)?.length || 0;
            const isToday = key === dayKey(now);
            return (
              <button
                className={`${count ? "has-event" : ""} ${selected === key ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                key={key}
                type="button"
                role="gridcell"
                aria-selected={selected === key}
                aria-label={`${day} ${monthLabel}${count ? `, ${count} evenemang` : ""}`}
                onClick={() => setSelected(key)}
              >
                <span>{day}</span>
                {count > 0 && <i aria-hidden="true">{count > 1 ? count : ""}</i>}
              </button>
            );
          })}
        </div>
        <button className="calendar-today" type="button" onClick={goToday}>Gå till idag</button>
      </div>
      <aside className="calendar-details" aria-live="polite">
        <p className="calendar-selected-date">{new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${selected}T12:00:00`))}</p>
        {selectedEvents.length > 0 ? selectedEvents.map((event) => {
          const external = Boolean(event.externalUrl);
          const href = siteHref(event.externalUrl || event.href);
          const time = event.allDay ? "Heldag" : new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(event.start));
          return (
            <article className="calendar-event" key={event.id}>
              <p><CalendarDays aria-hidden="true" />{time}</p>
              <h4><a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{event.title}</a></h4>
              {(event.venue || event.address) && <p className="calendar-event-place"><MapPin aria-hidden="true" />{[event.venue, event.address].filter(Boolean).join(", ")}</p>}
              {event.summary && <p className="calendar-event-summary">{event.summary}</p>}
              <a className="text-link" href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>Mer information <ArrowRight aria-hidden="true" /></a>
            </article>
          );
        }) : <div className="calendar-no-events"><CalendarDays aria-hidden="true" /><p>Inga spelningar den här dagen.</p></div>}
      </aside>
    </div>
  );
}
