import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect } from 'react';

import { Palette } from '@/constants/theme';
import { refreshToSendCount, useToSendCount } from '@/services/my-photos-count';

export default function AppTabs() {
  const toSend = useToSendCount();

  useEffect(() => {
    void refreshToSendCount();
  }, []);

  return (
    <NativeTabs
      disableTransparentOnScrollEdge
      backgroundColor={Palette.white}
      shadowColor={Palette.line}
      indicatorColor={Palette.goSoft}
      tintColor={Palette.go}
      disableTransparentOnScrollEdge
      shadowColor={Palette.line}
      labelStyle={{
        default: { color: Palette.inkSoft, fontSize: 11 },
        selected: { color: Palette.go, fontSize: 11, fontWeight: '700' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Autour</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'location', selected: 'location.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Carte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="photos">
        <NativeTabs.Trigger.Label>Mes photos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'photo.on.rectangle', selected: 'photo.fill.on.rectangle.fill' }} />
        <NativeTabs.Trigger.Badge hidden={toSend === 0}>{String(toSend)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collective">
        <NativeTabs.Trigger.Label>Communauté</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
