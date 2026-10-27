import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ScanSweep } from '@/components/scan-sweep';
import { StepScreen } from '@/components/step-screen';
import { Radius } from '@/constants/theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { audioFindings, photoBase64, preparePhoto, remove, type Finding, type PreparedPhoto } from '@/lib/scan';

/**
 * Cámara propia (sin acceso a la fototeca). La foto se reduce, se pixelan personas en el teléfono
 * y la persona ve exactamente lo que se enviará antes de decidir.
 */
export default function Photo() {
  const t = useT();
  const { draft, update } = useCheckinDraft();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<PreparedPhoto | null>(null);
  const [busy, setBusy] = useState<'capture' | 'upload' | null>(null);
  const [failed, setFailed] = useState(false);
  // La cámara cabe sin desplazar la pantalla, incluso en un iPhone SE: como mucho la mitad del alto.
  const { height } = useWindowDimensions();
  const frameHeight = Math.round(height * 0.5);

  function goToFindings(photo: PreparedPhoto | undefined, photoFindings: Finding[], scanFailed: boolean) {
    update({ photo, scanFailed, findings: [...photoFindings, ...audioFindings(draft.audioHints ?? [], t.scan.audioQuestions)] });
    router.replace('/checkin/findings');
  }

  async function capture() {
    setBusy('capture');
    setFailed(false);
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.8, exif: false, shutterSound: false });
      if (shot) setPreview(await preparePhoto(shot.uri));
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!preview) return;
    setBusy('upload');
    try {
      const image = await photoBase64(preview.uri);
      const result = await api.scanPhoto(image, draft.task ?? 'other', draft.audioHints ?? []);
      const found: Finding[] = result.hypotheses.map((h, index) => ({
        key: `photo-${index}`,
        source: 'photo',
        stimulus: h.stimulus,
        question: h.question,
        x: h.x,
        y: h.y,
      }));
      goToFindings(preview, found, false);
    } catch {
      // Si la IA no está disponible, se sigue con el sonido y las preguntas.
      goToFindings(preview, [], true);
    } finally {
      setBusy(null);
    }
  }

  function retake() {
    remove(preview?.uri);
    setPreview(null);
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <StepScreen
        title={t.scan.photoTitle}
        hint={t.scan.photoHint}
        footer={
          <>
            {permission.canAskAgain ? (
              <Button title={t.scan.takePhoto} onPress={requestPermission} />
            ) : (
              <Button title={t.scan.openSettings} onPress={() => Linking.openSettings()} />
            )}
            <Button variant="secondary" title={t.scan.continueWithout} onPress={() => goToFindings(undefined, [], false)} />
          </>
        }>
        {!permission.canAskAgain ? <Notice text={t.scan.photoDenied} /> : null}
      </StepScreen>
    );
  }

  if (preview) {
    return (
      <StepScreen
        title={t.scan.previewTitle}
        hint={busy === 'upload' ? t.scan.analyzing : t.scan.previewPeople(preview.people)}
        footer={
          <>
            <Button title={t.scan.usePhoto} loading={busy === 'upload'} onPress={send} />
            <Button variant="secondary" title={t.scan.retake} disabled={busy === 'upload'} onPress={retake} />
          </>
        }>
        <View style={[styles.photo, { aspectRatio: preview.width / preview.height, maxHeight: frameHeight }]}>
          <Image source={{ uri: preview.uri }} style={StyleSheet.absoluteFill} accessibilityLabel={t.scan.previewTitle} />
          <ScanSweep active={busy === 'upload'} />
        </View>
      </StepScreen>
    );
  }

  return (
    <StepScreen
      title={t.scan.photoTitle}
      hint={t.scan.photoHint}
      footer={
        <Button title={t.scan.takePhoto} disabled={!ready} loading={busy === 'capture'} onPress={capture} />
      }>
      <View style={[styles.cameraFrame, { height: frameHeight, width: (frameHeight * 3) / 4 }]}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      </View>
      {failed ? <Notice text={t.common.somethingFailed} /> : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  cameraFrame: {
    maxWidth: '100%',
    alignSelf: 'center',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});

