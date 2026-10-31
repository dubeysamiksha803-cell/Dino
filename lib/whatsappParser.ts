export type ParsedMessage = {
  date: Date;
  sender: string;
  content: string;
};

/**
 * Parses a raw WhatsApp export text into structured messages.
 * Supports iOS and Android formats.
 * 
 * iOS Example: [29/01/24, 10:30:15] Ashish: Hello there
 * Android Example: 29/01/24, 10:30 am - Ashish: Hello there
 */
export function parseWhatsAppChat(text: string): ParsedMessage[] {
  const lines = text.split(/\r?\n/);
  const messages: ParsedMessage[] = [];
  let currentMessage: ParsedMessage | null = null;

  // Regex for iOS: starts with [date, time] Name:
  // matches: [1] = date, [2] = time, [3] = sender
  const iosRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?)\]\s([^:]+):\s(.*)/;

  // Regex for Android: starts with date, time - Name:
  // matches: [1] = date, [2] = time, [3] = sender
  const androidRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}\s?(?:am|pm|AM|PM)?)\s-\s([^:]+):\s(.*)/;

  for (const line of lines) {
    // 1. Check iOS match
    const iosMatch = line.match(iosRegex);
    if (iosMatch) {
      if (currentMessage) messages.push(currentMessage);
      const dateStr = iosMatch[1];
      const timeStr = iosMatch[2];
      const sender = iosMatch[3].trim();
      const content = iosMatch[4];

      const date = parseDate(dateStr, timeStr);
      if (date) {
        currentMessage = { date, sender, content };
        continue;
      }
    }

    // 2. Check Android match
    const androidMatch = line.match(androidRegex);
    if (androidMatch) {
      if (currentMessage) messages.push(currentMessage);
      const dateStr = androidMatch[1];
      const timeStr = androidMatch[2];
      const sender = androidMatch[3].trim();
      const content = androidMatch[4];

      const date = parseDate(dateStr, timeStr);
      if (date) {
        currentMessage = { date, sender, content };
        continue;
      }
    }

    // 3. Fallback: Multiline message?
    // If it doesn't match a new message start, append to previous message content
    if (currentMessage) {
      // Check if it's a system message which we might want to skip or handle differently
      // e.g. "Messages to this chat ... are now secured" - these often look like new lines but start with date
      // For now, if it starts with a date pattern but no sender, it might be a system msg.
      // But simple multi-lines usually don't start with date patterns.
      // We'll just append.
      currentMessage.content += '\n' + line;
    }
  }

  // Push the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

function parseDate(datePart: string, timePart: string): Date | null {
  try {
    // Normalize date: 29/01/24 -> 2024-01-29
    // Assume DD/MM/YYYY or DD/MM/YY
    const parts = datePart.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000; // 24 -> 2024

    // Helper to parse time string
    // 10:30:15 or 10:30 am
    // We can rely on Date.parse combining them if formatted strictly, but manual construction is safer

    // Normalize time to 24h for manual parsing? Or just let JS Date handle the combined string?
    // "2024-01-29 10:30:00" works well.
    // "2024-01-29 10:30 pm" works well.

    // Let's construct a string compatible with new Date()
    // "MM/DD/YYYY TIME" is usually safe in US locale, but we have DD/MM.
    // Explicit construction:

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    const timeLower = timePart.toLowerCase();
    const isPM = timeLower.includes('pm');
    const isAM = timeLower.includes('am');

    // Remove am/pm for parsing numbers
    const timeClean = timeLower.replace(/am|pm/g, '').trim();
    const timeParts = timeClean.split(':');

    if (timeParts.length >= 2) {
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
      if (timeParts.length === 3) seconds = parseInt(timeParts[2], 10);

      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }

    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
