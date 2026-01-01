import {
  OblFile,
  OblSession,
  OblEvent,
  OblButtonEvent,
  OblUtteranceEvent,
  OblActionEvent,
  OblNoteEvent,
} from './obl-types';
import { HistoryEntry, HistoryOccurrence } from '../history';
import { AACSemanticIntent, AACSemanticCategory } from '../../../core/treeStructure';

/**
 * .obl (Open Board Logging) Utility
 *
 * Provides parsing and generation support for the .obl format.
 */
export class OblUtil {
  /**
   * Parse an OBL JSON string.
   * Handles the optional /* notice * / at the start of the file.
   */
  static parse(json: string): OblFile {
    // Remove potential comment at the start
    let cleanJson = json.trim();
    if (cleanJson.startsWith('/*')) {
      const endComment = cleanJson.indexOf('*/');
      if (endComment !== -1) {
        cleanJson = cleanJson.substring(endComment + 2).trim();
      }
    }
    return JSON.parse(cleanJson) as OblFile;
  }

  /**
   * Stringify an OBL file object.
   * Optionally adds the recommended notice comment.
   */
  static stringify(obl: OblFile, includeNotice = true): string {
    const json = JSON.stringify(obl, null, 2);
    if (includeNotice) {
      return `/* NOTICE: The following information represents an individual's communication and should be treated respectfully and securely. */\n${json}`;
    }
    return json;
  }

  /**
   * Convert an OBL file to internal HistoryEntry format.
   */
  static toHistoryEntries(obl: OblFile): HistoryEntry[] {
    const entries: HistoryEntry[] = [];
    const source = obl.source || 'OBL';

    // OBL is session-based and event-based.
    // HistoryEntry is content-based with occurrences.
    // We'll group events by content (label/text) to match HistoryEntry structure.
    const contentMap = new Map<string, HistoryOccurrence[]>();

    for (const session of obl.sessions) {
      for (const event of session.events) {
        let content = '';
        const evtAny = event as any;
        const occurrence: HistoryOccurrence = {
          timestamp: new Date(event.timestamp),
          modeling: event.modeling,
          pageId: evtAny.board_id || null,
          latitude: event.geo?.[0] || null,
          longitude: event.geo?.[1] || null,
          type: event.type as HistoryOccurrence['type'],
          // Store all other OBL fields in the occurrence
          buttonId: evtAny.button_id || null,
          boardId: evtAny.board_id || null,
          spoken: evtAny.spoken,
          vocalization: evtAny.vocalization,
          imageUrl: evtAny.image_url,
          actions: evtAny.actions,
        };

        if (event.type === 'button') {
          const btn = event as OblButtonEvent;
          content = btn.vocalization || btn.label;
        } else if (event.type === 'utterance') {
          const utt = event as OblUtteranceEvent;
          content = utt.text;
        } else if (event.type === 'action') {
          const act = event as OblActionEvent;
          content = act.action;
        } else if (event.type === 'note') {
          const note = event as OblNoteEvent;
          content = note.text;
        } else {
          const evtAny = event as any;
          content = evtAny.label || evtAny.text || evtAny.action || 'unknown';
        }

        const occurrences = contentMap.get(content) || [];
        occurrences.push(occurrence);
        contentMap.set(content, occurrences);
      }
    }

    contentMap.forEach((occurrences, content) => {
      entries.push({
        id: `obl:${content}`,
        source: source,
        content: content,
        occurrences: occurrences.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      });
    });

    return entries;
  }

  /**
   * Convert HistoryEntries to an OBL file object.
   */
  static fromHistoryEntries(entries: HistoryEntry[], userId: string, source?: string): OblFile {
    const events: OblEvent[] = [];

    for (const entry of entries) {
      for (const occ of entry.occurrences) {
        const timestamp = occ.timestamp.toISOString();
        const intent = occ.intent as string;

        let oblType: OblEvent['type'] = occ.type || 'button';
        let actionStr: string | undefined = undefined;

        // Smart mapping based on AACSemanticIntent
        if (intent === (AACSemanticIntent.CLEAR_TEXT as string)) {
          oblType = 'action';
          actionStr = ':clear';
        } else if (intent === (AACSemanticIntent.GO_HOME as string)) {
          oblType = 'action';
          actionStr = ':home';
        } else if (intent === (AACSemanticIntent.NAVIGATE_TO as string)) {
          oblType = 'action';
          actionStr = ':open_board';
        } else if (intent === (AACSemanticIntent.GO_BACK as string)) {
          oblType = 'action';
          actionStr = ':back';
        } else if (intent === (AACSemanticIntent.DELETE_CHARACTER as string)) {
          oblType = 'action';
          actionStr = ':backspace';
        } else if (
          intent === (AACSemanticIntent.SPEAK_IMMEDIATE as string) ||
          intent === (AACSemanticIntent.SPEAK_TEXT as string)
        ) {
          // Speak could be a button or an utterance or an action
          if (oblType !== 'utterance' && oblType !== 'button') {
            oblType = 'action';
            actionStr = ':speak';
          }
        }

        const common: any = {
          id: Math.random().toString(36).substring(2, 11),
          timestamp,
          modeling: occ.modeling,
          type: oblType,
        };

        if (
          occ.latitude !== null &&
          occ.latitude !== undefined &&
          occ.longitude !== null &&
          occ.longitude !== undefined
        ) {
          common.geo = [occ.latitude, occ.longitude];
        }

        if (oblType === 'utterance') {
          events.push({
            ...common,
            text: entry.content,
          } as OblUtteranceEvent);
        } else if (oblType === 'action') {
          events.push({
            ...common,
            action: actionStr || entry.content,
            destination_board_id: occ.boardId || undefined,
            text: intent === (AACSemanticIntent.SPEAK_TEXT as string) ? entry.content : undefined,
          } as OblActionEvent);
        } else if (oblType === 'note') {
          events.push({
            ...common,
            text: entry.content,
          } as OblNoteEvent);
        } else {
          // Default to button
          events.push({
            ...common,
            type: 'button',
            label: occ.vocalization ? entry.content : entry.content,
            spoken:
              occ.spoken ??
              (occ.category as string) === (AACSemanticCategory.COMMUNICATION as string),
            button_id: occ.buttonId || undefined,
            board_id: occ.boardId || occ.pageId || undefined,
            vocalization: occ.vocalization || undefined,
            image_url: occ.imageUrl || undefined,
            actions: occ.actions || undefined,
          } as OblButtonEvent);
        }
      }
    }

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const started = events.length > 0 ? events[0].timestamp : new Date().toISOString();
    const ended =
      events.length > 0 ? events[events.length - 1].timestamp : new Date().toISOString();

    const session: OblSession = {
      id: 'session-1',
      type: 'log',
      started,
      ended,
      events,
    };

    return {
      format: 'open-board-log-0.1',
      user_id: userId,
      source: source || 'aac-processors',
      sessions: [session],
    };
  }
}

/**
 * .obl Anonymization Utility
 */
export class OblAnonymizer {
  /**
   * Apply anonymization to an OBL file.
   */
  static anonymize(obl: OblFile, types: string[]): OblFile {
    const newObl = JSON.parse(JSON.stringify(obl)) as OblFile;
    newObl.anonymized = true;

    for (const session of newObl.sessions) {
      session.anonymizations = session.anonymizations || [];

      if (types.includes('timestamp_shift')) {
        this.applyTimestampShift(session);
        if (!session.anonymizations.includes('timestamp_shift'))
          session.anonymizations.push('timestamp_shift');
      }

      if (types.includes('geolocation_masking')) {
        this.applyGeolocationMasking(session);
        if (!session.anonymizations.includes('geolocation_masking'))
          session.anonymizations.push('geolocation_masking');
      }

      if (types.includes('url_stripping')) {
        this.applyUrlStripping(session);
        if (!session.anonymizations.includes('url_stripping'))
          session.anonymizations.push('url_stripping');
      }

      if (types.includes('name_masking')) {
        this.applyNameMasking(newObl, session);
        if (!session.anonymizations.includes('name_masking'))
          session.anonymizations.push('name_masking');
      }
    }

    return newObl;
  }

  private static applyTimestampShift(session: OblSession): void {
    if (session.events.length === 0) return;

    const firstEventTime =
      session.events.length > 0 ? new Date(session.events[0].timestamp).getTime() : Infinity;
    const sessionStartTime = session.started ? new Date(session.started).getTime() : Infinity;
    const firstTimestamp = Math.min(firstEventTime, sessionStartTime);

    if (firstTimestamp === Infinity) return;

    const targetStart = new Date('2000-01-01T00:00:00.000Z').getTime();
    const offset = targetStart - firstTimestamp;

    session.started = new Date(new Date(session.started).getTime() + offset).toISOString();
    session.ended = new Date(new Date(session.ended).getTime() + offset).toISOString();

    for (const event of session.events) {
      event.timestamp = new Date(new Date(event.timestamp).getTime() + offset).toISOString();
    }
  }

  private static applyGeolocationMasking(session: OblSession): void {
    for (const event of session.events) {
      delete event.geo;
      delete event.location_id;
    }
  }

  private static applyUrlStripping(session: OblSession): void {
    for (const event of session.events) {
      if (event.type === 'button') {
        delete (event as OblButtonEvent).image_url;
      }
      if (event.type === 'note') {
        delete (event as OblNoteEvent).author_url;
        delete (event as OblNoteEvent).author_email;
      }
    }
  }

  private static applyNameMasking(obl: OblFile, session: OblSession): void {
    delete obl.user_name;
    for (const event of session.events) {
      if (event.type === 'note') {
        delete (event as OblNoteEvent).author_name;
      }
    }
  }
}
