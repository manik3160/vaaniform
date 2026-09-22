import { useState } from 'react';
import { Alert, Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { exportFormToPdf } from '../lib/export/exportPdf';
import { FormSchema } from '../lib/schema/types';
import { useCloudEngine } from '../lib/voice/cloud/useCloudEngine';
import { isFieldActive } from '../lib/voice/conversation';
import { useOnDeviceEngine } from '../lib/voice/ondevice/useOnDeviceEngine';
import { Phase, useFormConversation } from '../lib/voice/useFormConversation';
import { FieldEditor } from './FieldEditor';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Not started',
  asking: 'Asking…',
  listening: 'Listening…',
  transcribing: 'Understanding…',
  done: 'All questions done',
};

export function FormFiller({ schema }: { schema: FormSchema }) {
  const [useOnDevice, setUseOnDevice] = useState(false);
  // Both are hooks, so both are always called; we just use one of the two results.
  const cloudEngine = useCloudEngine();
  const onDeviceEngine = useOnDeviceEngine();
  const engine = useOnDevice ? onDeviceEngine : cloudEngine;
  const convo = useFormConversation(schema, engine);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const running = convo.phase === 'asking' || convo.phase === 'listening' || convo.phase === 'transcribing';
  const hasAnswers = Object.keys(convo.answers).length > 0;
  const needsReview = convo.needsTyping.size > 0 || convo.needsConfirmation.size > 0;
  const canConfirmManually = hasAnswers && !running && !needsReview && !convo.confirmed;

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      await exportFormToPdf(schema, convo.answers);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>
        {schema.title} ({schema.detectedLanguage})
      </Text>

      {!running && (
        <View style={styles.row}>
          <Button title={useOnDevice ? '✓ On-device' : 'On-device'} onPress={() => setUseOnDevice(true)} />
          <Button title={!useOnDevice ? '✓ Cloud' : 'Cloud'} onPress={() => setUseOnDevice(false)} />
        </View>
      )}

      <View style={styles.row}>
        {running ? (
          <Button title="Stop" onPress={convo.stop} />
        ) : (
          <Button
            title={hasAnswers ? 'Continue' : 'Start filling'}
            onPress={() => {
              setEditingId(null);
              convo.start();
            }}
          />
        )}
        {!running && hasAnswers && (
          <Button
            title="Reset"
            onPress={() =>
              Alert.alert('Reset form?', 'This clears every answer.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', style: 'destructive', onPress: convo.reset },
              ])
            }
          />
        )}
      </View>

      <Text>
        {convo.phase === 'idle' && hasAnswers ? 'Paused' : PHASE_LABEL[convo.phase]}
        {convo.phase === 'listening' && convo.micLevel !== null ? `  mic ${Math.round(convo.micLevel)} dB` : ''}
      </Text>
      {convo.lastHeard && (
        <Text style={styles.heard}>
          Heard: {convo.lastHeard.text === '' ? '(nothing)' : `"${convo.lastHeard.text}"`}
          {`\nunderstood in ${(convo.lastHeard.ms / 1000).toFixed(1)}s by ${convo.lastHeard.source.replace('gemini-', '')}`}
        </Text>
      )}
      {convo.error && <Text style={styles.error}>{convo.error}</Text>}
      {!running && <Text style={styles.hint}>Tap any question to type or change its answer.</Text>}

      {schema.fields.map((field) => {
        const value = convo.answers[field.id];
        const active = isFieldActive(field, convo.answers);
        const isCurrent = field.id === convo.currentFieldId;
        const editing = field.id === editingId;
        return (
          <Pressable
            key={field.id}
            disabled={running || !active || editing}
            onPress={() => setEditingId(field.id)}
            style={[styles.field, isCurrent && styles.current, !active && styles.inactive]}
          >
            <Text style={styles.label}>
              {field.label}
              {field.dependsOn ? `  (if ${field.dependsOn.fieldId} = ${field.dependsOn.equals})` : ''}
            </Text>
            {editing ? (
              <FieldEditor
                field={field}
                current={value}
                onSave={(v) => {
                  convo.setAnswer(field.id, v);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : value !== undefined ? (
              <>
                <Text style={styles.value}>{value}</Text>
                {convo.needsConfirmation.has(field.id) && (
                  <Text style={styles.error}>Not confirmed by voice — tap to review</Text>
                )}
              </>
            ) : convo.needsTyping.has(field.id) ? (
              <Text style={styles.error}>Didn't catch it: tap to type</Text>
            ) : (
              <Text style={styles.placeholder}>{active ? '—' : 'not applicable'}</Text>
            )}
          </Pressable>
        );
      })}

      {hasAnswers && !running && (
        <View style={styles.exportBox}>
          {convo.confirmed ? (
            <>
              <Text style={styles.confirmedText}>✓ All answers confirmed</Text>
              <Button title={exporting ? 'Exporting…' : 'Export as PDF'} onPress={handleExport} disabled={exporting} />
            </>
          ) : canConfirmManually ? (
            <>
              <Text style={styles.hint}>Review the answers above, then confirm to unlock export.</Text>
              <Button title="I've reviewed everything — confirm" onPress={convo.confirmManually} />
            </>
          ) : (
            <Text style={styles.hint}>
              {needsReview
                ? 'Resolve the flagged answers above before you can export.'
                : 'Run the voice read-back (Start/Continue) to confirm your answers before exporting.'}
            </Text>
          )}
          {exportError && <Text style={styles.error}>{exportError}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', gap: 8 },
  title: { fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  heard: { fontStyle: 'italic' },
  hint: { fontSize: 12, color: '#555' },
  error: { color: 'red' },
  field: { padding: 8, borderWidth: 1, borderColor: '#ddd' },
  current: { borderColor: '#007aff', borderWidth: 2 },
  inactive: { opacity: 0.4 },
  label: { fontSize: 12, color: '#555' },
  value: { fontSize: 18 },
  placeholder: { fontSize: 18, color: '#aaa' },
  exportBox: { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 12 },
  confirmedText: { color: 'green', fontWeight: 'bold' },
});
