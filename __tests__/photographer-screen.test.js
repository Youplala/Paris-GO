import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

const mockPush = jest.fn();
const mockProfile = {
  key: 'elliautou, georges', name: 'Elliautou, Georges', displayName: 'Georges E.', candidateNumbers: ['22667'],
  photoCount: 3, recapturedCount: 1, streets: ['avenue de Suffren', 'rue Pérignon'],
  recapturedBy: [{ name: 'Martin de PRESSENSÉ', count: 1 }],
  sectors: [{
    squareId: '13n', name: '995', coordinate: { latitude: 48.84, longitude: 2.3 }, recapturedCount: 1,
    frames: [
      { frameIndex: 5, link: 'ark:/6', recaptures: [] },
      { frameIndex: 6, link: 'ark:/7', recaptures: [{ id: 'r1', author: 'Martin de PRESSENSÉ' }] },
      { frameIndex: 7, link: 'ark:/8', recaptures: [] },
    ],
  }],
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ name: 'Elliautou, Georges' }),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('@/providers/stations-provider', () => ({
  useStations: () => ({ findArchivePhotographer: (name) => (name === 'Elliautou, Georges' ? mockProfile : undefined) }),
}));
jest.mock('@/hooks/use-bhvp-images', () => ({
  useBhvpImages: (links) => ({ images: links.map((link) => ({ uri: `https://example.test/${link}.jpg`, archiveLink: link })), loading: false }),
}));
jest.mock('react-native-maps', () => {
  const { View: MockView } = require('react-native');
  const Stub = (props) => <MockView testID="map-marker">{props.children}</MockView>;
  return { __esModule: true, default: (props) => <MockView>{props.children}</MockView>, Marker: Stub };
});
jest.mock('react-native-safe-area-context', () => {
  const { View: MockView } = require('react-native');
  return { SafeAreaView: (props) => <MockView {...props} /> };
});

const { PhotographerScreen } = require('@/screens/photographer');

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); mockPush.mockClear(); });
const texts = () => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
const pressable = (label) => renderer.root.findAll((node) => typeof node.props.onPress === 'function'
  && node.props.accessibilityLabel === label)[0];

it('présente le photographe de 1970, ses chiffres, ses rues et ses secteurs', async () => {
  await act(async () => { renderer = create(<PhotographerScreen />); });
  expect(texts()).toEqual(expect.arrayContaining([
    'Photographe de 1970', 'Georges E.', '3 photos · 1 secteur · candidat n° 22667',
    '1 de ses 3 photos a déjà été refaite', 'avenue de Suffren', 'Secteur 995', '3 photos · 1 refaite', 'Martin de P.',
  ]));
  expect(renderer.root.findAllByProps({ testID: 'map-marker' }).filter((node) => typeof node.type === 'string')).toHaveLength(1);
});

it('ouvre le secteur sur la bonne photo et le profil des contributeurs qui l’ont refaite', async () => {
  await act(async () => { renderer = create(<PhotographerScreen />); });
  await act(async () => pressable('Photo 7 du secteur 995, déjà refaite').props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/station/[id]', params: { id: '13n', frame: '6' } });
  const contributor = renderer.root.findAll((node) => typeof node.props.onPress === 'function' && node.props.accessibilityRole === 'link')[0];
  await act(async () => contributor.props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/contributor/[name]', params: { name: 'Martin de PRESSENSÉ' } });
});
