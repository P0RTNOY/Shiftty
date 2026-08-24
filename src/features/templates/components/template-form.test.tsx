import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { TemplateForm } from '@/features/templates/components/template-form';
import { renderApp } from '@/test/render';

describe('TemplateForm date and time controls', () => {
  it('uses picker buttons for template start and end times', () => {
    renderApp(<TemplateForm onSubmit={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'שעת התחלה' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'שעת סיום' })).toBeTruthy();
    expect(screen.queryByPlaceholderText('08:00')).toBeNull();
    expect(screen.queryByPlaceholderText('16:00')).toBeNull();
  });

  it('submits a validated percentage as basis points and defaults breaks to zero', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderApp(<TemplateForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('שם סוג המשמרת'), 'לילה');
    fireEvent.changeText(screen.getByLabelText('מכפיל שכר (%)'), '150');
    fireEvent.press(screen.getByRole('radio', { name: 'ללא תשלום' }));
    fireEvent.press(screen.getByRole('button', { name: 'יצירת סוג משמרת' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'לילה',
      expectedBreakMinutes: 0,
      expectedBreakType: 'unpaid',
      payMultiplierBasisPoints: 15_000,
    })));
  });
});
