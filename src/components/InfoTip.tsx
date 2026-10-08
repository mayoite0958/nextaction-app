import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HELP, type HelpKey } from "@/lib/help";

/** Small ⓘ button that explains a field in plain words, with an example. Works with tap. */
export function InfoTip({ k, text }: { k?: HelpKey; text?: { what: string; example?: string } }) {
  const h = text ?? (k ? HELP[k] : undefined);
  if (!h) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="What is this?"
          onClick={(e) => e.stopPropagation()}
          className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-primary focus-visible:text-primary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" collisionPadding={12} className="w-[min(18rem,calc(100vw-2rem))] text-sm leading-relaxed">
        <p>{h.what}</p>
        {h.example && <p className="mt-1 text-muted-foreground">Example: {h.example}</p>}
      </PopoverContent>
    </Popover>
  );
}

/** A field label followed by its ⓘ. */
export function HelpLabel({ k, children, className }: { k: HelpKey; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      <span>{children}</span>
      <InfoTip k={k} />
    </span>
  );
}
