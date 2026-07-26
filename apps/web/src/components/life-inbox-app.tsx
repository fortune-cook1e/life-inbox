"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Archive,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  FileText,
  Inbox,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Status = "needs-review" | "planned" | "done" | "ignored";
type ActionType = "Appointment" | "Deadline" | "Reminder";

type Draft = {
  type: ActionType;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  nextAction: string;
  evidence: string[];
  missingFields: string[];
};

type InboxItem = {
  id: string;
  source: string;
  language: string;
  receivedAt: string;
  createdLabel: string;
  status: Status;
  title: string;
  preview: string;
  draft: Draft;
};

const STATUS_META: Record<Status, { label: string; icon: typeof CircleAlert; className: string }> =
  {
    "needs-review": {
      label: "Needs review",
      icon: CircleAlert,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    planned: {
      label: "Planned",
      icon: CalendarDays,
      className: "border-blue-200 bg-blue-50 text-blue-800",
    },
    done: {
      label: "Done",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    ignored: {
      label: "Ignored",
      icon: Archive,
      className: "border-stone-200 bg-stone-100 text-stone-600",
    },
  };

const INITIAL_ITEMS: InboxItem[] = [
  {
    id: "inspection",
    source:
      "Hej! Vi kommer att genomföra den årliga lägenhetsbesiktningen tisdagen den 29 juli mellan kl. 10.00 och 12.00. Se till att någon är hemma eller lämna nyckeln till fastighetsskötaren. / Solna Boende",
    language: "Swedish",
    receivedAt: "2026-07-24",
    createdLabel: "Yesterday",
    status: "needs-review",
    title: "Apartment inspection",
    preview: "Inspection on July 29, 10:00–12:00",
    draft: {
      type: "Appointment",
      title: "Apartment inspection",
      date: "2026-07-29",
      startTime: "10:00",
      endTime: "12:00",
      location: "Home",
      nextAction: "Be at home or leave the key with the caretaker",
      evidence: [
        "tisdagen den 29 juli",
        "mellan kl. 10.00 och 12.00",
        "någon är hemma eller lämna nyckeln",
      ],
      missingFields: [],
    },
  },
  {
    id: "return",
    source:
      "Your return has been approved. Please hand the parcel to a PostNord service point no later than 30 July 2026. Keep your receipt until the refund is complete.",
    language: "English",
    receivedAt: "2026-07-23",
    createdLabel: "Wed",
    status: "planned",
    title: "Return parcel",
    preview: "Deadline on July 30",
    draft: {
      type: "Deadline",
      title: "Return parcel",
      date: "2026-07-30",
      startTime: "",
      endTime: "",
      location: "PostNord service point",
      nextAction: "Hand in the parcel and keep the receipt",
      evidence: ["no later than 30 July 2026", "PostNord service point", "Keep your receipt"],
      missingFields: [],
    },
  },
  {
    id: "dentist",
    source:
      "Reminder: Your dental appointment is booked for 21 July at 14:30 at Folktandvården Solna. Please arrive 10 minutes early.",
    language: "English",
    receivedAt: "2026-07-18",
    createdLabel: "18 Jul",
    status: "done",
    title: "Dental appointment",
    preview: "Completed on July 21",
    draft: {
      type: "Appointment",
      title: "Dental appointment",
      date: "2026-07-21",
      startTime: "14:30",
      endTime: "15:00",
      location: "Folktandvården Solna",
      nextAction: "Arrive 10 minutes early",
      evidence: ["21 July at 14:30", "Folktandvården Solna", "arrive 10 minutes early"],
      missingFields: [],
    },
  },
  {
    id: "subscription",
    source:
      "Your monthly streaming subscription will renew automatically next month. No action is needed if you want to continue.",
    language: "English",
    receivedAt: "2026-07-16",
    createdLabel: "16 Jul",
    status: "ignored",
    title: "Streaming renewal",
    preview: "No action required",
    draft: {
      type: "Reminder",
      title: "Review streaming subscription",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      nextAction: "No action required",
      evidence: ["No action is needed if you want to continue"],
      missingFields: ["date"],
    },
  },
];

const FILTERS: Array<{ value: Status | "all"; label: string; icon: typeof Inbox }> = [
  { value: "all", label: "All inbox", icon: Inbox },
  { value: "needs-review", label: "Needs review", icon: CircleAlert },
  { value: "planned", label: "Planned", icon: CalendarDays },
  { value: "done", label: "Done", icon: CheckCircle2 },
  { value: "ignored", label: "Ignored", icon: Archive },
];

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={meta.className}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}

function NavContent({
  activeFilter,
  counts,
  onFilterChange,
  onSettings,
}: {
  activeFilter: Status | "all";
  counts: Record<Status | "all", number>;
  onFilterChange: (value: Status | "all") => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Check className="size-4" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">LifeInbox</p>
          <p className="text-xs text-muted-foreground">Clear next steps</p>
        </div>
      </div>

      <nav className="space-y-1 px-3 py-4" aria-label="Inbox filters">
        {FILTERS.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => onFilterChange(filter.value)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span className="flex-1 text-left">{filter.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {counts[filter.value]}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <div className="mb-3 rounded-lg border bg-background/70 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            Local-first workspace
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            AI suggestions stay drafts until you confirm them.
          </p>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={onSettings}>
          <Settings className="size-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}

export function LifeInboxApp() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [activeFilter, setActiveFilter] = useState<Status | "all">("all");
  const [selectedId, setSelectedId] = useState("inspection");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [noticeLanguage, setNoticeLanguage] = useState("Auto-detect");
  const [referenceDate, setReferenceDate] = useState("2026-07-25");

  const counts = useMemo(() => {
    const result: Record<Status | "all", number> = {
      all: items.length,
      "needs-review": 0,
      planned: 0,
      done: 0,
      ignored: 0,
    };
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = activeFilter === "all" || item.status === activeFilter;
      const matchesQuery =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.source.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, items, query]);

  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0];

  function updateSelected(updater: (item: InboxItem) => InboxItem) {
    if (!selectedItem) return;
    setItems((current) =>
      current.map((item) => (item.id === selectedItem.id ? updater(item) : item)),
    );
  }

  function updateDraft(field: keyof Draft, value: string) {
    updateSelected((item) => ({
      ...item,
      title: field === "title" ? value : item.title,
      draft: {
        ...item.draft,
        [field]: value,
        missingFields:
          field === "date" && value
            ? item.draft.missingFields.filter((missingField) => missingField !== "date")
            : item.draft.missingFields,
      },
    }));
  }

  function changeFilter(value: Status | "all") {
    setActiveFilter(value);
    const firstMatch = items.find((item) => value === "all" || item.status === value);
    if (firstMatch) setSelectedId(firstMatch.id);
  }

  function changeStatus(status: Status) {
    updateSelected((item) => ({ ...item, status }));
    toast.success(
      status === "planned"
        ? "Action confirmed and ready for calendar export."
        : `Action marked ${STATUS_META[status].label.toLowerCase()}.`,
    );
  }

  function addNotice() {
    if (!noticeText.trim()) {
      toast.error("Paste a notice before continuing.");
      return;
    }

    const isDuplicate = items.some((item) => item.source.trim() === noticeText.trim());
    const id = `notice-${Date.now()}`;
    const newItem: InboxItem = {
      id,
      source: noticeText.trim(),
      language: noticeLanguage,
      receivedAt: referenceDate,
      createdLabel: "Now",
      status: "needs-review",
      title: "New notice",
      preview: "Review the extracted action draft",
      draft: {
        type: "Reminder",
        title: "Review new notice",
        date: "",
        startTime: "",
        endTime: "",
        location: "",
        nextAction: "Review the source and complete the missing date",
        evidence: [noticeText.trim().slice(0, 96)],
        missingFields: ["date"],
      },
    };

    setItems((current) => [newItem, ...current]);
    setSelectedId(id);
    setActiveFilter("all");
    setNoticeText("");
    setComposerOpen(false);
    if (isDuplicate) {
      toast.warning("Notice saved, but identical source text already exists in your inbox.");
    } else {
      toast.success("Notice saved. The action draft needs your review.");
    }
  }

  function exportCalendar() {
    if (!selectedItem) return;
    const { draft } = selectedItem;
    const compactDate = draft.date.replaceAll("-", "");
    const hasTime = Boolean(draft.startTime);
    const nextDate = new Date(`${draft.date}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const compactNextDate = nextDate.toISOString().slice(0, 10).replaceAll("-", "");
    const start = hasTime
      ? `${compactDate}T${draft.startTime.replace(":", "")}00`
      : `VALUE=DATE:${compactDate}`;
    const end = hasTime
      ? `${compactDate}T${(draft.endTime || draft.startTime).replace(":", "")}00`
      : `VALUE=DATE:${compactNextDate}`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LifeInbox//EN",
      "BEGIN:VEVENT",
      `UID:${selectedItem.id}@lifeinbox.local`,
      hasTime ? `DTSTART;TZID=Europe/Stockholm:${start}` : `DTSTART;${start}`,
      hasTime ? `DTEND;TZID=Europe/Stockholm:${end}` : `DTEND;${end}`,
      `SUMMARY:${draft.title}`,
      `LOCATION:${draft.location}`,
      `DESCRIPTION:${draft.nextAction}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar file downloaded. Import it into Apple Calendar to finish.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Check className="size-4" />
          </div>
          <span className="font-semibold">LifeInbox</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" />
            <span className="sr-only">Open settings</span>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost">
                <Menu className="size-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <NavContent
                activeFilter={activeFilter}
                counts={counts}
                onFilterChange={changeFilter}
                onSettings={() => setSettingsOpen(true)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] lg:min-h-screen lg:grid-cols-[240px_320px_minmax(0,1fr)]">
        <aside className="hidden border-r bg-sidebar lg:block">
          <NavContent
            activeFilter={activeFilter}
            counts={counts}
            onFilterChange={changeFilter}
            onSettings={() => setSettingsOpen(true)}
          />
        </aside>

        <section className="border-r bg-muted/20">
          <div className="border-b bg-background p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {activeFilter === "all"
                    ? "Inbox"
                    : FILTERS.find((filter) => filter.value === activeFilter)?.label}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {counts[activeFilter]} {counts[activeFilter] === 1 ? "notice" : "notices"}
                </p>
              </div>
              <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="size-4" />
                    Add notice
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Add a life notice</DialogTitle>
                    <DialogDescription>
                      Paste the complete source. LifeInbox keeps it unchanged and creates a draft
                      for you to review.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="notice">Original notice</Label>
                      <Textarea
                        id="notice"
                        value={noticeText}
                        onChange={(event) => setNoticeText(event.target.value)}
                        placeholder="Paste an email, SMS, letter, or other notice…"
                        className="min-h-44 resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        The original text stays immutable after saving.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="language">Source language</Label>
                        <Select value={noticeLanguage} onValueChange={setNoticeLanguage}>
                          <SelectTrigger id="language" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Auto-detect">Auto-detect</SelectItem>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Swedish">Swedish</SelectItem>
                            <SelectItem value="Chinese">Chinese</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reference-date">Notice received date</Label>
                        <Input
                          id="reference-date"
                          type="date"
                          value={referenceDate}
                          onChange={(event) => setReferenceDate(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setComposerOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addNotice}>
                      <Sparkles className="size-4" />
                      Save and extract
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a notice…"
                className="bg-muted/40 pl-9"
              />
            </div>
          </div>

          <div className="divide-y">
            {filteredItems.length ? (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full px-4 py-4 text-left transition-colors hover:bg-background ${
                    selectedItem?.id === item.id
                      ? "bg-background shadow-[inset_3px_0_0_var(--primary)]"
                      : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-muted-foreground">{item.createdLabel}</span>
                  </div>
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {item.preview}
                  </p>
                </button>
              ))
            ) : (
              <div className="px-6 py-16 text-center">
                <Inbox className="mx-auto mb-3 size-7 text-muted-foreground/60" />
                <p className="text-sm font-medium">No matching notices</p>
                <p className="mt-1 text-xs text-muted-foreground">Try another filter or search.</p>
              </div>
            )}
          </div>
        </section>

        <main className="min-w-0 bg-background">
          {selectedItem ? (
            <div>
              <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b bg-background/95 px-5 py-3 backdrop-blur md:px-7">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{selectedItem.title}</h2>
                    <StatusBadge status={selectedItem.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Added {selectedItem.createdLabel} · {selectedItem.language}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => changeStatus("done")}>
                      <CheckCircle2 className="size-4" />
                      Mark done
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeStatus("ignored")}>
                      <Archive className="size-4" />
                      Ignore notice
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => toast.info("History will appear after the API is connected.")}
                    >
                      <Clock3 className="size-4" />
                      View history
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mx-auto max-w-4xl space-y-6 p-5 md:p-7 lg:p-8">
                <section aria-labelledby="source-heading">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 id="source-heading" className="text-sm font-semibold">
                        Original notice
                      </h3>
                      <p className="text-xs text-muted-foreground">Preserved exactly as received</p>
                    </div>
                    <Badge variant="outline" className="font-normal">
                      <FileText className="size-3" />
                      Pasted text
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-7 text-foreground/90">
                    {selectedItem.source}
                  </div>
                </section>

                <Separator />

                <section aria-labelledby="draft-heading">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <h3 id="draft-heading" className="text-sm font-semibold">
                          Action draft
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Suggested by AI · Nothing is confirmed until you approve it
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toast.info("A new extraction attempt has been queued.")}
                        >
                          <RefreshCw className="size-3.5" />
                          Retry
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Create a new extraction attempt</TooltipContent>
                    </Tooltip>
                  </div>

                  {selectedItem.draft.missingFields.length > 0 && (
                    <Alert className="mb-4 border-amber-200 bg-amber-50/70">
                      <CircleAlert className="text-amber-700" />
                      <AlertTitle>More information needed</AlertTitle>
                      <AlertDescription>
                        Add the missing {selectedItem.draft.missingFields.join(", ")} before
                        confirming this action.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="draft-title">Title</Label>
                      <Input
                        id="draft-title"
                        value={selectedItem.draft.title}
                        onChange={(event) => updateDraft("title", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="action-type">Action type</Label>
                      <Select
                        value={selectedItem.draft.type}
                        onValueChange={(value) => updateDraft("type", value)}
                      >
                        <SelectTrigger id="action-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Appointment">Appointment</SelectItem>
                          <SelectItem value="Deadline">Deadline</SelectItem>
                          <SelectItem value="Reminder">Reminder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={selectedItem.draft.date}
                        onChange={(event) => updateDraft("date", event.target.value)}
                      />
                    </div>
                    {selectedItem.draft.type === "Appointment" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="start-time">Starts</Label>
                          <Input
                            id="start-time"
                            type="time"
                            value={selectedItem.draft.startTime}
                            onChange={(event) => updateDraft("startTime", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-time">Ends</Label>
                          <Input
                            id="end-time"
                            type="time"
                            value={selectedItem.draft.endTime}
                            onChange={(event) => updateDraft("endTime", event.target.value)}
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="location">Location</Label>
                      <div className="relative">
                        <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="location"
                          className="pl-9"
                          value={selectedItem.draft.location}
                          onChange={(event) => updateDraft("location", event.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="next-action">Next action</Label>
                      <Textarea
                        id="next-action"
                        value={selectedItem.draft.nextAction}
                        onChange={(event) => updateDraft("nextAction", event.target.value)}
                        className="min-h-20 resize-none"
                      />
                    </div>
                  </div>

                  <Card className="mt-5 gap-3 border-dashed bg-muted/20 py-4 shadow-none">
                    <CardHeader className="px-4">
                      <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Source evidence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-4">
                      {selectedItem.draft.evidence.map((evidence) => (
                        <div key={evidence} className="flex gap-2 text-sm">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                          <q className="text-foreground/80">{evidence}</q>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => changeStatus("ignored")}>
                      <X className="size-4" />
                      Ignore
                    </Button>
                    <Button
                      onClick={() => changeStatus("planned")}
                      disabled={!selectedItem.draft.date}
                    >
                      <Check className="size-4" />
                      Confirm action
                    </Button>
                  </div>
                </section>

                <Separator />

                <section aria-labelledby="calendar-heading">
                  <div className="mb-4">
                    <h3 id="calendar-heading" className="text-sm font-semibold">
                      Apple Calendar preview
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Export is always a separate action under your control.
                    </p>
                  </div>
                  <Card className="overflow-hidden py-0 shadow-none">
                    <div className="grid sm:grid-cols-[120px_1fr]">
                      <div className="grid place-items-center border-b bg-primary px-4 py-6 text-primary-foreground sm:border-r sm:border-b-0">
                        <div className="text-center">
                          <p className="text-xs font-medium uppercase opacity-80">
                            {selectedItem.draft.date
                              ? new Date(`${selectedItem.draft.date}T12:00:00`).toLocaleDateString(
                                  "en",
                                  { month: "short" },
                                )
                              : "Date"}
                          </p>
                          <p className="text-3xl font-semibold">
                            {selectedItem.draft.date
                              ? new Date(`${selectedItem.draft.date}T12:00:00`).getDate()
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="p-5">
                        <p className="font-semibold">{selectedItem.draft.title}</p>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          <p className="flex items-center gap-2">
                            <Clock3 className="size-4" />
                            {selectedItem.draft.startTime
                              ? `${selectedItem.draft.startTime}–${selectedItem.draft.endTime || "—"}`
                              : "All-day"}
                            <span>· Europe/Stockholm</span>
                          </p>
                          {selectedItem.draft.location && (
                            <p className="flex items-center gap-2">
                              <MapPin className="size-4" />
                              {selectedItem.draft.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                      LifeInbox can confirm that this file was generated, but not whether you
                      imported it into Apple Calendar.
                    </p>
                    <Button
                      variant="outline"
                      onClick={exportCalendar}
                      disabled={
                        !selectedItem.draft.date ||
                        selectedItem.status === "needs-review" ||
                        selectedItem.status === "ignored"
                      }
                      className="shrink-0"
                    >
                      <Download className="size-4" />
                      Export .ics
                    </Button>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="grid min-h-screen place-items-center p-8 text-center">
              <div>
                <Inbox className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Select a notice</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an item from the inbox to review it.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Defaults applied to new action drafts.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            <div className="space-y-2">
              <Label>Default time zone</Label>
              <Select defaultValue="Europe/Stockholm">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Stockholm">Europe/Stockholm</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default appointment duration</Label>
              <Select defaultValue="60">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default reminder</Label>
              <Select defaultValue="30">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reminder</SelectItem>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Summary and question language</Label>
              <Select defaultValue="English">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Swedish">Swedish</SelectItem>
                  <SelectItem value="Chinese">Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Privacy</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                V1 is local-first. Full notice text should never appear in application logs.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setSettingsOpen(false);
                toast.success("Settings saved.");
              }}
            >
              Save settings
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
