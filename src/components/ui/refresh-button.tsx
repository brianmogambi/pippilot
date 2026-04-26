import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
  onClick: () => void;
  isPending?: boolean;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  title?: string;
}

export function RefreshButton({
  onClick,
  isPending = false,
  label,
  className,
  variant = "outline",
  title = "Refresh market data",
}: RefreshButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={isPending}
      size="sm"
      variant={variant}
      title={title}
      aria-label={title}
      className={cn("h-8 gap-1.5 text-xs", className)}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
      {label && <span>{isPending ? "Refreshing…" : label}</span>}
    </Button>
  );
}
