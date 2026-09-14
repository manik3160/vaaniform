import { useRef, useState } from 'react';
import { Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { FormFiller } from './components/FormFiller';
import { extractFormSchema } from './lib/schema/extractSchema';
import { SAMPLE_FORM } from './lib/schema/sampleForm';
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
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <Button title="Capture" onPress={takePhoto} />
        <Button title="Cancel" onPress={() => setShowCamera(false)} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>VaaniForm</Text>

      <View style={styles.row}>
        <Button title="Take Photo" onPress={openCamera} />
        <Button title="Try sample form" onPress={() => setSchema(SAMPLE_FORM)} />
      </View>

      {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}
      {photoUri && (
        <Button
          title={status === 'loading' ? 'Reading form…' : 'Read this form'}
          onPress={runExtraction}
          disabled={status === 'loading'}
        />
      )}
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {schema && <FormFiller key={schema.id} schema={schema} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    paddingTop: 72,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
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
});
