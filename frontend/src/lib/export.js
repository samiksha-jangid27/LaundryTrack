import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from './api';

export async function shareOrderExport() {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is unavailable on this device.');
  const csv = await api('/outlet/export', { responseType: 'text' });
  const file = new File(Paths.cache, 'laundrytrack-orders.csv');
  file.create({ overwrite: true });
  await file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Save or share order report',
  });
  // The receiving app may still be reading after the chooser returns. Keep the single
  // app-private cache file until the next export overwrites it or the OS clears it.
}
