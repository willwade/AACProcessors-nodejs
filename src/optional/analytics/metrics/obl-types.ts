/**
 * .obl (Open Board Logging) File Format Types
 *
 * Based on the .obl specification for AAC logging.
 */

export interface OblAction {
  action: string;
  destination_board_id?: string;
  text?: string;
  modification_type?: string;
  [key: string]: any; // Support for extensions
}

export interface OblEventBase {
  id: string;
  timestamp: string; // ISO 8601
  type: "button" | "action" | "utterance" | "note" | "other" | string;
  locale?: string;
  geo?: [number, number, number?]; // lat, long, alt
  location_id?: string;
  modeling?: boolean;
  system?: string;
  window_width?: number;
  window_height?: number;
  percent_x?: number;
  percent_y?: number;
  [key: string]: any; // Support for extensions
}

export interface OblButtonEvent extends OblEventBase {
  type: "button";
  label: string;
  spoken: boolean;
  button_id?: string;
  board_id?: string;
  vocalization?: string;
  image_url?: string;
  actions?: OblAction[];
}

export interface OblActionEvent extends OblEventBase {
  type: "action";
  action: string;
  destination_board_id?: string;
  text?: string;
  modification_type?: string;
}

export interface OblUtteranceEvent extends OblEventBase {
  type: "utterance";
  text: string;
  buttons?: Array<{
    id?: string;
    label?: string;
    board_id?: string;
    vocalization?: string;
    action?: string;
    text?: string;
  }>;
}

export interface OblNoteEvent extends OblEventBase {
  type: "note";
  text: string;
  author_name?: string;
  author_email?: string;
  author_url?: string;
}

export type OblEvent =
  | OblButtonEvent
  | OblActionEvent
  | OblUtteranceEvent
  | OblNoteEvent
  | OblEventBase;

export interface OblSession {
  id: string;
  type: "log" | string;
  started: string; // ISO 8601
  ended: string; // ISO 8601
  device_id?: string;
  locale?: string;
  anonymizations?: string[];
  events: OblEvent[];
  [key: string]: any; // Support for extensions
}

export interface OblFile {
  format: "open-board-log-0.1" | string;
  user_id: string;
  user_name?: string;
  source?: string;
  locale?: string;
  anonymized?: boolean;
  license?: {
    type: string;
    copyright_notice_url?: string;
    source_url?: string;
    author_name?: string;
    author_url?: string;
    author_email?: string;
  };
  sessions: OblSession[];
  [key: string]: any; // Support for extensions
}
