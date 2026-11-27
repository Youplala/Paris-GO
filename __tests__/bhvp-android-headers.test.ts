import { Platform } from 'react-native';

import { bhvpHeadersForUri, loadBhvpImages } from '@/services/bhvp-images';

const ROOT = 'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAF';

function mockViewer() {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    text: async () => 'var pictureList = [{"image":"/1.jpg"}];',
  } as Response);
}

afterEach(() => jest.restoreAllMocks());

it('sous Android, s’annonce comme Paris GO auprès de la BHVP, qui refuse l’agent okhttp', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const fetchSpy = mockViewer();

  const [image] = await loadBhvpImages([`${ROOT}/B7777777/v0001`]);

  const init = fetchSpy.mock.calls[0][1] as RequestInit;
  expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^ParisGO\//);
  // L'image elle-même passe par le même pare-feu : sa source porte l'en-tête.
  expect(image).toMatchObject({
    uri: 'https://bibliotheques-specialisees.paris.fr/1.jpg',
    headers: { 'User-Agent': expect.stringMatching(/^ParisGO\//) },
  });
  expect(bhvpHeadersForUri(image.uri as string)).toEqual(image.headers);
  expect(bhvpHeadersForUri('https://i0.wp.com/opppp.cartes.xyz/photo.jpg')).toBeUndefined();
});

it('sous iOS, garde l’agent système que la BHVP accepte déjà', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const fetchSpy = mockViewer();

  const [image] = await loadBhvpImages([`${ROOT}/B6666666/v0001`]);

  const init = fetchSpy.mock.calls[0][1] as RequestInit;
  expect(init.headers).toEqual({ Accept: 'text/html,application/xhtml+xml' });
  expect(image).not.toHaveProperty('headers');
  expect(bhvpHeadersForUri(image.uri as string)).toBeUndefined();
});
