import { SymbolView as ExpoSymbolView, type SymbolViewProps } from 'expo-symbols';
import bold from 'expo-symbols/androidWeights/bold';
import semiBold from 'expo-symbols/androidWeights/semiBold';

import { androidSymbolFor } from '@/constants/android-symbols';

export type { SymbolViewProps };

type SymbolWeight = Extract<SymbolViewProps['weight'], string>;

/** Deux graisses suffisent à l'app : chacune est une police Material Symbols de près d'1 Mo. */
function androidWeight(weight: SymbolWeight) {
  if (weight === 'medium' || weight === 'semibold') return semiBold;
  if (weight === 'bold' || weight === 'heavy' || weight === 'black') return bold;
  return undefined;
}

/**
 * Sous Android, `expo-symbols` n'affiche un symbole que s'il reçoit un nom Material Symbols :
 * les noms SF Symbols de l'app sont traduits ici, sans toucher aux écrans ni au rendu iOS.
 */
export function SymbolView({ name, weight, ...props }: SymbolViewProps) {
  if (typeof name !== 'string') return <ExpoSymbolView name={name} weight={weight} {...props} />;

  const android = androidSymbolFor(name);
  if (__DEV__ && !android) {
    console.warn(`Paris GO : aucun équivalent Android pour le symbole « ${name} ».`);
  }
  const platformWeight = typeof weight === 'string' ? androidWeight(weight) : undefined;

  return (
    <ExpoSymbolView
      {...props}
      name={{ ios: name, android }}
      weight={platformWeight && typeof weight === 'string' ? { ios: weight, android: platformWeight } : weight}
    />
  );
}
