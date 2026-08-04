import * as Print from 'expo-print';
import { shareFile } from './file-share-adapter';
import { Platform } from 'react-native';

export interface PrintShareOptions {
  html: string;
  filename: string; // e.g. "timesheet.pdf"
  dialogTitle?: string;
  action: 'print' | 'share';
}

export async function processPdf(options: PrintShareOptions): Promise<void> {
  const { html, filename, dialogTitle, action } = options;

  if (action === 'print') {
    // Both web and native support expo-print printAsync
    await Print.printAsync({ html });
    return;
  }

  // If action is 'share'
  if (Platform.OS === 'web') {
    // On web, generating a PDF file programmatically with expo-print and sharing it is not fully supported
    // The easiest fallback is just triggering print which users can "Save as PDF"
    // Or we use Print.printToFileAsync (it returns a base64 URI on web sometimes, but it's flaky)
    // We will just invoke print on web when sharing is requested.
    await Print.printAsync({ html });
    return;
  }

  // Native: generate file, then share it
  try {
    const { uri, base64 } = await Print.printToFileAsync({
      html,
      base64: false, // We'll share via file URI directly
    });
    
    // We can't easily rename the expo-print generated file URI before sharing, 
    // but expo-sharing will share the file. 
    // Wait, let's read the generated file as base64 and use file-share-adapter so we can control filename
    // Actually expo-sharing takes the file URI directly, but the file name in the share sheet might be random.
    // If we want filename control, we can copy it via FileSystem.
    
    // For simplicity, we can just share the URI expo-print gave us.
    // But let's follow the standard:
    const FileSystem = require('expo-file-system');
    const newUri = `\${FileSystem.cacheDirectory}\${filename}`;
    
    await FileSystem.copyAsync({ from: uri, to: newUri });

    const Sharing = require('expo-sharing');
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (isAvailable) {
      await Sharing.shareAsync(newUri, {
        dialogTitle: dialogTitle || `שתף \${filename}`,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (error) {
    console.error('Failed to process PDF', error);
    throw error;
  }
}
