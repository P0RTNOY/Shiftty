import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface FileShareOptions {
  filename: string;
  content: string;
  mimeType: string;
  dialogTitle?: string;
  isBase64?: boolean; // For PDF we might have a base64 string
}

export async function shareFile(options: FileShareOptions): Promise<void> {
  const { filename, content, mimeType, dialogTitle, isBase64 } = options;

  if (Platform.OS === 'web') {
    return downloadForWeb(filename, content, mimeType, isBase64);
  }

  const file = new FileSystem.File(FileSystem.Paths.cache, filename);

  try {
    file.write(content, {
      encoding: isBase64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(file.uri, {
      dialogTitle: dialogTitle ?? filename,
      mimeType,
      UTI: getUtiForMimeType(mimeType),
    });
  } catch (error) {
    console.error('Failed to share file natively', error);
    throw error;
  }
}

function downloadForWeb(filename: string, content: string, mimeType: string, isBase64?: boolean) {
  try {
    const a = document.createElement('a');
    a.download = filename;

    if (isBase64) {
      a.href = `data:${mimeType};base64,${content}`;
    } else {
      // Create object URL from string blob
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      a.href = url;
    }

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    console.error('Web download failed', e);
    throw new Error('Failed to download file in the browser');
  }
}

function getUtiForMimeType(mimeType: string): string | undefined {
  switch (mimeType) {
    case 'text/csv': return 'public.comma-separated-values-text';
    case 'application/pdf': return 'com.adobe.pdf';
    case 'text/calendar': return 'public.calendar-event';
    case 'application/json': return 'public.json';
    default: return undefined;
  }
}
