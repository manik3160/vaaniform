import { useRef, useState } from 'react';
import { Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { FormFiller } from './components/FormFiller';
import { extractFormSchema } from './lib/schema/extractSchema';
import { SAMPLE_FORM } from './lib/schema/sampleForm';
import { FormSchema } from './lib/schema/types';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string | null } | null>(null);
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
    const taken = await cameraRef.current?.takePictureAsync();
    if (taken) setPhoto({ uri: taken.uri });
    setShowCamera(false);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setSchema(null);
    setStatus('idle');
    setErrorMessage(null);
    setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
  };

  const runExtraction = async () => {
    if (!photo) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const result = await extractFormSchema(photo.uri, photo.mimeType);
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
        <Button title="From gallery" onPress={pickFromGallery} />
        <Button title="Sample form" onPress={() => setSchema(SAMPLE_FORM)} />
      </View>

      {photo && <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />}
      {photo && (
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
