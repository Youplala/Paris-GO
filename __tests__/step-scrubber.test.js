import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/components/glass-surface', () => ({ supportsLiquidGlass: () => false }));

const { StepScrubber } = require('@/components/album/step-scrubber');

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

const label = () => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
const slider = () => renderer.root.find((node) => node.props.accessibilityRole === 'adjustable');

it('affiche seulement « 2/5 » et se laisse piloter au glissé comme à VoiceOver', async () => {
  const onChange = jest.fn();
  await act(async () => { renderer = create(<GestureHandlerRootView><StepScrubber count={5} index={1} width={300} onChange={onChange} /></GestureHandlerRootView>); });
  expect(label()).toEqual(['2/5']);
  expect(slider().props.accessibilityValue).toMatchObject({ now: 2, max: 5, text: '2 sur 5' });
  expect(renderer.root.findAllByType(GestureDetector)).toHaveLength(1);

  await act(async () => slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(onChange).toHaveBeenLastCalledWith(2);
  await act(async () => slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  expect(onChange).toHaveBeenLastCalledWith(0);

  await act(async () => renderer.update(<GestureHandlerRootView><StepScrubber count={5} index={4} width={300} onChange={onChange} /></GestureHandlerRootView>));
  expect(label()).toEqual(['5/5']);
  await act(async () => slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(onChange).toHaveBeenCalledTimes(2);
});
