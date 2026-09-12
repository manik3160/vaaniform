import { useRef, useState } from 'react';
import { Button, Image, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setShowCamera(true);
  };

  const takePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync();
    if (photo) setPhotoUri(photo.uri);
    setShowCamera(false);
  };

  const speakTestSentence = () => {
    Speech.speak('This is a test of the voice engine.', { language: 'en-US' });
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
    <View style={styles.container}>
      <Text>VaaniForm spike</Text>

      <Button title="Take Photo" onPress={openCamera} />
      {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}

      <Button title="Speak Test Sentence" onPress={speakTestSentence} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  camera: {
    width: '100%',
    height: '70%',
  },
  preview: {
    width: 200,
    height: 200,
  },
});
