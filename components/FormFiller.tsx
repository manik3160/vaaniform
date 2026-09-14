import { Button, StyleSheet, Text, View } from 'react-native';
import { FormSchema } from '../lib/schema/types';
import { isFieldActive } from '../lib/voice/conversation';
import { Phase, useFormConversation } from '../lib/voice/useFormConversation';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Not started',
  asking: 'Asking…',
  listening: 'Listening…',
  transcribing: 'Understanding…',
  done: 'All questions done',
};

export function FormFiller({ schema }: { schema: FormSchema }) {
  const convo = useFormConversation(schema);
  const running = convo.phase === 'asking' || convo.phase === 'listening' || convo.phase === 'transcribing';

  return (
    <View style={styles.box}>
      <Text style={styles.title}>
        {schema.title} ({schema.detectedLanguage})
      </Text>

      <View style={styles.row}>
        {running ? (
          <Button title="Stop" onPress={convo.stop} />
        ) : (
          <Button title={Object.keys(convo.answers).length ? 'Continue' : 'Start filling'} onPress={convo.start} />
        )}
        {!running && Object.keys(convo.answers).length > 0 && <Button title="Reset" onPress={convo.reset} />}
      </View>

      <Text>
        {PHASE_LABEL[convo.phase]}
        {convo.phase === 'listening' && convo.micLevel !== null ? `  mic ${Math.round(convo.micLevel)} dB` : ''}
      </Text>
      {convo.lastHeard && (
        <Text style={styles.heard}>
          Heard: {convo.lastHeard.text === '' ? '(nothing)' : `"${convo.lastHeard.text}"`} ·{' '}
          {convo.lastHeard.confidence}
        </Text>
      )}
      {convo.error && <Text style={styles.error}>{convo.error}</Text>}

      {schema.fields.map((field) => {
        const value = convo.answers[field.id];
        const active = isFieldActive(field, convo.answers);
        const isCurrent = field.id === convo.currentFieldId;
        return (
          <View key={field.id} style={[styles.field, isCurrent && styles.current, !active && styles.inactive]}>
            <Text style={styles.label}>
              {field.label}
              {field.dependsOn ? `  (if ${field.dependsOn.fieldId} = ${field.dependsOn.equals})` : ''}
            </Text>
            {value !== undefined ? (
              <Text style={styles.value}>{value}</Text>
            ) : convo.needsTyping.has(field.id) ? (
              <Text style={styles.error}>Didn't catch it: needs typing</Text>
            ) : (
              <Text style={styles.placeholder}>{active ? '—' : 'not applicable'}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', gap: 8 },
  title: { fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  heard: { fontStyle: 'italic' },
  error: { color: 'red' },
  field: { padding: 8, borderWidth: 1, borderColor: '#ddd' },
  current: { borderColor: '#007aff', borderWidth: 2 },
  inactive: { opacity: 0.4 },
  label: { fontSize: 12, color: '#555' },
  value: { fontSize: 18 },
  placeholder: { fontSize: 18, color: '#aaa' },
});
