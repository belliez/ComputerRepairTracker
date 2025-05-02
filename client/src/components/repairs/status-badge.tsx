import { cn } from "@/lib/utils";
import { StatusConfig, RepairStatus, statusConfigs } from "@/types";

interface StatusBadgeProps {
  status: RepairStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig: StatusConfig = statusConfigs[status] || {
    label: "Unknown",
    color: "gray",
    icon: "question"
  };

  const colors = {
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    purple: "bg-purple-100 text-purple-800",
    orange: "bg-orange-100 text-orange-800",
    red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-800"
  };

  return (
    <span className={cn(
      "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
      colors[statusConfig.color],
      className
    )}>
      {statusConfig.label}
    </span>
  );
}
