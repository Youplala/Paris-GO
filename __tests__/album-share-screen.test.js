import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { Image } from 'expo-image';

const mockCapture = jest.fn();
const mockSave = jest.fn();
const mockShare = jest.fn();
const mockSnapshot = jest.fn();

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useLocalSearchParams: () => ({ id: '2026-07-14' }),
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (callback) => useEffect(() => callback(), [callback]),
  };
});
jest.mock('@/services/fieldbook', () => ({
  getSavedCaptures: async () => require('./album-fixtures').captures,
  saveImagesToLibrary: (...args) => mockSave(...args),
}));
jest.mock('@/services/album-title-store', () => ({ albumTitleStore: { list: async () => ({}) } }));
const mockStations = { findDetail: () => require('./album-fixtures').detail };
jest.mock('@/providers/stations-provider', () => ({ useStations: () => mockStations }));
jest.mock('@/services/bhvp-images', () => ({ loadBhvpImages: async () => require('./album-fixtures').archiveImages }));
jest.mock('react-native-view-shot', () => ({ captureRef: (...args) => mockCapture(...args) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...args) => mockShare(...args) }));
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View: MockView } = require('react-native');
  class MockMap extends React.Component {
    takeSnapshot(options) { return mockSnapshot(options); }
    componentDidMount() { setTimeout(() => this.props.onMapReady?.(), 0); }
    render() { return <MockView testID="snapshot-map" />; }
  }
  return { __esModule: true, default: MockMap };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const { AlbumShareScreen } = require('@/screens/album-share');

let renderer;
beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockSnapshot.mockResolvedValue('/tmp/snapshot.jpg');
  mockCapture.mockImplementation(async () => `file:///slide-${mockCapture.mock.calls.length}.jpg`);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); jest.clearAllMocks(); });

const texts = () => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
const button = (label) => renderer.root.find((node) => typeof node.props.onPress === 'function'
  && (node.props.accessibilityLabel === label
    || node.findAllByType(Text).some((text) => [].concat(text.props.children).join('') === label)));

async function render() {
  await act(async () => { renderer = create(<AlbumShareScreen />); });
  await act(async () => {});
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}

async function loadAllImages() {
  const images = renderer.root.findAllByType(Image).filter((node) => typeof node.props.onLoad === 'function');
  await act(async () => { images.forEach((image) => image.props.onLoad()); });
}

it('compose la couverture avec la carte satellite de la balade et ses chiffres', async () => {
  await render();
  expect(mockSnapshot).toHaveBeenCalledWith(expect.objectContaining({ width: 360, height: 360, format: 'jpg', result: 'file' }));
  // Le chemin nu renvoyé par la carte devient une URI file:// affichable.
  const covers = renderer.root.findAllByType(Image).filter((node) => node.props.source?.uri === 'file:///tmp/snapshot.jpg');
  expect(covers.length).toBeGreaterThan(0);
  expect(texts()).toEqual(expect.arrayContaining([
    'Partager la balade', 'Carrousel 4:5', 'Story 9:16', 'PHOTOS REFAITES', '2', 'DE BALADE', '1,0 km',
    'D’ÉCART', '56 ans', 'SECTEUR', '995', '3 images · crédits des archives sur chaque image',
  ]));
  expect(texts().filter((text) => text.includes('BHVP · fonds')).length).toBeGreaterThanOrEqual(2);
});

it('attend les photos, puis enregistre toutes les pages dans Photos', async () => {
  mockSave.mockResolvedValue(3);
  await render();
  expect(texts()).toContain('Préparation…');
  await loadAllImages();
  await act(async () => button('Enregistrer les 3 images dans Photos').props.onPress());
  expect(mockCapture).toHaveBeenCalledTimes(3);
  expect(mockCapture.mock.calls[0][1]).toMatchObject({ format: 'jpg', result: 'tmpfile' });
  expect(mockSave).toHaveBeenCalledWith(['file:///slide-1.jpg', 'file:///slide-2.jpg', 'file:///slide-3.jpg']);
  expect(Alert.alert).toHaveBeenCalledWith('3 images enregistrées', expect.stringContaining('carrousel'));
});

it('partage la page affichée et prévient quand Photos est refusé', async () => {
  mockSave.mockResolvedValue(0);
  await render();
  await act(async () => button('Story 9:16').props.onPress());
  await loadAllImages();
  await act(async () => button('Partager').props.onPress());
  expect(mockShare).toHaveBeenCalledWith('file:///slide-1.jpg', expect.objectContaining({ mimeType: 'image/jpeg' }));
  await act(async () => button('Enregistrer les 3 images dans Photos').props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith('Photos inaccessible', expect.any(String));
});
