import { Image } from 'expo-image';

/** La escena del ícono (ventana, escritorio, planta): el único elemento decorativo de la app. */
export function PixelScene({ size = 112 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.22, borderCurve: 'continuous' }}
      accessible={false}
    />
  );
}
