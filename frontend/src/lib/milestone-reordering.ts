import type { Milestone } from '@/types';

export function reorderMilestoneAtInsertion(
  milestones: Milestone[],
  activeId: string,
  insertionIndex: number
): Milestone[] {
  const activeIndex = milestones.findIndex((milestone) => milestone.id === activeId);
  if (activeIndex < 0) return milestones;

  const boundedInsertionIndex = Math.max(0, Math.min(insertionIndex, milestones.length));
  const destinationIndex =
    boundedInsertionIndex > activeIndex ? boundedInsertionIndex - 1 : boundedInsertionIndex;
  if (destinationIndex === activeIndex) return milestones;

  const reordered = [...milestones];
  const [activeMilestone] = reordered.splice(activeIndex, 1);
  reordered.splice(destinationIndex, 0, activeMilestone);
  return reordered.map((milestone, index) => ({ ...milestone, milestone_index: index }));
}
