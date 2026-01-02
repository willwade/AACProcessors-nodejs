import * as fs from 'fs';
import * as path from 'path';
import { OblUtil } from '../../src/utilities/analytics/index';

/**
 * Script to bulk-analyze OBLA clinical data and extract utterances to a CSV.
 */

const OBLA_DIR = path.join(__dirname, '../../obla-improvements/small-obla/small');
const OUTPUT_CSV = path.join(__dirname, 'obl_utterances.csv');

interface UtteranceRecord {
  file: string;
  userId: string;
  timestamp: string;
  type: string;
  content: string;
  boardId?: string;
}

function run() {
  console.log(`Analyzing OBLA data in: ${OBLA_DIR}...`);
  
  if (!fs.existsSync(OBLA_DIR)) {
    console.error(`Directory not found: ${OBLA_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(OBLA_DIR).filter(f => f.endsWith('.obla'));
  console.log(`Found ${files.length} files.`);

  const records: any[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(OBLA_DIR, file), 'utf8');
      const obl = OblUtil.parse(content);

      for (const session of obl.sessions) {
        let currentSentence: string[] = [];
        let sentenceStartTime: string | null = null;

        // Sort events within session by timestamp to be sure
        const sortedEvents = [...session.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        for (let i = 0; i < sortedEvents.length; i++) {
          const event = sortedEvents[i];
          const nextEvent = sortedEvents[i + 1];
          
          if (!sentenceStartTime) sentenceStartTime = event.timestamp;

          let text = '';
          let isBoundary = false;

          if (event.type === 'button') {
            text = (event as any).label || (event as any).vocalization || '[?]';
          } else if (event.type === 'utterance') {
            text = (event as any).text;
            isBoundary = true; // Utterances are usually complete sentences
          } else if (event.type === 'action') {
            const action = (event as any).action;
            if (action === ':clear' || action === ':speak' || action === ':home') {
              isBoundary = true;
            }
            if (action === ':backspace') {
              currentSentence.pop();
            } else {
              text = `[${action}]`;
            }
          }

          if (text) currentSentence.push(text);

          // Check for time gap boundary (> 15 seconds)
          if (nextEvent) {
            const currentMs = new Date(event.timestamp).getTime();
            const nextMs = new Date(nextEvent.timestamp).getTime();
            if (nextMs - currentMs > 15000) isBoundary = true;
          } else {
            isBoundary = true; // End of session
          }

          if (isBoundary && currentSentence.length > 0) {
            records.push({
              timestamp: sentenceStartTime,
              userId: obl.user_id,
              sentence: currentSentence.join(' '),
              file: file
            });
            currentSentence = [];
            sentenceStartTime = null;
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }

  // Sort by timestamp
  records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Write CSV
  const header = 'Timestamp,User ID,Sentence,File\n';
  const csvLines = records.map(r => {
    const escapedSentence = `"${r.sentence.replace(/"/g, '""')}"`;
    return `${r.timestamp},${r.userId},${escapedSentence},${r.file}`;
  });

  fs.writeFileSync(OUTPUT_CSV, header + csvLines.join('\n'));
  
  console.log(`\nAnalysis complete!`);
  console.log(`Total sentences reconstructed: ${records.length}`);
  console.log(`Results saved to: ${OUTPUT_CSV}`);
  
  // Show a preview
  console.log('\nPreview (10 Reconstructed Sentences):');
  const preview = records.filter(r => r.sentence.length > 5 && !r.sentence.includes('000')).slice(0, 20);
  preview.forEach(r => {
    console.log(`[${r.timestamp}] ${r.sentence}`);
  });
}

run();
