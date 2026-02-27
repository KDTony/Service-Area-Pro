
export const STATES = ['AL', 'GA', 'TN', 'MS', 'FL', 'SC', 'NC', 'VA', 'MO', 'IL', 'MN', 'WI'];

export const stateManifest: Record<string, string> = STATES.reduce((acc, state) => {
  acc[state] = `https://raw.githubusercontent.com/KDTony/Service-Area-Pro/main/zipcode_data/centroids_${state.toLowerCase()}.json`;
  return acc;
}, {} as Record<string, string>);

export const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
  '#64748b', // Slate
];
