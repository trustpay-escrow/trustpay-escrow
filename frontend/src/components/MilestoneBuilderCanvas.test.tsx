import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MilestoneBuilderCanvas } from '@/components/MilestoneBuilderCanvas';
import { reorderMilestoneAtInsertion } from '@/lib/milestone-reordering';
import type { Milestone } from '@/types';

const milestones: Milestone[] = [
  { id: 'one', title: 'First', amount: 10, status: 'pending', milestone_index: 0 },
  { id: 'two', title: 'Second', amount: 20, status: 'pending', milestone_index: 1 },
  { id: 'three', title: 'Third', amount: 30, status: 'pending', milestone_index: 2 },
];

describe('MilestoneBuilderCanvas', () => {
  it('previews the insertion indicator during drag and commits the reordered list on drop', () => {
    const onReorder = vi.fn();
    render(
      <MilestoneBuilderCanvas
        milestones={milestones}
        token="USDC"
        onReorder={onReorder}
        onRemove={vi.fn()}
      />
    );

    const firstCard = screen.getByTestId('milestone-card-one');
    const lastCard = screen.getByTestId('milestone-card-three');
    const lastCardContainer = lastCard.parentElement as HTMLDivElement;
    vi.spyOn(lastCardContainer, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 140,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.dragStart(firstCard, {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    });
    fireEvent.dragOver(lastCardContainer, { clientY: 130 });

    expect(screen.getByTestId('milestone-drop-indicator')).toBeInTheDocument();
    fireEvent.drop(lastCardContainer);
    expect(onReorder).toHaveBeenCalledWith([
      { ...milestones[1], milestone_index: 0 },
      { ...milestones[0], milestone_index: 1 },
      { ...milestones[2], milestone_index: 2 },
    ]);
  });

  it('moves a milestone to the end when the drop slot follows the final card', () => {
    expect(reorderMilestoneAtInsertion(milestones, 'one', milestones.length).map((item) => item.id))
      .toEqual(['two', 'three', 'one']);
  });

  it('does not alter the list when the dragged item is dropped in its current slot', () => {
    expect(reorderMilestoneAtInsertion(milestones, 'two', 2)).toBe(milestones);
  });
});
