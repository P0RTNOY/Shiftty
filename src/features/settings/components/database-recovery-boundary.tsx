import { Component, useState, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { shareStartupDiagnostic } from '@/features/settings/services/startup-diagnostic-service';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

interface State {
  error: Error | null;
}

export class DatabaseRecoveryBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Native SQLite messages may contain local paths or record fragments. Keep
    // diagnostics useful without emitting the message or user data.
    reportUnexpectedError('database.initialize', {
      errorName: error.name,
      componentStack: info.componentStack,
    });
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <DatabaseRecoveryScreen errorName={this.state.error.name} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}

function DatabaseRecoveryScreen({ errorName, onRetry }: { errorName: string; onRetry: () => void }) {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'error'>('idle');
  const textAlign = isRtl ? 'right' : 'left';

  const exportDiagnostic = async () => {
    setExportStatus('exporting');
    try {
      await shareStartupDiagnostic(errorName, t('databaseRecovery.diagnosticDialogTitle'));
      setExportStatus('idle');
    } catch {
      setExportStatus('error');
    }
  };

  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="database-recovery-screen"
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.danger, textAlign }]}>
          {t('databaseRecovery.title')}
        </Text>
        <Text style={[styles.body, { color: colors.text, textAlign }]}>
          {t('databaseRecovery.body')}
        </Text>
      </View>
      <PrimaryButton label={t('bootstrap.retry')} onPress={onRetry} />
      <SecondaryButton
        disabled={exportStatus === 'exporting'}
        label={exportStatus === 'exporting'
          ? t('databaseRecovery.exportingDiagnostic')
          : t('databaseRecovery.exportDiagnostic')}
        onPress={() => void exportDiagnostic()}
        testID="export-startup-diagnostic"
      />
      {exportStatus === 'error' ? (
        <Text accessibilityRole="alert" style={[styles.exportError, { color: colors.danger, textAlign }]}>
          {t('databaseRecovery.exportDiagnosticFailed')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  copy: {
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
  },
  body: {
    fontSize: typography.body,
    lineHeight: 24,
  },
  exportError: {
    fontSize: typography.caption,
    lineHeight: 20,
  },
});
