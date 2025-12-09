/**
 * Formats schedule values for display
 */
export function formatSchedule(schedule: string): string {
  const scheduleMap: Record<string, string> = {
    '5min': 'Every 5 Minutes',
    '10min': 'Every 10 Minutes',
    '30min': 'Every 30 Minutes',
    'hourly': 'Hourly',
    'daily': 'Daily',
    'weekly': 'Weekly',
    'custom': 'Custom Schedule',
  };

  return scheduleMap[schedule] || schedule;
}
