// The shape both checklists (a Pick's and a blog post's) produce and the one card that shows them.
// A checklist is a list of lines, each ok / warn / missing / note: there is deliberately no total score.

export type ChecklistStatus = 'ok' | 'warn' | 'missing' | 'note';

export interface ChecklistItem {
  id: string;
  status: ChecklistStatus;
  /** Translation key of the sentence that explains the status. */
  detail: string;
  params?: Record<string, string | number>;
  /** A line that repeats (one per store) names its own label; otherwise the card builds it from the card's prefix and the id. */
  label?: string;
  labelParams?: Record<string, string | number>;
}
