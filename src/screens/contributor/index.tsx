import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { ContributorAvatar } from '@/components/contributor-avatar';
import { ParisGoBadge } from '@/components/paris-go-badge';
import { SourcePill } from '@/components/source-pill';
import { IconButton } from '@/components/ui/icon-button';
import { YearPill } from '@/components/ui/year-pill';
import { Fonts, Kicker, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import type { StationDetail } from '@/types/station';
import { contributorKey, formatContributorName } from '@/utils/community-stats';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function arrondissementLabel(value?: string) {
  if (!value || !/^750\d{2}$/.test(value)) return value ?? 'Paris';
  const number = Number(value.slice(3));
  return `Paris ${number === 1 ? '1er' : `${number}e`}`;
}

/** Une photo refaite : la vue d'aujourd'hui, la vue de 1970 en médaillon, le lieu dessous. */
function PhotoTile({ detail, onOpen }: { detail: StationDetail; onOpen: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Ouvrir la photo refaite ${detail.name}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.tilePhoto}>
        {detail.recaptureImage ? (
          <Image source={detail.recaptureImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : null}
        {detail.referenceImage ? (
          <View style={styles.tileInset}>
            <Image source={detail.referenceImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          </View>
        ) : null}
        <YearPill label={detail.recaptureDate?.slice(0, 4) ?? '2026'} tone="today" style={styles.tileYear} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={2}>{detail.name}</Text>
      <Text style={styles.tileMeta} numberOfLines={1}>{arrondissementLabel(detail.arrondissement)}</Text>
    </Pressable>
  );
}

/** Grand format : la comparaison avant/après sur toute la largeur, la légende dessous. */
function PhotoCard({ detail, onOpen }: { detail: StationDetail; onOpen: () => void }) {
  return (
    <View style={styles.card}>
      {detail.referenceImage && detail.recaptureImage ? (
        <BeforeAfterSlider before={detail.referenceImage} after={detail.recaptureImage}
          beforeLabel={String(detail.year)} afterLabel={detail.recaptureDate?.slice(0, 4) ?? '2026'}
          borderRadius={0} onPressSide={onOpen} />
      ) : null}
      <Pressable
        accessibilityLabel={`Ouvrir la photo refaite ${detail.name}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.cardCaption, pressed && styles.pressed]}>
        <ParisGoBadge photo={detail} />
        <Text style={styles.cardTitle} numberOfLines={2}>{detail.name}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta}>
            {arrondissementLabel(detail.arrondissement)}
            {detail.recaptureDate ? ` · ${dateFormat.format(new Date(`${detail.recaptureDate}T12:00:00`))}` : ''}
          </Text>
          <SymbolView name="arrow.right" size={15} tintColor={Palette.parisBlue} />
        </View>
      </Pressable>
    </View>
  );
}

type Layout = 'large' | 'grid';

const LAYOUTS: readonly { value: Layout; icon: 'rectangle.portrait' | 'square.grid.2x2'; accessibilityLabel: string }[] = [
  { value: 'large', icon: 'rectangle.portrait', accessibilityLabel: 'Grand format, avant et après' },
  { value: 'grid', icon: 'square.grid.2x2', accessibilityLabel: 'Grille' },
];

/** Petit sélecteur à deux icônes : discret, mais chaque icône garde une zone tactile de 44 pt. */
function LayoutToggle({ value, onChange }: { value: Layout; onChange: (layout: Layout) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.toggle}>
      {LAYOUTS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ selected: active }}
            hitSlop={4}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={[styles.toggleItem, active && styles.toggleItemActive]}>
            <SymbolView name={option.icon} size={16} weight="semibold" tintColor={active ? Palette.white : Palette.inkSoft} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Profil d'une personne qui refait les photos aujourd'hui, en miroir de celui des photographes
 * de 1970 : qui, combien, puis ses photos en grand format (avant/après) ou en grille pour
 * retrouver la bonne d'un coup d'œil.
 */
export function ContributorScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { stats, snapshotVersion, findContributorSubmissions } = useStations();
  const requestedName = name ?? '';
  const contributor = stats.topContributors.find(
    (candidate) => contributorKey(candidate.name) === contributorKey(requestedName),
  );
  const displayName = formatContributorName(contributor?.name ?? requestedName) || 'Photographe';
  const photos = useMemo(() => findContributorSubmissions(requestedName), [findContributorSubmissions, requestedName]);
  const [layout, setLayout] = useState<Layout>('large');

  const summary = useMemo(() => {
    const areas = new Set(photos.map((photo) => arrondissementLabel(photo.arrondissement)));
    const latestDate = photos.find((photo) => photo.recaptureDate)?.recaptureDate;
    return { areaCount: areas.size, latestDate };
  }, [photos]);

  const openPhoto = (detail: StationDetail) => {
    void Haptics.selectionAsync();
    router.push({ pathname: '/station/[id]', params: { id: detail.id } });
  };

  const header = (
    <View>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <IconButton icon="chevron.left" accessibilityLabel="Retour" onPress={() => router.back()} />
      </SafeAreaView>
      <View style={styles.identity}>
        <ContributorAvatar name={displayName} size={64} tone="strong" />
        <View style={styles.identityCopy}>
          <Text style={styles.kicker}>Photographe d’aujourd’hui</Text>
          <Text accessibilityRole="header" style={styles.name} numberOfLines={2}>{displayName}</Text>
        </View>
      </View>
      {photos.length ? (
        <View style={styles.lead}>
          <Text style={styles.leadText}>
            <Text style={styles.leadValue}>{photos.length.toLocaleString('fr-FR')}</Text>
            {` ${photos.length > 1 ? 'photos refaites' : 'photo refaite'} · ${summary.areaCount} ${summary.areaCount > 1 ? 'arrondissements' : 'arrondissement'}`}
          </Text>
          {summary.latestDate ? (
            <Text style={styles.leadHint}>
              Dernière photo le {dateFormat.format(new Date(`${summary.latestDate}T12:00:00`))}
            </Text>
          ) : null}
        </View>
      ) : null}
      {photos.length ? (
        <View style={styles.galleryHeader}>
          <View style={styles.galleryCopy}>
            <Text accessibilityRole="header" style={styles.galleryTitle}>Ses photos</Text>
            <Text style={styles.gallerySort}>Les plus récentes d’abord</Text>
          </View>
          <LayoutToggle value={layout} onChange={setLayout} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={photos}
        keyExtractor={(photo) => photo.id}
        // Changer le nombre de colonnes d'une FlatList impose de la recréer.
        key={layout}
        numColumns={layout === 'grid' ? 2 : 1}
        columnWrapperStyle={layout === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={<View style={styles.sourceNote}><SourcePill version={snapshotVersion} /></View>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <SymbolView name="photo.on.rectangle.angled" size={26} tintColor={Palette.go} />
            <Text style={styles.emptyTitle}>Aucune photo publiée pour l’instant</Text>
            <Text style={styles.emptyText}>Revenez à la communauté pour chercher un autre prénom.</Text>
          </View>
        }
        renderItem={({ item }) =>
          layout === 'grid'
            ? <PhotoTile detail={item} onOpen={() => openPhoto(item)} />
            : <PhotoCard detail={item} onOpen={() => openPhoto(item)} />}
        initialNumToRender={8}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  content: { paddingBottom: Spacing.four },
  topBar: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  identity: { marginTop: Spacing.three, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  identityCopy: { flex: 1 },
  kicker: { ...Kicker, color: Palette.go },
  name: { ...Typography.display, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  lead: { marginTop: Spacing.three, marginHorizontal: Spacing.three, padding: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, gap: Spacing.half },
  leadText: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '600' },
  leadValue: { color: Palette.go, fontFamily: Fonts.display, fontWeight: '800' },
  leadHint: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  galleryHeader: { marginTop: Spacing.four, marginBottom: Spacing.twoHalf, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  galleryCopy: { flex: 1 },
  galleryTitle: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  gallerySort: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  toggle: { flexDirection: 'row', padding: 3, borderRadius: Radius.pill, backgroundColor: Palette.blueMist },
  toggleItem: { width: 40, height: 34, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  toggleItemActive: { backgroundColor: Palette.parisBlue },
  // Grand format : photo pleine largeur, légende attachée, puis un espace avant la suivante.
  card: { marginBottom: Spacing.twoHalf, borderBottomWidth: 1, borderBottomColor: Palette.line },
  cardCaption: { backgroundColor: Palette.white, paddingTop: Spacing.twoHalf, paddingBottom: Spacing.four, paddingHorizontal: Spacing.three },
  cardTitle: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  cardMetaRow: { marginTop: Spacing.one, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardMeta: { ...Typography.body, flex: 1, color: Palette.inkSoft, fontFamily: Fonts.sans },
  gridRow: { paddingHorizontal: Spacing.three, gap: Spacing.twoHalf },
  tile: { flex: 1, maxWidth: '50%', marginBottom: Spacing.three },
  tilePhoto: { aspectRatio: 4 / 5, borderRadius: Radius.medium, overflow: 'hidden', backgroundColor: Palette.archive },
  tileInset: { position: 'absolute', right: Spacing.two, bottom: Spacing.two, width: '42%', aspectRatio: 1, borderRadius: Radius.small, overflow: 'hidden', borderWidth: 2, borderColor: Palette.white, backgroundColor: Palette.archive },
  tileYear: { position: 'absolute', left: Spacing.two, top: Spacing.two },
  tileTitle: { ...Typography.caption, marginTop: Spacing.two, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  tileMeta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  sourceNote: { alignItems: 'center', padding: Spacing.three },
  empty: { padding: Spacing.four, alignItems: 'center', gap: Spacing.one },
  emptyTitle: { ...Typography.title, marginTop: Spacing.two, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800', textAlign: 'center' },
  emptyText: { ...Typography.body, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
