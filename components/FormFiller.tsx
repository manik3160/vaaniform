import { useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { FormSchema } from '../lib/schema/types';
import { isFieldActive } from '../lib/voice/conversation';
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
  const convo = useFormConversation(schema);
  const [editingId, setEditingId] = useState<string | null>(null);
  const running = convo.phase === 'asking' || convo.phase === 'listening' || convo.phase === 'transcribing';
  const hasAnswers = Object.keys(convo.answers).length > 0;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>
        {schema.title} ({schema.detectedLanguage})
      </Text>

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
        {!running && hasAnswers && <Button title="Reset" onPress={convo.reset} />}
      </View>

      <Text>
        {convo.phase === 'idle' && hasAnswers ? 'Paused' : PHASE_LABEL[convo.phase]}
        {convo.phase === 'listening' && convo.micLevel !== null ? `  mic ${Math.round(convo.micLevel)} dB` : ''}
      </Text>
      {convo.lastHeard && (
        <Text style={styles.heard}>
          Heard: {convo.lastHeard.text === '' ? '(nothing)' : `"${convo.lastHeard.text}"`}
          {`\nunderstood in ${(convo.lastHeard.ms / 1000).toFixed(1)}s by ${convo.lastHeard.model.replace('gemini-', '')}`}
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
              <Text style={styles.value}>{value}</Text>
            ) : convo.needsTyping.has(field.id) ? (
              <Text style={styles.error}>Didn't catch it: tap to type</Text>
            ) : (
              <Text style={styles.placeholder}>{active ? '—' : 'not applicable'}</Text>
            )}
          </Pressable>
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
  hint: { fontSize: 12, color: '#555' },
  error: { color: 'red' },
  field: { padding: 8, borderWidth: 1, borderColor: '#ddd' },
  current: { borderColor: '#007aff', borderWidth: 2 },
  inactive: { opacity: 0.4 },
  label: { fontSize: 12, color: '#555' },
  value: { fontSize: 18 },
  placeholder: { fontSize: 18, color: '#aaa' },
});
