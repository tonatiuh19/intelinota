import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Send,
  Undo2,
  XCircle,
  FilePenLine,
  Inbox,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  markAllNotificationsRead,
  markNotificationRead,
  selectNotifications,
  selectUnreadCount,
} from "@/store/slices/notificationsSlice";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminNotification, AdminNotificationType } from "@shared/api";

const ICONS: Record<AdminNotificationType, typeof Bell> = {
  "review.submitted": Send,
  "review.approved": CheckCircle2,
  "review.published": CheckCircle2,
  "review.returned": Undo2,
  "revision.submitted": FilePenLine,
  "revision.approved": CheckCircle2,
  "revision.rejected": XCircle,
};

const TONE: Partial<Record<AdminNotificationType, string>> = {
  "review.approved": "text-emerald-500",
  "review.published": "text-emerald-500",
  "revision.approved": "text-emerald-500",
  "review.returned": "text-amber-500",
  "revision.rejected": "text-destructive",
};

/** Header bell: unread badge + latest notifications (popover, full-width on phones). */
export default function NotificationBell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectNotifications);
  const unread = useAppSelector(selectUnreadCount);
  const [open, setOpen] = useState(false);

  const openItem = (n: AdminNotification) => {
    if (!n.read_at) dispatch(markNotificationRead(n.id));
    setOpen(false);
    if (!n.link) return;
    // Public article links leave the admin shell
    if (n.link.startsWith("/admin")) navigate(n.link);
    else window.open(n.link, "_blank", "noopener");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10"
          aria-label={unread ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background animate-in zoom-in-50">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-1rem)] sm:w-96 max-w-[calc(100vw-1rem)] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <p className="text-sm font-semibold">Notificaciones</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 gap-1.5 text-xs"
            disabled={unread === 0}
            onClick={() => dispatch(markAllNotificationsRead())}
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todo leído
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-50" />
            Sin notificaciones por ahora.
          </div>
        ) : (
          <ScrollArea className="max-h-[min(70vh,28rem)]">
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn(
                        "flex w-full min-h-10 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
                        !n.read_at && "bg-brand/5",
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", TONE[n.type] ?? "text-brand")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm leading-snug", !n.read_at && "font-semibold")}>
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                            {n.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">
                          {formatRelative(n.created_at)}
                        </span>
                      </span>
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand" aria-label="Sin leer" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
