import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContributorRow } from '@/components/contributor-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Fonts, HitSize, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import { formatContributorName, searchContributors } from '@/utils/community-stats';

/** Toutes les personnes du relevé, par ordre alphabétique, avec la même recherche par prénom. */
export function ContributorsScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { stats, findContributorSubmissions } = useStations();
  const [query, setQuery] = useState(q ?? '');
  // Malgré son nom historique, topContributors contient tous les auteurs du relevé.
  const contributors = useMemo(() => searchContributors(stats.topContributors, query), [stats.topContributors, query]);
  const searching = query.trim().length > 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Communauté" title="Tout le monde" onBack={() => router.back()} />
      <View style={styles.search}>
        <SymbolView name="magnifyingglass" size={19} tintColor={Palette.inkSoft} />
        <TextInput
          accessibilityLabel="Chercher une personne par son prénom"
          placeholder="Chercher un prénom"
          placeholderTextColor={Palette.inkSoft}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          style={styles.input}
        />
        {searching ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche"
            onPress={() => setQuery('')} style={styles.clear}>
            <SymbolView name="xmark.circle.fill" size={20} tintColor={Palette.inkSoft} />
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.count}>
        {contributors.length.toLocaleString('fr-FR')} {contributors.length > 1 ? 'personnes' : 'personne'}
        {searching ? (contributors.length > 1 ? ' trouvées' : ' trouvée') : ' ont publié une photo'}
      </Text>
      <FlatList
        data={contributors}
        keyExtractor={(item) => item.name}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Personne ne porte ce prénom</Text>
            <Text style={styles.emptyCopy}>Essayez une autre orthographe. Seules les personnes dont une photo est publiée apparaissent ici.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ContributorRow
            displayName={formatContributorName(item.name)}
            count={item.count}
            photos={searching ? findContributorSubmissions(item.name).slice(0, 4) : undefined}
            onOpen={() => {
              Keyboard.dismiss();
              router.push({ pathname: '/contributor/[name]', params: { name: item.name } });
            }}
            onOpenPhoto={(photo) => router.push({ pathname: '/station/[id]', params: { id: photo.id } })}
          />
        )}
        ListFooterComponent={<SafeAreaView edges={['bottom']} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  search: { marginHorizontal: Spacing.three, marginTop: Spacing.two, paddingLeft: Spacing.three, minHeight: 52, borderRadius: Radius.medium, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.line, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { ...Typography.body, fontFamily: Fonts.sans, color: Palette.ink, flex: 1, minHeight: 52, paddingVertical: Spacing.two },
  clear: { width: HitSize, height: HitSize, alignItems: 'center', justifyContent: 'center' },
  count: { ...Typography.caption, fontFamily: Fonts.sans, fontWeight: '600', color: Palette.inkSoft, marginHorizontal: Spacing.three, marginTop: Spacing.three, marginBottom: Spacing.two },
  list: { paddingBottom: Spacing.four },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.line },
  empty: { padding: Spacing.three },
  emptyTitle: { ...Typography.title, fontFamily: Fonts.display, fontWeight: '800', color: Palette.ink },
  emptyCopy: { ...Typography.body, fontFamily: Fonts.sans, color: Palette.inkSoft, marginTop: Spacing.two },
});
