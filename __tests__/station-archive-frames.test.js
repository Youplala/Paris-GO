import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text, View } from 'react-native';

const mockPush = jest.fn();
const archive = (n) => ({ uri: `https://example.test/1970-${n}.jpg`, archiveLink: `ark:/frame-${n}` });
const recapture = (n, author, date) => ({
  id: `reprise-${n}-${author}`,
  currentAuthor: author,
  recaptureDate: date,
  recaptureImage: { uri: `https://example.test/2026-${n}.jpg` },
});
const mockDetail = {
  id: 'secteur-995',
  kind: 'archive-1970',
  name: '995',
  year: 1970,
  coordinate: { latitude: 48.85, longitude: 2.35 },
  images: [],
  archiveLinks: ['ark:/frame-1', 'ark:/frame-2', 'ark:/frame-3'],
  archiveMetadata: [undefined, undefined, undefined],
  archiveRecaptures: { 'ark:/frame-2': [recapture(2, 'Camille Dupont', '2026-03-14'), recapture(2, 'Léa Martin', '2026-05-02')] },
  officialUrl: 'https://example.test/source',
  hasRecapture: false,
  sourceLabel: 'BHVP',
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'secteur-995' }),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('@/hooks/use-station-detail', () => ({
  useStationDetail: () => ({ detail: mockDetail, summary: undefined, loading: false }),
}));
jest.mock('@/hooks/use-bhvp-images', () => ({
  useBhvpImages: () => ({ images: [archive(1), archive(2), archive(3)], loading: false }),
}));
jest.mock('react-native-maps', () => {
  const { View: MockView } = require('react-native');
  const Stub = (props) => <MockView>{props.children}</MockView>;
  return { __esModule: true, default: Stub, Circle: Stub, Marker: Stub, Polygon: Stub };
});
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/components/before-after-slider', () => ({ BeforeAfterSlider: () => null }));
jest.mock('@/components/paris-go-badge', () => ({ ParisGoBadge: () => null }));
jest.mock('@/components/glass-action-dock', () => ({ GlassActionDock: () => null }));
jest.mock('@/components/glass-surface', () => ({ GlassSurface: () => null }));
jest.mock('@/components/photo-viewer', () => ({ PhotoViewer: () => null }));
jest.mock('@/components/photo-facts', () => ({ ArchiveFacts: () => null, RecaptureFacts: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View: MockView } = require('react-native');
  return {
    SafeAreaView: (props) => <MockView {...props} />,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const { StationScreen } = require('@/screens/station');

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); mockPush.mockClear(); });

const texts = () => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
const byLabel = (label) => renderer.root.find((node) =>
  node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');
const queryLabel = (label) => renderer.root.findAll((node) =>
  node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');
const heroSources = () => renderer.root
  .findAll((node) => node.props.contentFit === 'cover' && node.props.transition === 220 && node.props.source?.uri)
  .map((node) => node.props.source.uri);

it('une photo non refaite reste en 1970, sans bascule, et se signale à retrouver', async () => {
  await act(async () => { renderer = create(<StationScreen />); });
  expect(texts()).toContain('Secteur 995 · Photo 1');
  expect(texts()).toContain('À retrouver');
  expect(texts()).toContain('1 refaite sur 3');
  expect(queryLabel('Voir la photo refaite en 2026')).toHaveLength(0);
});

it('le filtre « Refaites » mène à la photo refaite, que la bascule montre en 2026', async () => {
  await act(async () => { renderer = create(<StationScreen />); });
  await act(async () => byLabel('Montrer seulement les photos refaites').props.onPress());

  expect(texts()).toContain('Secteur 995 · Photo 2');
  expect(texts()).not.toContain('À retrouver');
  expect(texts()).toEqual(expect.arrayContaining(['Refaite', 'Camille D.', 'mars 2026', 'Léa M.', 'mai 2026']));
  expect(heroSources()).toContain('https://example.test/1970-2.jpg');

  await act(async () => byLabel('Voir la photo refaite en 2026').props.onPress());
  expect(heroSources()).toContain('https://example.test/2026-2.jpg');
  expect(heroSources()).not.toContain('https://example.test/1970-2.jpg');
  expect(byLabel('Voir la photo refaite en 2026').props.accessibilityState.selected).toBe(true);

  await act(async () => byLabel('Voir la photo de 1970').props.onPress());
  expect(heroSources()).toContain('https://example.test/1970-2.jpg');
});

it('chaque reprise de la photo ouvre sa propre fiche', async () => {
  await act(async () => { renderer = create(<StationScreen />); });
  await act(async () => byLabel('Montrer seulement les photos refaites').props.onPress());
  await act(async () => byLabel('Refaite par Léa M. en mai 2026. Voir la reprise').props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/station/[id]', params: { id: 'reprise-2-Léa Martin' } });
});

it('une reprise dont l’image est introuvable ne propose plus la bascule 2026', async () => {
  await act(async () => { renderer = create(<StationScreen />); });
  await act(async () => byLabel('Montrer seulement les photos refaites').props.onPress());
  await act(async () => byLabel('Voir la photo refaite en 2026').props.onPress());
  const broken = renderer.root.find((node) =>
    node.props.transition === 220 && node.props.source?.uri === 'https://example.test/2026-2.jpg'
    && typeof node.props.onError === 'function');
  await act(async () => broken.props.onError());
  expect(queryLabel('Voir la photo refaite en 2026')).toHaveLength(0);
  expect(heroSources()).toContain('https://example.test/1970-2.jpg');
  expect(texts()).toContain('Camille D.');
});
