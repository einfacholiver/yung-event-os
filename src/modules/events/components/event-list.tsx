"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin, Search } from "lucide-react";
import { statusLabels, formatEventDate } from "../config";
import { StatusBadge } from "./status-badge";

type EventSummary = {
  id: string;
  name: string;
  status: keyof typeof statusLabels;
  startsAt: Date | null;
  timezone: string;
  location: string | null;
};

export function EventList({ events }: { events: EventSummary[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const filtered = events.filter(
    (event) =>
      event.name
        .toLocaleLowerCase("de")
        .includes(query.trim().toLocaleLowerCase("de")) &&
      (!status || event.status === status),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-3 left-3 size-4"
          />
          <label htmlFor="event-search" className="sr-only">
            Events suchen
          </label>
          <input
            id="event-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Events suchen …"
            className="bg-card h-10 w-full rounded-md border pr-3 pl-10 text-sm focus-visible:outline-2"
          />
        </div>
        <label className="sr-only" htmlFor="event-status">
          Status filtern
        </label>
        <select
          id="event-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-card h-10 rounded-md border px-3 text-sm sm:w-48"
        >
          <option value="">Alle Status</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {filtered.length} von {events.length} Events
      </p>
      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => (
            <Link
              key={event.id}
              href={"/events/" + encodeURIComponent(event.id)}
              aria-label={event.name + " öffnen"}
              className="event-card bg-card group flex min-h-56 flex-col rounded-xl border p-6 transition-all focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={event.status} />
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-muted-foreground group-hover:text-foreground size-5"
                />
              </div>
              <h2 className="mt-6 mb-5 text-xl font-semibold tracking-tight">
                {event.name}
              </h2>
              <div className="text-muted-foreground mt-auto space-y-2 text-sm">
                <p className="flex items-start gap-2">
                  <CalendarDays
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {formatEventDate(event.startsAt, event.timezone)}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {event.location || "Ort noch offen"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">
            {events.length ? "Keine passenden Events" : "Noch keine Events"}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {events.length
              ? "Passe die Suche oder den Statusfilter an."
              : "Hier erscheinen deine Events, sobald sie angelegt sind."}
          </p>
          {(query || status) && (
            <button
              className="mt-4 text-sm underline underline-offset-4"
              onClick={() => {
                setQuery("");
                setStatus("");
              }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
