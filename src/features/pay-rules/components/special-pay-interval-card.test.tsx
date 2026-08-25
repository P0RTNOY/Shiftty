import { fireEvent, screen } from '@testing-library/react-native';

import { SpecialPayIntervalCard } from '@/features/pay-rules/components/special-pay-interval-card';
import { createCalendarEvidenceInterval, createPayRule } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const interval = createCalendarEvidenceInterval({ name: 'ערב חג' });

describe('SpecialPayIntervalCard', () => {
  it('states that an interval without a pay rule has no pay effect and links to rules', () => {
    const onOpenRules = jest.fn();
    renderApp(<SpecialPayIntervalCard interval={interval} rules={[]} onArchive={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} onOpenRules={onOpenRules} />);

    expect(screen.getByText('חג')).toBeTruthy();
    expect(screen.getByText('הוגדר על ידך')).toBeTruthy();
    expect(screen.getByText(/אין כרגע כלל פעיל שמכוון/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'הגדרת כלל שכר לטווח' }));
    expect(onOpenRules).toHaveBeenCalledTimes(1);
  });

  it('says a configured rule targets the type without claiming it necessarily applies', () => {
    const rule = createPayRule({
      name: 'תוספת חג', conditions: [{ type: 'specialInterval', intervalTypes: ['holiday'] }],
      effect: { type: 'multiplier', basisPoints: 15_000 }, premiumFamily: 'special_interval',
    });
    renderApp(<SpecialPayIntervalCard interval={interval} rules={[rule]} onArchive={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} onOpenRules={jest.fn()} />);

    expect(screen.getByText('כללים שמכוונים לסוג הטווח')).toBeTruthy();
    expect(screen.getByText('תוספת חג')).toBeTruthy();
    expect(screen.getByText('150%')).toBeTruthy();
    expect(screen.getByText(/ההשפעה על ההערכה תלויה במשמרת/)).toBeTruthy();
    expect(screen.queryByText(/אין כרגע כלל/)).toBeNull();
  });

  it('states that archived evidence has no effect on new estimates', () => {
    const archived = createCalendarEvidenceInterval({ isArchived: true, archivedAt: '2026-08-25T08:00:00.000Z' });
    renderApp(<SpecialPayIntervalCard interval={archived} rules={[]} onArchive={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} onOpenRules={jest.fn()} />);

    expect(screen.getByText(/הטווח בארכיון ואינו משפיע על הערכות חדשות/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'הגדרת כלל שכר לטווח' })).toBeNull();
  });
});
