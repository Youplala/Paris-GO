/* Données partagées par les tests de la balade : deux reprises le 14 juillet, une autre le 1er juin. */
const capture = (id, createdAt, extra = {}) => ({
  schemaVersion: 2, id, stationId: '13n', stationName: '995', frameIndex: 1,
  imageUri: `file:///captures/${id}.jpg`, simulated: false,
  preparation: { current: { ready: false }, reference: { ready: false } }, createdAt, ...extra,
});

module.exports = {
  captures: [
    capture('a', '2026-07-14T09:00:00Z', { coordinate: { latitude: 48.8566, longitude: 2.3522 } }),
    capture('b', '2026-07-14T10:30:00Z', { coordinate: { latitude: 48.8656, longitude: 2.3522 } }),
    capture('autre-jour', '2026-06-01T10:00:00Z'),
  ],
  detail: {
    kind: 'archive-1970', year: 1970, archiveLinks: ['ark:/1', 'ark:/2'],
    archiveMetadata: [undefined, { author: 'Ernoult, Georges' }], images: [],
  },
  archiveImages: [{ uri: 'https://example.test/1970-1.jpg' }, { uri: 'https://example.test/1970-2.jpg' }],
};
