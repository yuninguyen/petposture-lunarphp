// The shape both checklists (a Pick's and a blog post's) produce and the one card that shows them.
// A checklist is a list of lines, each ok / warn / missing / note: there is deliberately no total score.

export type ChecklistStatus = 'ok' | 'warn' | 'missing' | 'note';

export interface ChecklistItem {
  id: string;
  status: ChecklistStatus;
  /** Translation key of the sentence that explains the status. */
  detail: string;
  params?: Record<string, string | number>;
}
