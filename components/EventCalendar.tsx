import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { useState } from "react";
import type { FeedEvent } from "@/lib/cms";
import { siteHref } from "@/lib/cms";

function EventListItem({ event, locale, past = false }: { event: FeedEvent; locale: string; past?: boolean }) {
  const start = new Date(event.start);
  const external = Boolean(event.externalUrl);
  const href = siteHref(event.externalUrl || event.href);
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(start);
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(start).replace(".", "");
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(start);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(start);
  const time = event.allDay ? "Heldag" : new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(start);
  return (
    <article className={`show-list-item ${past ? "is-past" : ""}`}>
      <div className="show-list-date" aria-label={`${day} ${month} ${year}`}>
        <strong>{day}</strong><span>{month}</span><small>{year}</small>
      </div>
      <div className="show-list-content">
        <p className="show-list-time"><CalendarDays aria-hidden="true" />{weekday} · {time}</p>
        <h4><a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{event.title}</a></h4>
        {(event.venue || event.address) && <p className="show-list-place"><MapPin aria-hidden="true" />{[event.venue, event.address].filter(Boolean).join(", ")}</p>}
      </div>
      <a className="show-list-arrow" href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} aria-label={`Mer information om ${event.title}`}><ArrowRight aria-hidden="true" /></a>
    </article>
  );
}

export function EventLists({ events, locale }: { events: FeedEvent[]; locale: string }) {
  const [now] = useState(() => Date.now());
  const upcoming = events.filter((event) => new Date(event.end).getTime() >= now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const past = events.filter((event) => new Date(event.end).getTime() < now).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  return (
    <div className="event-collections">
      <section className="upcoming-shows" aria-labelledby="upcoming-shows-title">
        <div className="show-list-heading"><p>Närmast på tur</p><h3 id="upcoming-shows-title">Kommande spelningar</h3><span>{upcoming.length}</span></div>
        {upcoming.length > 0
          ? <div className="show-list">{upcoming.map((event) => <EventListItem key={event.id} event={event} locale={locale} />)}</div>
          : <p className="show-list-empty">Inga kommande spelningar är publicerade just nu.</p>}
      </section>
      <section className="past-shows" aria-labelledby="past-shows-title">
        <div className="show-list-heading"><p>Arkiv</p><h3 id="past-shows-title">Tidigare spelningar</h3><span>{past.length}</span></div>
        {past.length > 0
          ? <div className="show-list">{past.map((event) => <EventListItem key={event.id} event={event} locale={locale} past />)}</div>
          : <p className="show-list-empty">Inga tidigare spelningar är publicerade.</p>}
      </section>
    </div>
  );
}
