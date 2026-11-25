import React from 'react';
import { afterEach, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { ArchiveContactSheet } from '@/components/archive-contact-sheet';
import { MapScreen } from '@/screens/map';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MockMapView(props, ref) {
      return React.createElement('MapView', { ...props, ref });
    }),
    Marker: (props) => React.createElement('Marker', props),
    Polygon: (props) => React.createElement('Polygon', props),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/components/glass-surface', () => ({ GlassSurface: () => null }));
jest.mock('@/hooks/use-user-location', () => ({
  useUserLocation: () => ({ isPrecise: false, loading: false }),
}));
const mockImage = { uri: 'https://example.test/archive.jpg' };
jest.mock('@/hooks/use-station-detail', () => ({
  useStationDetail: () => ({ detail: { images: [mockImage], archiveLinks: [] } }),
}));
jest.mock('@/hooks/use-bhvp-images', () => ({
  useBhvpImages: () => ({ images: [mockImage], loading: false }),
}));

const mockCenter = { latitude: 48.855, longitude: 2.31 };
const mockCell = {
  id: 'zone-13', name: '13', center: mockCenter,
  coordinates: [
    { latitude: 48.854, longitude: 2.309 },
    { latitude: 48.856, longitude: 2.309 },
    { latitude: 48.856, longitude: 2.311 },
    { latitude: 48.854, longitude: 2.311 },
  ],
  bounds: [2.309, 48.854, 2.311, 48.856],
  total1970: 24, published1970: 1, remaining1970: 23, collection2022: 0, percentage: 4.2,
};
const mockArchive = {
  id: 'archive-13', name: 'Secteur 13', kind: 'archive-1970', year: 1970,
  coordinate: mockCenter, approximate: true, remainingCount: 23, frameCount: 24,
};
const mockRecapture = {
  id: 'recapture-13', name: 'Rue de Paris', kind: 'recapture-1970', year: 1970,
  coordinate: mockCenter, approximate: false, arrondissement: '75015',
};
jest.mock('@/providers/stations-provider', () => ({
  useStations: () => ({
    stations: [mockArchive, mockRecapture],
    coverage: { percentage: 10.3 }, grid: [mockCell],
  }),
}));

let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.clearAllMocks();
});
const button = (label) => renderer.root.findAll(node =>
  node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];

it.each(['bulle', 'maille'])('ouvre les photos et la zone en un appui sur la %s', async (target) => {
  await act(async () => { renderer = create(<MapScreen />); });
  if (target === 'bulle') {
    await act(async () => renderer.root.findByType('MapView').props.onRegionChangeComplete({
      ...mockCenter, latitudeDelta: 0.02, longitudeDelta: 0.02,
    }));
  }
  const zone = target === 'bulle'
    ? renderer.root.findAllByType('Marker').find(node => node.props.coordinate === mockCenter)
    : renderer.root.findAllByType('Polygon').find(node => node.props.tappable);
  expect(renderer.root.findAllByType(ArchiveContactSheet)).toHaveLength(0);
  await act(async () => zone.props.onPress());
  expect(renderer.root.findAllByType(ArchiveContactSheet)).toHaveLength(1);
  expect(renderer.root.findAllByType(Text).some(node =>
    node.props.children?.includes?.('15e arrondissement'))).toBe(true);
  expect(renderer.root.findAllByType('Polygon').some(node =>
    node.props.coordinates === mockCell.coordinates && node.props.strokeWidth === 2.4)).toBe(true);
  expect(button('Réduire les photos').props.accessibilityState.expanded).toBe(true);
  await act(async () => button('Fermer cette zone').props.onPress());
  expect(renderer.root.findAllByType(ArchiveContactSheet)).toHaveLength(0);
  expect(button('Fermer cette zone')).toBeUndefined();
});

it('ouvre aussi directement les reprises avec le filtre Photos refaites', async () => {
  await act(async () => { renderer = create(<MapScreen />); });
  const filter = renderer.root.findAll(node => typeof node.props.onPress === 'function' &&
    node.findAllByType(Text).some(text => text.props.children === 'Photos refaites'))[0];
  await act(async () => filter.props.onPress());
  const zone = renderer.root.findAllByType('Polygon').find(node => node.props.tappable);
  await act(async () => zone.props.onPress());
  const preview = button('Ouvrir Rue de Paris, PHOTO REFAITE');
  expect(preview).toBeDefined();
  await act(async () => preview.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/station/[id]', params: { id: mockRecapture.id },
  });
});
