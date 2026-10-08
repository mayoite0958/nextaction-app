import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromYmd = (s: string) => (s ? new Date(`${s}T12:00:00`) : undefined);

/** Value is a local "YYYY-MM-DD" string (or ""). */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  noFuture,
  clearable,
  className,
  size = "default",
}: {
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  noFuture?: boolean;
  clearable?: boolean;
  className?: string;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const selected = fromYmd(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn("justify-start gap-2 text-left font-normal", !selected && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{selected ? format(selected, "d MMM yyyy") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => { if (d) { onChange(toYmd(d)); setOpen(false); } }}
          disabled={noFuture ? { after: today } : undefined}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {clearable && value && (
          <div className="border-t border-border p-2">
            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => { onChange(""); setOpen(false); }}>
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
