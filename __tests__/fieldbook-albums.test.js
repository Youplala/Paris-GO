import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

const mockPush = jest.fn();
const capture = (id, createdAt) => ({
  schemaVersion: 2, id, stationId: '13n', stationName: '995', frameIndex: 0,
  imageUri: `file:///captures/${id}.jpg`, simulated: false,
  preparation: { current: { ready: false }, reference: { ready: false } }, createdAt,
});

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (callback) => useEffect(() => callback(), [callback]),
  };
});
jest.mock('@/services/fieldbook', () => ({
  getSavedCaptures: async () => [
    capture('a', '2026-07-14T09:00:00Z'),
    capture('b', '2026-07-14T10:00:00Z'),
    capture('c', '2025-06-21T10:00:00Z'),
  ],
  deleteCapture: jest.fn(),
}));
jest.mock('@/services/album-title-store', () => ({
  albumTitleStore: { list: async () => ({ '2026-07-14': 'Autour du Champ-de-Mars' }) },
}));
const mockStations = { findDetail: () => ({ kind: 'archive-1970', year: 1970, archiveLinks: [], archiveMetadata: [], images: [] }) };
jest.mock('@/providers/stations-provider', () => ({ useStations: () => mockStations }));
jest.mock('react-native-safe-area-context', () => {
  const { View: MockView } = require('react-native');
  return { SafeAreaView: (props) => <MockView {...props} /> };
});

const { FieldbookScreen } = require('@/screens/fieldbook');

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); mockPush.mockClear(); });
const texts = () => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));

it('ouvre le carnet sur les balades, titres choisis compris, et bascule vers les photos', async () => {
  await act(async () => { renderer = create(<FieldbookScreen />); });
  await act(async () => {});
  expect(texts()).toEqual(expect.arrayContaining([
    'Carnet', '2', 'balades', '3', 'reprises', 'Balades · 2', 'Photos · 3',
    'Autour du Champ-de-Mars', 'Balade du 21 juin 2025', '2 reprises', 'Secteur 995',
  ]));

  const album = renderer.root.find((node) => typeof node.props.onPress === 'function'
    && (node.props.accessibilityLabel ?? '').startsWith('Autour du Champ-de-Mars'));
  await act(async () => album.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/album/[id]', params: { id: '2026-07-14' } });

  const photosTab = renderer.root.find((node) => node.props.accessibilityRole === 'tab'
    && typeof node.props.onPress === 'function'
    && node.findAllByType(Text).some((text) => [].concat(text.props.children).join('') === 'Photos · 3'));
  await act(async () => photosTab.props.onPress());
  expect(texts()).toEqual(expect.arrayContaining(['Secteur 995 · photo 1', 'À déposer']));
  expect(texts().some((text) => /^14 juil\./.test(text))).toBe(true);
});

it('ouvre les actions d’une reprise depuis la grille des photos', async () => {
  const { ActionSheetIOS } = require('react-native');
  const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((options, callback) => callback(0));
  await act(async () => { renderer = create(<FieldbookScreen />); });
  await act(async () => {});
  const photosTab = renderer.root.find((node) => node.props.accessibilityRole === 'tab'
    && node.findAllByType(Text).some((text) => [].concat(text.props.children).join('') === 'Photos · 3'));
  await act(async () => photosTab.props.onPress());
  const tile = renderer.root.findAll((node) => typeof node.props.onPress === 'function'
    && (node.props.accessibilityHint ?? '') === 'Ouvre les actions de cette reprise')[0];
  await act(async () => tile.props.onPress());
  expect(sheet).toHaveBeenCalledWith(
    expect.objectContaining({
      options: ['Comparer avec la photo d’archive', 'Reprendre le dépôt', 'Partager', 'Supprimer', 'Annuler'],
      destructiveButtonIndex: 3,
      cancelButtonIndex: 4,
    }),
    expect.any(Function),
  );
  expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/capture-review' }));
});
