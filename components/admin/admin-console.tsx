"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Gauge,
  Inbox,
  Pencil,
  Search,
  SearchX,
  ShieldCheck,
  Ticket,
  UsersRound,
} from "lucide-react";

import { changeUserRoleAction } from "@/app/actions/admin";

import { OccupancyBar, occupancyTone } from "@/components/admin/occupancy-bar";
import { BookingsTable } from "@/components/bookings/bookings-table";
import { EmptyState } from "@/components/common/empty-state";
import { StatCard } from "@/components/common/stat-card";
import { CategoryBadge } from "@/components/experiences/category-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_LABELS, EXPERIENCE_CATEGORIES, type ExperienceCategory } from "@/lib/categories";
import { formatDate, formatDateKey, formatDifficulty, formatDuration, formatPrice, formatTime, toDateKey } from "@/lib/format";
import { ROLE_LABELS, ROLES, type UserRole } from "@/lib/auth/roles";
import { bookingHref, experienceHref } from "@/lib/navigation";
import type { BookingSummary } from "@/lib/types/booking";
import type { ExperienceSlot, ExperienceSummary } from "@/lib/types/experience";
import type { ManagedUser } from "@/lib/types/user";
import { cn } from "@/lib/utils";

type ConsoleData = {
  experiences: ExperienceSummary[];
  slots: ExperienceSlot[];
  bookings: BookingSummary[];
  users: ManagedUser[];
  currentUserId: string;
  windowDays: number;
};

export function AdminConsole(data: ConsoleData) {
  return (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Admin sections">
        <TabsTrigger value="overview">
          <Gauge />
          Overview
        </TabsTrigger>
        <TabsTrigger value="experiences">
          <Compass />
          Experiences
        </TabsTrigger>
        <TabsTrigger value="schedule">
          <CalendarDays />
          Schedule
        </TabsTrigger>
        <TabsTrigger value="bookings">
          <Ticket />
          Bookings
        </TabsTrigger>
        <TabsTrigger value="users">
          <UsersRound />
          Users
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Overview {...data} />
      </TabsContent>
      <TabsContent value="experiences">
        <ExperiencesTable {...data} />
      </TabsContent>
      <TabsContent value="schedule">
        <ScheduleTable {...data} />
      </TabsContent>
      <TabsContent value="bookings">
        <BookingsPanel bookings={data.bookings} />
      </TabsContent>
      <TabsContent value="users">
        <UsersPanel users={data.users} currentUserId={data.currentUserId} />
      </TabsContent>
    </Tabs>
  );
}

/* ---------------------------------------------------------------- overview */

function Overview({ experiences, slots, windowDays }: ConsoleData) {
  const seats = slots.reduce((sum, slot) => sum + slot.capacity, 0);
  const booked = slots.reduce((sum, slot) => sum + slot.booked, 0);
  const full = slots.filter((slot) => slot.booked >= slot.capacity).length;
  const bySlug = new Map(experiences.map((experience) => [experience.slug, experience]));

  const byCategory = EXPERIENCE_CATEGORIES.map((category) => {
    const list = slots.filter((slot) => bySlug.get(slot.experienceSlug)?.category === category);
    const capacity = list.reduce((sum, slot) => sum + slot.capacity, 0);
    const taken = list.reduce((sum, slot) => sum + slot.booked, 0);
    return { category, ratio: capacity ? taken / capacity : 0, sessions: list.length };
  });

  const busiest = [...slots]
    .sort((a, b) => b.booked / b.capacity - a.booked / a.capacity || a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
        <li>
          <StatCard icon={Compass} label="Published experiences" value={experiences.length} hint="Live catalogue" />
        </li>
        <li>
          <StatCard icon={CalendarDays} label="Scheduled sessions" value={slots.length} hint={`Next ${windowDays} days`} />
        </li>
        <li>
          <StatCard
            icon={Gauge}
            label="Seat occupancy"
            value={seats ? `${Math.round((booked / seats) * 100)}%` : "—"}
            hint={`${booked} of ${seats} seats held`}
          />
        </li>
        <li>
          <StatCard icon={Ticket} label="Fully booked sessions" value={full} hint="Confirmed and pending seats" />
        </li>
      </ul>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Occupancy by category</CardTitle>
            <CardDescription>Share of seats held in the next {windowDays} days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {byCategory.map(({ category, ratio, sessions }) => (
                <li key={category}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{CATEGORY_LABELS[category]}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {Math.round(ratio * 100)}% · {sessions} sessions
                    </span>
                  </div>
                  <div aria-hidden="true" className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", occupancyTone(ratio))} style={{ width: `${ratio * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Busiest sessions</CardTitle>
            <CardDescription>Highest occupancy first.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {busiest.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{bySlug.get(slot.experienceSlug)?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(slot.startsAt)}, {formatTime(slot.startsAt)}
                    </p>
                  </div>
                  <OccupancyBar booked={slot.booked} capacity={slot.capacity} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- experiences */

type SortField = "title" | "price" | "duration" | "occupancy";
type Sort = { field: SortField; direction: "asc" | "desc" };

function SortHeader({
  field,
  sort,
  onSort,
  children,
  className,
}: {
  field: SortField;
  sort: Sort;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1.5 uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {children}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function ExperiencesTable({ experiences, slots }: ConsoleData) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExperienceCategory | "all">("all");
  const [sort, setSort] = useState<Sort>({ field: "title", direction: "asc" });

  const stats = useMemo(() => {
    const map = new Map<string, { sessions: number; booked: number; capacity: number }>();
    for (const slot of slots) {
      const current = map.get(slot.experienceSlug) ?? { sessions: 0, booked: 0, capacity: 0 };
      map.set(slot.experienceSlug, {
        sessions: current.sessions + 1,
        booked: current.booked + slot.booked,
        capacity: current.capacity + slot.capacity,
      });
    }
    return map;
  }, [slots]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const occupancy = (slug: string) => {
      const stat = stats.get(slug);
      return stat && stat.capacity ? stat.booked / stat.capacity : 0;
    };
    const compare: Record<SortField, (a: ExperienceSummary, b: ExperienceSummary) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      price: (a, b) => a.priceFromMinor - b.priceFromMinor,
      duration: (a, b) => a.durationMinutes - b.durationMinutes,
      occupancy: (a, b) => occupancy(a.slug) - occupancy(b.slug),
    };
    return experiences
      .filter((experience) => category === "all" || experience.category === category)
      .filter((experience) => !needle || `${experience.title} ${experience.location}`.toLowerCase().includes(needle))
      .sort((a, b) => compare[sort.field](a, b) * (sort.direction === "asc" ? 1 : -1));
  }, [experiences, stats, query, category, sort]);

  const onSort = (field: SortField) =>
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === "asc" ? "desc" : "asc",
    }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search experiences"
            placeholder="Search by title or location"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <NativeSelect
          aria-label="Filter by category"
          value={category}
          onChange={(event) => setCategory(event.target.value as ExperienceCategory | "all")}
          className="sm:w-56"
        >
          <option value="all">All categories</option>
          {EXPERIENCE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABELS[item]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No experiences found" description="Try another search or category.">
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Reset filters
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <Table>
            <caption className="sr-only">Experiences, sortable by column</caption>
            <TableHeader>
              <TableRow>
                <SortHeader field="title" sort={sort} onSort={onSort}>
                  Experience
                </SortHeader>
                <TableHead>Category</TableHead>
                <TableHead>Difficulty</TableHead>
                <SortHeader field="duration" sort={sort} onSort={onSort}>
                  Duration
                </SortHeader>
                <SortHeader field="price" sort={sort} onSort={onSort} className="text-right">
                  Price
                </SortHeader>
                <SortHeader field="occupancy" sort={sort} onSort={onSort}>
                  Occupancy
                </SortHeader>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((experience) => {
                const stat = stats.get(experience.slug);
                return (
                  <TableRow key={experience.slug}>
                    <TableCell>
                      <span className="block font-semibold">{experience.title}</span>
                      <span className="text-xs text-muted-foreground">{experience.location}</span>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={experience.category} className="border-border" />
                    </TableCell>
                    <TableCell>{formatDifficulty(experience.difficulty)}</TableCell>
                    <TableCell>{formatDuration(experience.durationMinutes)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatPrice(experience.priceFromMinor, experience.currency)}
                    </TableCell>
                    <TableCell>
                      {stat ? <OccupancyBar booked={stat.booked} capacity={stat.capacity} /> : "—"}
                      <span className="text-xs text-muted-foreground">{stat?.sessions ?? 0} sessions</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Published</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon-sm">
                          <Link href={experienceHref(experience.slug)}>
                            <ExternalLink />
                            <span className="sr-only">View {experience.title}</span>
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon-sm" disabled title="Editing arrives in a later phase">
                          <Pencil />
                          <span className="sr-only">Edit {experience.title} (not available yet)</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {rows.length} of {experiences.length} experiences. Editing arrives in a later phase.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- schedule */

const PAGE_SIZE = 12;
type SessionStatus = "all" | "open" | "nearly-full" | "full";

const sessionStatus = (slot: ExperienceSlot): Exclude<SessionStatus, "all"> => {
  const ratio = slot.booked / slot.capacity;
  if (ratio >= 1) return "full";
  if (ratio >= 0.8) return "nearly-full";
  return "open";
};

const STATUS_BADGE: Record<Exclude<SessionStatus, "all">, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-secondary text-secondary-foreground border-transparent" },
  "nearly-full": { label: "Nearly full", className: "border-gold-500/60 bg-gold-200/60 text-gold-700" },
  full: { label: "Full", className: "border-destructive/30 text-destructive" },
};

function ScheduleTable({ experiences, slots }: ConsoleData) {
  const [day, setDay] = useState("all");
  const [slug, setSlug] = useState("all");
  const [status, setStatus] = useState<SessionStatus>("all");
  const [page, setPage] = useState(0);

  const titles = useMemo(() => new Map(experiences.map((experience) => [experience.slug, experience.title])), [experiences]);
  const days = useMemo(() => [...new Set(slots.map((slot) => toDateKey(slot.startsAt)))].sort(), [slots]);
  const rows = useMemo(
    () =>
      slots
        .filter((slot) => day === "all" || toDateKey(slot.startsAt) === day)
        .filter((slot) => slug === "all" || slot.experienceSlug === slug)
        .filter((slot) => status === "all" || sessionStatus(slot) === status)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [slots, day, slug, status],
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="schedule-day">Date</Label>
          <NativeSelect id="schedule-day" value={day} onChange={(event) => filter(setDay)(event.target.value)}>
            <option value="all">All dates</option>
            {days.map((key) => (
              <option key={key} value={key}>
                {formatDateKey(key)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="schedule-experience">Experience</Label>
          <NativeSelect id="schedule-experience" value={slug} onChange={(event) => filter(setSlug)(event.target.value)}>
            <option value="all">All experiences</option>
            {experiences.map((experience) => (
              <option key={experience.slug} value={experience.slug}>
                {experience.title}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="schedule-status">Status</Label>
          <NativeSelect
            id="schedule-status"
            value={status}
            onChange={(event) => filter(setStatus)(event.target.value as SessionStatus)}
          >
            <option value="all">Any status</option>
            <option value="open">Open</option>
            <option value="nearly-full">Nearly full (80%+)</option>
            <option value="full">Full</option>
          </NativeSelect>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No sessions match" description="Try another date, experience or status." />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <Table>
              <caption className="sr-only">Scheduled sessions</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead className="text-right">Seats left</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((slot) => {
                  const badge = STATUS_BADGE[sessionStatus(slot)];
                  return (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">{formatDate(slot.startsAt)}</TableCell>
                      <TableCell>{formatTime(slot.startsAt)}</TableCell>
                      <TableCell className="font-semibold">{titles.get(slot.experienceSlug)}</TableCell>
                      <TableCell>
                        <OccupancyBar booked={slot.booked} capacity={slot.capacity} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{slot.capacity - slot.booked}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <nav aria-label="Schedule pages" className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length} sessions
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>
                <ChevronLeft />
                Previous
              </Button>
              <span className="text-sm tabular-nums">
                {current + 1} / {pages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
                Next
                <ChevronRight />
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- bookings */

function BookingsPanel({ bookings }: { bookings: BookingSummary[] }) {
  if (bookings.length === 0) {
    return <EmptyState icon={Inbox} title="No bookings yet" description="Reservations appear here as soon as they are recorded." />;
  }
  return (
    <div className="space-y-4">
      <BookingsTable bookings={bookings} showGuest detailHref={(booking) => bookingHref(booking.reference)} caption="All bookings" />
      <p className="text-xs text-muted-foreground">{bookings.length} bookings, latest session first (up to 200).</p>
    </div>
  );
}

/* ---------------------------------------------------------------- users */

function UsersPanel({ users, currentUserId }: { users: ManagedUser[]; currentUserId: string }) {
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest-700" aria-hidden="true" />
        New accounts always start as guests. Only administrators can change roles, never their own, and the last
        administrator can&apos;t be demoted. Every change is re-checked on the server.
      </p>
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <Table>
          <caption className="sr-only">User accounts and roles</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-semibold">
                  {user.displayName}
                  {user.id === currentUserId && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.canSignIn ? "secondary" : "outline"}>{user.canSignIn ? "Linked" : "No login"}</Badge>
                </TableCell>
                <TableCell>
                  <RoleControl user={user} isSelf={user.id === currentUserId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RoleControl({ user, isSelf }: { user: ManagedUser; isSelf: boolean }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message?: string } | null>(null);
  const id = `role-${user.id}`;

  return (
    <div className="flex min-w-64 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="sr-only">
          Role for {user.displayName}
        </Label>
        <NativeSelect
          id={id}
          value={role}
          disabled={isSelf || pending}
          onChange={(event) => {
            setRole(event.target.value as UserRole);
            setFeedback(null);
          }}
          className="w-36"
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="outline"
          disabled={isSelf || pending || role === user.role}
          onClick={() =>
            startTransition(async () => {
              const result = await changeUserRoleAction({ userId: user.id, role });
              setFeedback(result.ok ? { ok: true, message: `Now ${ROLE_LABELS[role].toLowerCase()}.` } : result);
              if (!result.ok) setRole(user.role);
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {isSelf && <p className="text-xs text-muted-foreground">You can&apos;t change your own role.</p>}
      {feedback && (
        <p role={feedback.ok ? "status" : "alert"} className={cn("text-xs", feedback.ok ? "text-forest-700" : "text-destructive")}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}
