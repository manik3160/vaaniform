import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Answers } from '../voice/conversation';
import { FormSchema } from '../schema/types';
import { generateFormHtml } from './generateHtml';

/** Renders the confirmed answers to a PDF and opens the native share sheet so it can be
 * saved, printed or sent (PLAN.md §7: "expo-print -> PDF -> share sheet"). */
export async function exportFormToPdf(schema: FormSchema, answers: Answers): Promise<void> {
  const html = generateFormHtml(schema, answers);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
  } else {
    throw new Error('Sharing is not available on this device. The PDF was created but could not be opened.');
  }
}
