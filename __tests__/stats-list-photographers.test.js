/* global jest, afterEach, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';

import { StatsListScreen } from '@/screens/stats-list';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ kind: 'photographes' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View: MockView } = require('react-native');
  return { SafeAreaView: (props) => <MockView {...props} /> };
});
jest.mock('@/providers/stations-provider', () => ({
  useStations: () => ({
    stats: { archivePhotographers: [{ name: 'Elliautou, Georges', count: 34 }], arrondissementActivity: [] },
  }),
}));

let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  mockPush.mockClear();
});

it('ouvre le profil d’un photographe de 1970 depuis le classement complet', async () => {
  await act(async () => { renderer = create(<StatsListScreen />); });
  const row = renderer.root.findAll((node) => typeof node.props.onPress === 'function'
    && (node.props.accessibilityLabel ?? '').includes('34 vues refaites'))[0];
  expect(row).toBeDefined();
  await act(async () => row.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/photographer/[name]', params: { name: 'Elliautou, Georges' } });
});
