import { reportUnexpectedError } from './report-unexpected-error';

describe('reportUnexpectedError', () => {
  it('logs the original diagnostic with operation context and returns no user copy', () => {
    const error = new Error('SQLiteErrorException: private implementation detail');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(reportUnexpectedError('backup.export', error)).toBeUndefined();
    expect(spy).toHaveBeenCalledWith('[Shiftty:backup.export]', error);

    spy.mockRestore();
  });
});
