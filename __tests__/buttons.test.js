import React from 'react';
import { afterEach, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';

let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
});

const render = async (element) => {
  await act(async () => { renderer = create(element); });
  return renderer.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.type !== 'string')[0];
};

it('PrimaryButton expose rôle, libellé et état, et déclenche onPress', async () => {
  const onPress = jest.fn();
  const button = await render(<PrimaryButton label="Je me lance" onPress={onPress} />);
  expect(button.props.accessibilityLabel).toBe('Je me lance');
  expect(button.props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  button.props.onPress();
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('PrimaryButton désactivé ou en chargement ne répond plus et garde sa taille', async () => {
  const button = await render(<PrimaryButton label="Envoyer" loading />);
  expect(button.props.disabled).toBe(true);
  expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  // Le libellé reste monté (masqué) : la largeur ne change pas pendant le chargement.
  expect(renderer.root.findAllByProps({ children: 'Envoyer' }).length).toBeGreaterThan(0);

  await act(async () => renderer.update(<PrimaryButton label="Envoyer" disabled />));
  const disabled = renderer.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.type !== 'string')[0];
  expect(disabled.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
});

it('PrimaryButton applique la hauteur selon la taille et accepte la variante ghost', async () => {
  const flat = (b) => StyleSheet.flatten(b.props.style({ pressed: false }));
  const regular = await render(<PrimaryButton label="A" />);
  expect(flat(regular).minHeight).toBe(52);
  await act(async () => renderer.update(<PrimaryButton label="A" size="compact" variant="ghost" />));
  const compact = renderer.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.type !== 'string')[0];
  expect(flat(compact).minHeight).toBe(44);
  expect(flat(compact).backgroundColor).toBe('transparent');
});

it('IconButton garde son libellé, son état sélectionné et sa cible de 44 pt', async () => {
  const button = await render(
    <IconButton icon="xmark" accessibilityLabel="Fermer" selected onPress={() => {}} />,
  );
  expect(button.props.accessibilityLabel).toBe('Fermer');
  expect(button.props.accessibilityState).toMatchObject({ selected: true, disabled: false });
  expect(StyleSheet.flatten(button.props.style({ pressed: false })).minWidth).toBe(44);
});

it('ProgressBar borne la valeur et reste visible dès un petit avancement', async () => {
  await act(async () => { renderer = create(<ProgressBar percentage={140} />); });
  const bar = renderer.root.findByProps({ accessibilityRole: 'progressbar' });
  expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  await act(async () => renderer.update(<ProgressBar percentage={0.4} />));
  expect(renderer.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(0);
});
