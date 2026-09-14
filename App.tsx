import { useRef, useState } from 'react';
import { Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { VoiceTest } from './components/VoiceTest';
import { extractFormSchema } from './lib/schema/extractSchema';
import { FormSchema } from './lib/schema/types';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setSchema(null);
    setStatus('idle');
    setShowCamera(true);
  };

  const takePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync();
    if (photo) setPhotoUri(photo.uri);
    setShowCamera(false);
  };

  const runExtraction = async () => {
    if (!photoUri) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const result = await extractFormSchema(photoUri);
      setSchema(result);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  if (showCamera) {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <Button title="Capture" onPress={takePhoto} />
        <Button title="Cancel" onPress={() => setShowCamera(false)} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text>VaaniForm spike</Text>

      <Button title="Take Photo" onPress={openCamera} />
      {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}

      <VoiceTest />

      {photoUri && (
        <Button
          title={status === 'loading' ? 'Extracting…' : 'Extract Schema'}
          onPress={runExtraction}
          disabled={status === 'loading'}
        />
      )}

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {schema && (
        <View style={styles.schemaBox}>
          <Text style={styles.schemaTitle}>
            {schema.title} ({schema.detectedLanguage})
          </Text>
          {schema.fields.map((field) => (
            <Text key={field.id} style={styles.fieldRow}>
              [{field.type}{field.required ? ', required' : ''}
              {field.options?.length ? `, ${field.options.join('/')}` : ''}
              {field.dependsOn ? `, if ${field.dependsOn.fieldId} = ${field.dependsOn.equals}` : ''}]{' '}
              {field.label}
              {'\n'}  → "{field.labelSpoken}"
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 16,
  },
  camera: {
    width: '100%',
    height: '70%',
  },
  preview: {
    width: 200,
    height: 200,
  },
  error: {
    color: 'red',
  },
  schemaBox: {
    width: '100%',
    gap: 8,
  },
  schemaTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  fieldRow: {
    fontSize: 12,
  },
});
