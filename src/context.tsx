import { createContext, useContext } from "react";
import { type State, type Entity, type Kind, type Tab } from "./types";
export interface Workspace {
  state: State;
  now: Date;
  refresh: () => Promise<void>;
  edit: (kind: Kind, record?: Entity) => void;
  remove: (r: Entity) => void;
  toggle: (r: Entity) => Promise<void>;
  notify: (message: string) => void;
  go: (tab: Tab) => void;
  ask: (text: string) => void;
  action: (id: string, op: string) => Promise<void>;
  update: (r: Entity, patch: Record<string, any>) => Promise<void>;
}
export const WorkspaceContext = createContext<Workspace | null>(null);
export const useWorkspace = () => useContext(WorkspaceContext)!;
