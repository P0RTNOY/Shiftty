import { screen } from '@testing-library/react-native';

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
});
