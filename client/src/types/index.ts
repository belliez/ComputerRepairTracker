import {
  repairStatuses,
  type Customer,
  type Device,
  type InventoryItem,
  type Invoice,
  type Quote,
  type Repair,
  type RepairItem,
  type Technician,
} from "@shared/schema";

// Re-export repairStatuses for use in components
export { repairStatuses };

// Re-export the types
export type { Customer, Device, InventoryItem, Invoice, Quote, Repair, RepairItem, Technician };

// Status type definitions for UI
export type RepairStatus = typeof repairStatuses[number];

export interface StatusConfig {
  label: string;
  color: "yellow" | "blue" | "green" | "purple" | "orange" | "red" | "gray";
  icon: string;
}

export const statusConfigs: Record<RepairStatus, StatusConfig> = {
  intake: {
    label: "Intake",
    color: "yellow",
    icon: "clipboard-list",
  },
  diagnosing: {
    label: "Diagnosing",
    color: "yellow",
    icon: "search",
  },
  awaiting_approval: {
    label: "Waiting for Approval",
    color: "purple",
    icon: "clock",
  },
  parts_ordered: {
    label: "Parts Ordered",
    color: "blue",
    icon: "package",
  },
  in_repair: {
    label: "In Repair",
    color: "orange",
    icon: "tool",
  },
  ready_for_pickup: {
    label: "Ready for Pickup",
    color: "green",
    icon: "check-circle",
  },
  completed: {
    label: "Completed",
    color: "gray",
    icon: "check",
  },
  on_hold: {
    label: "On Hold",
    color: "red",
    icon: "pause",
  },
  cancelled: {
    label: "Cancelled",
    color: "red",
    icon: "x-circle",
  },
};

// Extended types with relations for UI
export interface RepairWithRelations extends Repair {
  customer: Customer;
  device: Device;
  technician?: Technician;
  items?: (RepairItem & { inventoryItem?: InventoryItem })[];
  quote?: Quote;
  quotes?: Quote[];
  invoice?: Invoice;
}

// Navigation item type
export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

// User role for conditional rendering
export type UserRole = "technician" | "manager" | "frontdesk";

// Type for active tab in repairs page
export type RepairTab = "all" | RepairStatus;
