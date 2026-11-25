import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlignmentScreen } from '@/screens/alignment';

// Le viseur est un modal plein écran qui pivote seul : le fournisseur racine reste sur les marges
// du portrait de l'écran du dessous. Un fournisseur propre au modal suit l'encoche en paysage.
export default function AlignRoute() {
  return (
    <SafeAreaProvider>
      <AlignmentScreen />
    </SafeAreaProvider>
  );
}
