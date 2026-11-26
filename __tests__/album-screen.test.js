import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

const mockPush = jest.fn();
const mockRename = jest.fn();
const mockCamera = jest.fn();
const mockFit = jest.fn();
let mockTitles = {};

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useLocalSearchParams: () => ({ id: '2026-07-14' }),
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useFocusEffect: (callback) => useEffect(() => callback(), [callback]),
  };
});
jest.mock('@/services/fieldbook', () => ({ getSavedCaptures: async () => require('./album-fixtures').captures }));
jest.mock('@/services/album-title-store', () => ({
  albumTitleStore: {
    list: async () => mockTitles,
    rename: async (id, title) => { mockRename(id, title); mockTitles = title ? { [id]: title } : {}; return mockTitles; },
  },
}));
jest.mock('@/providers/stations-provider', () => ({
  // Un nouvel objet à chaque appel, comme un fournisseur qui ne mémoriserait rien.
  useStations: () => ({ findDetail: () => ({ ...require('./album-fixtures').detail }) }),
}));
jest.mock('@/services/bhvp-images', () => ({ loadBhvpImages: async () => require('./album-fixtures').archiveImages }));
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View: MockView } = require('react-native');
  class MockMap extends React.Component {
    animateCamera(...args) { mockCamera(...args); }
    fitToCoordinates(...args) { mockFit(...args); }
    // Comme la vraie carte, prête après le montage (une fois la référence posée).
    componentDidMount() { setTimeout(() => this.props.onMapReady?.(), 0); }
    render() { return <MockView testID="map">{this.props.children}</MockView>; }
  }
  const Stub = (props) => <MockView {...props} />;
  return { __esModule: true, default: MockMap, Marker: Stub, Polyline: (props) => <MockView testID="route" {...props} /> };
});
jest.mock('@/components/glass-surface', () => ({ GlassSurface: () => null, supportsLiquidGlass: () => false }));
jest.mock('react-native-safe-area-context', () => {
  const { View: MockView } = require('react-native');
  return {
    SafeAreaView: (props) => <MockView {...props} />,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const { AlbumScreen } = require('@/screens/album');

let renderer;
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
  mockTitles = {};
});

const texts = () => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
const pressable = (label) => renderer.root.findAll((node) =>
  typeof node.props.onPress === 'function' && (node.props.accessibilityLabel === label || node.props.accessibilityHint === label))[0];

async function render() {
  await act(async () => { renderer = create(<AlbumScreen />); });
  await act(async () => {});
  await act(async () => { jest.advanceTimersByTime(1); });
}

it('ouvre la balade sur la carte : titre, chiffres, tracé, repères et une carte par reprise', async () => {
  await render();
  expect(texts()).toEqual(expect.arrayContaining([
    'Mardi 14 juillet 2026', 'Balade du 14 juillet', '2 reprises · 1,0 km · 56 ans d’écart',
    'Photo 2', 'Secteur 995 · 11:00', 'Secteur 995 · 12:30', '1/2',
  ]));
  // La carte se cadre sur toute la balade, puis le trait de la marche se dessine.
  expect(mockFit).toHaveBeenCalledWith(
    [expect.objectContaining({ index: 0 }), expect.objectContaining({ index: 1 })],
    expect.objectContaining({ animated: true }),
  );
  await act(async () => { jest.advanceTimersByTime(2600); });
  expect(renderer.root.findAllByProps({ testID: 'route' }).length).toBeGreaterThan(0);
  const sources = renderer.root.findAll((node) => node.props.contentFit === 'cover' && node.props.source?.uri)
    .map((node) => node.props.source.uri);
  expect(sources).toEqual(expect.arrayContaining(['https://example.test/1970-2.jpg', 'file:///captures/a.jpg', 'file:///captures/b.jpg']));
  expect(sources).not.toContain('file:///captures/autre-jour.jpg');
});

it('rejoue la balade : la caméra vole d’étape en étape, 1970 puis aujourd’hui, puis revient à la vue d’ensemble', async () => {
  await render();
  await act(async () => pressable('Revivre la balade').props.onPress());
  expect(mockCamera).toHaveBeenLastCalledWith(
    expect.objectContaining({ center: { latitude: 48.8566, longitude: 2.3522 }, pitch: 58 }),
    { duration: 1100 },
  );
  expect(texts()).toContain('1970');
  await act(async () => { jest.advanceTimersByTime(3700); });
  expect(mockCamera).toHaveBeenLastCalledWith(
    expect.objectContaining({ center: { latitude: 48.8656, longitude: 2.3522 } }),
    { duration: 1100 },
  );
  expect(texts()).toContain('2/2');
  mockFit.mockClear();
  await act(async () => { jest.advanceTimersByTime(3700); });
  expect(mockFit).toHaveBeenCalled();
  expect(pressable('Revivre la balade')).toBeDefined();
});

it('bascule une carte sur la photo de 1970 et ouvre la comparaison', async () => {
  await render();
  await act(async () => pressable('Voir la photo de 1970').props.onPress());
  expect(pressable('Revoir la photo d’aujourd’hui')).toBeDefined();
  const card = renderer.root.findAll((node) => typeof node.props.onPress === 'function'
    && (node.props.accessibilityLabel ?? '').startsWith('Étape 2 sur 2'))[0];
  await act(async () => card.props.onPress());
  expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
    pathname: '/capture-review',
    params: expect.objectContaining({ captureId: 'b', id: '13n', frame: '1', resumed: '1' }),
  }));
});

it('renomme la balade et ouvre la feuille de partage', async () => {
  await render();
  await act(async () => pressable('Renommer la balade').props.onPress());
  const input = renderer.root.findByType(TextInput);
  await act(async () => input.props.onChangeText('Autour du Champ-de-Mars'));
  await act(async () => input.props.onSubmitEditing());
  expect(mockRename).toHaveBeenCalledWith('2026-07-14', 'Autour du Champ-de-Mars');
  expect(texts()).toContain('Autour du Champ-de-Mars');

  await act(async () => pressable('Partager la balade').props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/album-share/[id]', params: { id: '2026-07-14' } });
});
