import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormField } from '../lib/schema/types';
import { validateValue } from '../lib/voice/parseAnswer';

const HINTS: Partial<Record<FormField['type'], string>> = {
  date: 'DD/MM/YYYY',
  number: 'Digits only',
};

interface Props {
  field: FormField;
  current: string | undefined;
  onSave: (value: string | null) => void;
  onCancel: () => void;
}

export function FieldEditor({ field, current, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(current ?? '');
  const [picked, setPicked] = useState<Set<string>>(new Set(current ? current.split(', ') : []));
  const [error, setError] = useState<string | null>(null);
  const options = field.options ?? [];

  const save = (raw: string) => {
    const value = validateValue(field, raw);
    if (value === null) {
      setError(HINTS[field.type] ? `Please enter a valid value (${HINTS[field.type]})` : 'Please enter a value');
      return;
    }
    onSave(value);
  };

  let input;
  if (field.type === 'choice' && options.length) {
    input = options.map((o) => <Button key={o} title={o === current ? `✓ ${o}` : o} onPress={() => save(o)} />);
  } else if (field.type === 'checkbox' && !options.length) {
    input = ['Yes', 'No'].map((o) => <Button key={o} title={o === current ? `✓ ${o}` : o} onPress={() => save(o)} />);
  } else if (field.type === 'checkbox') {
    input = (
      <>
        {options.map((o) => (
          <Button
            key={o}
            title={`${picked.has(o) ? '☑' : '☐'} ${o}`}
            onPress={() => {
              const next = new Set(picked);
              if (next.has(o)) next.delete(o);
              else next.add(o);
              setPicked(next);
            }}
          />
        ))}
        <Button title="Save" onPress={() => save(options.filter((o) => picked.has(o)).join(', '))} />
      </>
    );
  } else {
    input = (
      <>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            setError(null);
          }}
          placeholder={HINTS[field.type] ?? field.label}
          keyboardType={field.type === 'number' ? 'number-pad' : 'default'}
          autoFocus
          onSubmitEditing={() => save(draft)}
        />
        <Button title="Save" onPress={() => save(draft)} />
      </>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.question}>{field.labelSpoken}</Text>
      {input}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <Button title="Cancel" onPress={onCancel} />
        {current !== undefined && <Button title="Clear answer" onPress={() => onSave(null)} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4, marginTop: 4 },
  question: { fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#999', padding: 8, fontSize: 18 },
  error: { color: 'red' },
  row: { flexDirection: 'row', gap: 12 },
});
