/* global jest */
// Reanimated 4.7 et Worklets 0.13 n'ont pas de module natif sous Jest. Le mock officiel de Worklets
// remplace le runtime UI, mais Reanimated enregistre encore au chargement un gestionnaire
// d'événements CSS que son implémentation JS refuse (`setCSSEventHandler` lève une erreur). Les
// animations CSS n'existent pas sous Jest : on rend cet enregistrement inoffensif, aussi bien pour
// le paquet compilé (`lib/`) que pour les sources chargées par `react-native-reanimated/mock`.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated/lib/module/css/native/proxy', () => ({
  ...jest.requireActual('react-native-reanimated/lib/module/css/native/proxy'),
  setCSSEventHandler: () => {},
}));
jest.mock('react-native-reanimated/src/css/native/proxy', () => ({
  ...jest.requireActual('react-native-reanimated/src/css/native/proxy'),
  setCSSEventHandler: () => {},
}));
