import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Component isolating collision cause representation
const CollisionCauseBanner: React.FC<{
  collisionOccurred: boolean;
  minClearanceM: number;
}> = ({ collisionOccurred, minClearanceM }) => {
  if (!collisionOccurred) return null;
  const cause =
    minClearanceM === 0.0
      ? 'Contact with actor or obstacle'
      : 'Left the 4.70 m scoring corridor';

  return (
    <div data-testid="collision-banner" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
      <span>COLLISION EVENT [DERIVED]: {cause}</span>
    </div>
  );
};

describe('Collision Cause Banner', () => {
  it('renders "Contact with actor or obstacle" for physical SAT collisions with clearance 0.0', () => {
    render(<CollisionCauseBanner collisionOccurred={true} minClearanceM={0.0} />);
    expect(screen.getByText(/Contact with actor or obstacle/i)).toBeInTheDocument();
  });

  it('renders "Left the 4.70 m scoring corridor" for corridor excursion with clearance > 0', () => {
    render(<CollisionCauseBanner collisionOccurred={true} minClearanceM={11.74} />);
    expect(screen.getByText(/Left the 4.70 m scoring corridor/i)).toBeInTheDocument();
  });

  it('renders nothing when no collision occurred', () => {
    const { container } = render(<CollisionCauseBanner collisionOccurred={false} minClearanceM={3.5} />);
    expect(container.firstChild).toBeNull();
  });
});

