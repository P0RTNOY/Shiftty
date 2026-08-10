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

  // Stable UID based only on the persisted shift ID so calendar imports update moved events.
  const uid = `${shift.id}@shiftty.app`;

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
    ? escapeIcsText(descriptionParts.join('\n'))
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
  const lines = icsText.split('\r\n');
  return lines.map(foldIcsLine).join('\r\n');
}

function foldIcsLine(line: string): string {
  if (utf8ByteLength(line) <= 75) return line;
  const segments: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const character of line) {
    const characterBytes = utf8ByteLength(character);
    const limit = segments.length === 0 ? 75 : 74;
    if (current && currentBytes + characterBytes > limit) {
      segments.push(current);
      current = character;
      currentBytes = characterBytes;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }
  if (current) segments.push(current);
  return segments.join('\r\n ');
}

function utf8ByteLength(value: string): number {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    length += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return length;
}
