import type { Priority } from "@/lib/derm/types";

const styles: Record<Priority, string> = {
  Urgent: "bg-[var(--urgent-soft)] text-[var(--urgent)]",
  High: "bg-[var(--high-soft)] text-[var(--high)]",
  Moderate: "bg-[var(--moderate-soft)] text-[var(--moderate)]",
  Routine: "bg-[var(--routine-soft)] text-[var(--routine)]",
};

const dots: Record<Priority, string> = {
  Urgent: "bg-[var(--urgent)]",
  High: "bg-[var(--high)]",
  Moderate: "bg-[var(--moderate)]",
  Routine: "bg-[var(--routine)]",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`chip ${styles[priority]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[priority]}`} />
      {priority}
    </span>
  );
}
