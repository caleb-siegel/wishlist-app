/**
 * Date and Timezone Utilities for Occasions and 1-Month-Prior Reminders
 */

export interface NextOccurrenceInfo {
  nextOccasionDate: Date;
  nextReminderDate: Date;
  daysUntilOccasion: number;
  daysUntilReminder: number;
  occurrenceYear: number;
  isReminderPast: boolean;
}

/**
 * Calculates the exact "one month before" calendar date.
 * If the day doesn't exist in the previous month (e.g., March 31 -> Feb 28/29),
 * it clamps to the last day of that month.
 */
export function calculateOneMonthPriorDate(year: number, monthZeroIndexed: number, day: number): Date {
  let targetYear = year;
  let targetMonth = monthZeroIndexed - 1;

  if (targetMonth < 0) {
    targetMonth = 11;
    targetYear -= 1;
  }

  // Find max days in targetMonth of targetYear
  // Setting day 0 of next month returns the last day of targetMonth
  const maxDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, maxDaysInMonth);

  // Reminders are scheduled for 9:00 AM local time
  return new Date(targetYear, targetMonth, clampedDay, 9, 0, 0, 0);
}

/**
 * Calculates the next upcoming occurrence and reminder for an occasion.
 * Handles annual recurrence and calculates days remaining.
 */
export function calculateNextOccurrence(
  dateString: string, // YYYY-MM-DD
  recursAnnually: boolean = true
): NextOccurrenceInfo {
  const parts = dateString.split('-').map(Number);
  const origYear = parts[0];
  const origMonth = parts[1] - 1; // 0-indexed
  const origDay = parts[2];

  const now = new Date();
  const currentYear = now.getFullYear();

  let targetYear = recursAnnually ? currentYear : origYear;

  let occasionDate = new Date(targetYear, origMonth, origDay, 23, 59, 59);

  // If recurring and this year's date has already passed, advance to next year
  if (recursAnnually && occasionDate < now) {
    targetYear += 1;
    occasionDate = new Date(targetYear, origMonth, origDay, 23, 59, 59);
  }

  const reminderDate = calculateOneMonthPriorDate(targetYear, origMonth, origDay);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilOccasion = Math.ceil((occasionDate.getTime() - now.getTime()) / msPerDay);
  const daysUntilReminder = Math.ceil((reminderDate.getTime() - now.getTime()) / msPerDay);

  return {
    nextOccasionDate: occasionDate,
    nextReminderDate: reminderDate,
    daysUntilOccasion: Math.max(0, daysUntilOccasion),
    daysUntilReminder,
    occurrenceYear: targetYear,
    isReminderPast: reminderDate.getTime() < now.getTime(),
  };
}

/**
 * Formats a calendar date string (YYYY-MM-DD) into a friendly string like "October 24".
 */
export function formatOccasionDate(dateString: string): string {
  try {
    const parts = dateString.split('-').map(Number);
    const date = new Date(2000, parts[1] - 1, parts[2]);
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch {
    return dateString;
  }
}

/**
 * Checks whether an occasion falls on a given calendar day (accounting for annual recurrence).
 */
export function doesOccasionMatchDate(
  occasionDateString: string,
  recursAnnually: boolean,
  targetDate: Date
): boolean {
  try {
    const parts = occasionDateString.split('-').map(Number);
    const occYear = parts[0];
    const occMonth = parts[1] - 1;
    const occDay = parts[2];

    if (recursAnnually) {
      return targetDate.getMonth() === occMonth && targetDate.getDate() === occDay;
    }
    return (
      targetDate.getFullYear() === occYear &&
      targetDate.getMonth() === occMonth &&
      targetDate.getDate() === occDay
    );
  } catch {
    return false;
  }
}

/**
 * Returns total days in a month.
 */
export function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

/**
 * Returns the weekday index (0 = Sun, 6 = Sat) of the first day of the month.
 */
export function getFirstDayOfWeek(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed, 1).getDay();
}
