import { Shift } from '@/domain/entities/shift';
import { format, parseISO } from 'date-fns';
import { tz } from '@date-fns/tz';

export interface IcsExportOptions {
  includeSalary?: boolean;
}

export function generateIcs(shifts: Shift[], options?: IcsExportOptions): string {
  let ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Shiftty//App//HE\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n`;

  for (const shift of shifts) {
    ics += generateIcsEvent(shift, options);
  }

  ics += `END:VCALENDAR\r\n`;
  return ics;
}

function generateIcsEvent(shift: Shift, options?: IcsExportOptions): string {
  // Use payable, actual, or scheduled times in that order of preference
  const startIso = shift.payableStart || shift.actualStart || shift.scheduledStart;
  const endIso = shift.payableEnd || shift.actualEnd || shift.scheduledEnd || shift.expectedEnd;

  if (!startIso || !endIso) {
    return ''; // Cannot export a shift without start/end
  }

  const startDate = parseISO(startIso);
  const endDate = parseISO(endIso);
  const dtstampDate = parseISO(shift.updatedAt);

  // UTC format: YYYYMMDDThhmmssZ
  const dtStart = format(startDate, "yyyyMMdd'T'HHmmss'Z'", { in: tz('UTC') });
  const dtEnd = format(endDate, "yyyyMMdd'T'HHmmss'Z'", { in: tz('UTC') });
  const dtStamp = format(dtstampDate, "yyyyMMdd'T'HHmmss'Z'", { in: tz('UTC') });

  // Stable UID based on shift ID and timestamps (so updates modify the same event)
  const uid = `${shift.id}-${dtStart}@shiftty.app`;

  const summary = shift.title || 'משמרת';
  
  let descriptionParts = [];
  if (shift.notes) {
    descriptionParts.push(shift.notes);
  }
  
  if (options?.includeSalary && shift.status === 'completed' && shift.payableGrossPayMinor !== undefined) {
    const amount = (shift.payableGrossPayMinor / 100).toFixed(2);
    descriptionParts.push(`שכר משוער: ₪${amount}`);
  }

  const description = descriptionParts.length > 0 
    ? descriptionParts.join('\\n').replace(/\n/g, '\\n').replace(/,/g, '\\,')
    : '';

  let event = `BEGIN:VEVENT\r\n`;
  event += `UID:${uid}\r\n`;
  event += `DTSTAMP:${dtStamp}\r\n`;
  event += `DTSTART:${dtStart}\r\n`;
  event += `DTEND:${dtEnd}\r\n`;
  event += `SUMMARY:${escapeIcsText(summary)}\r\n`;
  if (description) {
    event += `DESCRIPTION:${description}\r\n`;
  }
  event += `END:VEVENT\r\n`;

  return foldIcsLines(event);
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldIcsLines(icsText: string): string {
  // iCalendar lines must be folded at 75 octets.
  // We'll fold at 75 characters for simplicity since most characters are 1 octet,
  // but if there are wide characters, folding at 75 chars is strictly < 75 octets if we're careful.
  // Actually, RFC 5545 specifies 75 octets. Let's do a safe string fold.
  const lines = icsText.split('\r\n');
  const foldedLines = lines.map(line => {
    if (line.length <= 70) return line;
    let folded = '';
    let currentLine = line;
    while (currentLine.length > 70) {
      folded += currentLine.substring(0, 70) + '\r\n ';
      currentLine = currentLine.substring(70);
    }
    folded += currentLine;
    return folded;
  });
  return foldedLines.join('\r\n');
}
