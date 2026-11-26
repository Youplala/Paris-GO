import { Image, type ImageSource } from 'expo-image';
import { forwardRef } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';

import { Fonts, Palette } from '@/constants/theme';
import { dottedPath, projectOnSquare, type RoutePoint, type SquareRegion } from '@/services/album-route';

export type AlbumSlideFormat = 'post' | 'story';

/** Taille de rendu en points ; capturée à l'échelle de l'écran (×3), soit 1080 px de large. */
export const ALBUM_SLIDE_SIZE: Record<AlbumSlideFormat, { width: number; height: number }> = {
  post: { width: 360, height: 450 },
  story: { width: 360, height: 640 },
};

export type AlbumSlidePair = {
  key: string;
  reference?: ImageSource;
  current: ImageSource;
  referenceYear: number;
  currentYear: string;
  place: string;
  referenceCredit: string;
};

export type AlbumSlideMap = {
  /** Image satellite de l'emprise de la balade (carré), si elle a pu être produite. */
  snapshot?: string;
  region: SquareRegion;
  route: readonly RoutePoint[];
  pins: readonly (RoutePoint & { photo: ImageSource })[];
};

type SlideBaseProps = {
  format: AlbumSlideFormat;
  /** Largeur affichée ; tout le reste suit, pour l'aperçu comme pour l'export. */
  width?: number;
  onImageLoad?: () => void;
};

function useUnit(format: AlbumSlideFormat, width?: number) {
  const size = ALBUM_SLIDE_SIZE[format];
  const unit = (width ?? size.width) / size.width;
  return { unit, width: size.width * unit, height: size.height * unit };
}

function Signature({ unit }: { unit: number }) {
  return (
    <Text style={[styles.signature, { fontSize: 18 * unit, lineHeight: 21 * unit }]}>
      Paris <Text style={{ color: Palette.goBright }}>GO</Text>
    </Text>
  );
}

function YearPill({ label, tone, unit }: { label: string; tone: 'archive' | 'today'; unit: number }) {
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: tone === 'archive' ? Palette.copper : Palette.parisBlue,
          paddingHorizontal: 10 * unit,
          paddingVertical: 4 * unit,
          top: 14 * unit,
          left: 14 * unit,
        },
      ]}>
      <Text style={[styles.pillText, { fontSize: 14 * unit, lineHeight: 17 * unit }]}>{label}</Text>
    </View>
  );
}

/** La carte de la balade : image satellite, pointillé blanc de la marche, repères photo. */
function RouteMap({ map, size, unit, onImageLoad }: { map: AlbumSlideMap; size: number; unit: number; onImageLoad?: () => void }) {
  const projected = map.route.map((point) => projectOnSquare(point, map.region, size));
  const dots = dottedPath(projected, 6 * unit);
  const pin = 26 * unit;
  return (
    <View style={{ width: size, height: size }}>
      {map.snapshot ? (
        <Image source={{ uri: map.snapshot }} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={onImageLoad} onError={onImageLoad} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.mapTint]} />
      {dots.map((dot, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            { left: dot.x - 1.3 * unit, top: dot.y - 1.3 * unit, width: 2.6 * unit, height: 2.6 * unit, borderRadius: 1.3 * unit },
          ]}
        />
      ))}
      {map.pins.map((point, index) => {
        const { x, y } = projectOnSquare(point, map.region, size);
        return (
          <View
            key={index}
            style={[
              styles.mapPin,
              { left: x - pin / 2, top: y - pin / 2, width: pin, height: pin, borderRadius: pin / 2, borderWidth: 2 * unit },
            ]}>
            <Image source={point.photo} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={onImageLoad} onError={onImageLoad} />
          </View>
        );
      })}
    </View>
  );
}

type CoverSlideProps = SlideBaseProps & {
  title: string;
  day: string;
  stats: readonly { label: string; value: string }[];
  map?: AlbumSlideMap;
  fallbackCover?: AlbumSlidePair;
};

export const AlbumCoverSlide = forwardRef<ViewInstance, CoverSlideProps>(function AlbumCoverSlide(
  { format, width, title, day, stats, map, fallbackCover, onImageLoad },
  ref,
) {
  const { unit, width: w, height: h } = useUnit(format, width);
  const mapHeight = (format === 'story' ? 330 : 186) * unit;
  return (
    <View ref={ref} collapsable={false} style={[styles.slide, { width: w, height: h }]}>
      <View style={{ paddingHorizontal: 22 * unit, paddingTop: 22 * unit }}>
        <Text style={[styles.kicker, { fontSize: 11 * unit, lineHeight: 14 * unit, letterSpacing: 1.4 * unit }]}>
          {day.toLocaleUpperCase('fr-FR')}
        </Text>
        <Text numberOfLines={2} style={[styles.coverTitle, { fontSize: 34 * unit, lineHeight: 36 * unit, marginTop: 4 * unit }]}>
          {title}
        </Text>
      </View>
      <View style={{ height: mapHeight, marginTop: 14 * unit, overflow: 'hidden' }}>
        {map ? (
          <View style={{ position: 'absolute', top: (mapHeight - w) / 2, left: 0 }}>
            <RouteMap map={map} size={w} unit={unit} onImageLoad={onImageLoad} />
          </View>
        ) : fallbackCover ? (
          <View style={styles.row}>
            <Image source={fallbackCover.reference} style={styles.half} contentFit="cover" onLoad={onImageLoad} onError={onImageLoad} />
            <Image source={fallbackCover.current} style={styles.half} contentFit="cover" onLoad={onImageLoad} onError={onImageLoad} />
          </View>
        ) : null}
      </View>
      <View style={[styles.statsGrid, { paddingHorizontal: 22 * unit, paddingTop: 14 * unit, rowGap: 10 * unit }]}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statLabel, { fontSize: 9.5 * unit, lineHeight: 12 * unit, letterSpacing: 1.3 * unit }]}>
              {stat.label.toLocaleUpperCase('fr-FR')}
            </Text>
            <Text style={[styles.statValue, { fontSize: 22 * unit, lineHeight: 26 * unit }]}>{stat.value}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.footer, { paddingHorizontal: 22 * unit, paddingBottom: 16 * unit, paddingTop: 8 * unit }]}>
        <Signature unit={unit} />
        <Text style={[styles.footerCredit, { fontSize: 9 * unit, lineHeight: 12 * unit }]}>
          Archives BHVP · Plans © Apple
        </Text>
      </View>
    </View>
  );
});

type PairSlideProps = SlideBaseProps & {
  pair: AlbumSlidePair;
  position: number;
  total: number;
};

export const AlbumPairSlide = forwardRef<ViewInstance, PairSlideProps>(function AlbumPairSlide(
  { format, width, pair, position, total, onImageLoad },
  ref,
) {
  const { unit, width: w, height: h } = useUnit(format, width);
  const footer = (format === 'story' ? 120 : 86) * unit;
  const photoHeight = (h - footer - 3 * unit) / 2;
  return (
    <View ref={ref} collapsable={false} style={[styles.slide, { width: w, height: h }]}>
      <View style={{ height: photoHeight }}>
        {pair.reference ? (
          <Image source={pair.reference} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={onImageLoad} onError={onImageLoad} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
        )}
        <YearPill label={String(pair.referenceYear)} tone="archive" unit={unit} />
      </View>
      <View style={{ height: 3 * unit }} />
      <View style={{ height: photoHeight }}>
        <Image source={pair.current} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={onImageLoad} onError={onImageLoad} />
        <YearPill label={pair.currentYear} tone="today" unit={unit} />
      </View>
      <View style={[styles.pairFooter, { height: footer, paddingHorizontal: 18 * unit, paddingVertical: 12 * unit }]}>
        <View style={styles.footerRowTop}>
          <Text numberOfLines={1} style={[styles.place, { fontSize: 21 * unit, lineHeight: 25 * unit }]}>
            {pair.place}
          </Text>
          <Text style={[styles.counter, { fontSize: 12 * unit, lineHeight: 16 * unit }]}>
            {position}/{total}
          </Text>
        </View>
        <Text numberOfLines={2} style={[styles.pairCredit, { fontSize: 10 * unit, lineHeight: 13 * unit }]}>
          {pair.referenceCredit}
        </Text>
        <View style={styles.footerRowTop}>
          <Text style={[styles.pairCredit, { fontSize: 10 * unit, lineHeight: 13 * unit }]}>
            {pair.currentYear} · reprise faite avec Paris GO
          </Text>
          <Signature unit={unit * 0.8} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  slide: { overflow: 'hidden', backgroundColor: Palette.blueDeep },
  row: { flex: 1, flexDirection: 'row', gap: 2 },
  half: { flex: 1, height: '100%' },
  kicker: { color: Palette.brass, fontFamily: Fonts.display, fontWeight: '700' },
  coverTitle: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800' },
  mapFallback: { backgroundColor: Palette.parisBlue },
  mapTint: { backgroundColor: 'rgba(13, 42, 60, 0.18)' },
  dot: { position: 'absolute', backgroundColor: Palette.white },
  mapPin: { position: 'absolute', overflow: 'hidden', borderColor: Palette.white, backgroundColor: Palette.parisBlue },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%' },
  statLabel: { color: 'rgba(255, 255, 255, 0.62)', fontFamily: Fonts.display, fontWeight: '700' },
  statValue: { marginTop: 2, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontVariant: ['tabular-nums'] },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  footerCredit: { color: 'rgba(255, 255, 255, 0.5)', fontFamily: Fonts.sans },
  signature: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '900' },
  pill: { position: 'absolute', borderRadius: 999 },
  pillText: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800' },
  pairFooter: { backgroundColor: Palette.blueDeep, justifyContent: 'space-between' },
  footerRowTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  place: { flex: 1, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800' },
  counter: { color: 'rgba(255, 255, 255, 0.6)', fontFamily: Fonts.sans, fontWeight: '700' },
  pairCredit: { color: 'rgba(255, 255, 255, 0.66)', fontFamily: Fonts.sans },
});
