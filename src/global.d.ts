export {};

import type { AnimationId } from './animationRegistry';

declare global {
  interface Window {
    petAPI: {
      getSettings: () => Promise<PetSettings>;
      setSettings: (settings: Partial<PetSettings>) => Promise<PetSettings>;
      getWindowBounds: () => Promise<WindowBounds>;
      setWindowPosition: (point: WindowPoint) => Promise<void>;
      setWindowSize: (size: WindowSize) => Promise<void>;
      saveWindowBounds: () => Promise<WindowBounds | undefined>;
      notify: (payload: NotificationPayload) => Promise<void>;
      listUpcomingCalendarEvents: () => Promise<CalendarEvent[]>;
      getPermissionStatus: () => Promise<PermissionStatusSummary>;
      testNotification: () => Promise<PermissionActionResult>;
      requestCalendarAccess: () => Promise<PermissionActionResult>;
      openSystemSettings: (target: SystemSettingsTarget) => Promise<PermissionActionResult>;
      openContextMenu: () => Promise<void>;
      onToggleSettings: (callback: () => void) => () => void;
      onPlayAnimation: (callback: (_event: unknown, animationId: AnimationId) => void) => () => void;
      getAgentStatus: () => Promise<AgentStatus | null>;
      openAgentSession: () => Promise<PermissionActionResult>;
      onAgentStatusUpdate: (callback: (_event: unknown, status: AgentStatus | null) => void) => () => void;
    };
  }
}

export interface PetSettings {
  waterIntervalMinutes: number;
  restIntervalMinutes: number;
  calendarLeadMinutes: number;
  dailyActionsEnabled: boolean;
  calendarEnabled: boolean;
  openAtLogin: boolean;
  onboardingDismissed: boolean;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowPoint {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface NotificationPayload {
  title: string;
  body: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  calendarName: string;
  category: CalendarCategory;
}

export interface PermissionActionResult {
  ok: boolean;
  message: string;
}

export interface PermissionStatusSummary {
  platform: string;
  packaged: boolean;
  notifications: NotificationAuthorizationStatus;
  calendar: PermissionActionResult;
}

export type NotificationAuthorizationStatus =
  | 'unsupported'
  | 'supported'
  | 'notDetermined'
  | 'denied'
  | 'authorized'
  | 'provisional'
  | 'ephemeral'
  | 'unknown';

export type SystemSettingsTarget = 'notifications' | 'automation';

export interface AgentStatus {
  source: 'codex' | 'claude-desktop' | 'claude-code' | 'hermes' | 'unknown';
  state: 'idle' | 'running' | 'needs_confirmation' | 'done' | 'error';
  title: string;
  detail?: string;
  updatedAt: number;
  sessionPath?: string;
  sessionUrl?: string;
}

export type CalendarCategory =
  | 'interview'
  | 'deadline'
  | 'meeting'
  | 'travel'
  | 'meal'
  | 'celebration'
  | 'stage'
  | 'general'
  | 'unknown';
