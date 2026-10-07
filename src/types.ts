export type Kind =
  | "tasks"
  | "events"
  | "people"
  | "bills"
  | "documents"
  | "routines"
  | "preferences"
  | "bookings"
  | "automations"
  | "journal"
  | "trips";
export type Tab = "Today" | "Plan" | "Ask" | "Discover" | "Life";
export interface Entity {
  id: string;
  kind: Kind;
  data: Record<string, any>;
  revision: number;
  createdAt: string;
  updatedAt: string;
  provenance: string;
  syncState: string;
}
export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  autonomy: "observe" | "suggest" | "approval" | "autopilot";
  memoryEnabled: boolean;
}
export interface Action {
  id: string;
  tool: string;
  input: Record<string, any>;
  status: string;
  result: { record?: Entity; records?: Entity[] } | null;
  error: string | null;
  createdAt: string;
}
export interface Message {
  id: string;
  role: string;
  text: string;
  createdAt: string;
}
export interface State {
  user: User;
  records: Entity[];
  actions: Action[];
  messages: Message[];
  conflicts: {
    id: string;
    first: string;
    second: string;
    title: string;
    travelBuffer: boolean;
  }[];
  aiAvailable: boolean;
  aiConfigured: boolean;
  aiBlockedReason: string | null;
  sync: { state: string; lastRead: string };
}
