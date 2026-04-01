// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import test from 'tape-promise/tape';

import {UNIT} from '@deck.gl/core';
import {CollisionFilterExtension} from '@deck.gl/extensions';
import {LabeledScatterplotLayer} from '@deck.gl/layers';
import {getLayerUniforms, testLayer} from '@deck.gl/test-utils';

import * as FIXTURES from 'deck.gl-test/data';

const SAMPLE_PROPS = {
  data: FIXTURES.points,
  getPosition: d => d.COORDINATES,
  getText: d => d.ADDRESS,
  getRadius: () => 12
};

test('LabeledScatterplotLayer#composition', t => {
  const testCases = [
    {
      props: {
        ...SAMPLE_PROPS,
        background: true,
        collisionGroup: 'labels',
        getCollisionPriority: d => d.SPACES,
        extensions: [new CollisionFilterExtension()]
      },
      onAfterUpdate: ({subLayers}) => {
        t.is(subLayers.length, 2, 'renders circle and label sublayers');

        const circles = subLayers.find(layer => layer.id.endsWith('circles'))!;
        const labels = subLayers.find(layer => layer.id.endsWith('labels'))!;
        const labelSubLayers = labels.getSubLayers();
        const background = labelSubLayers.find(
          layer => layer.id.endsWith('background') && !layer.id.endsWith('collision-background')
        )!;
        const characters = labelSubLayers.find(layer => layer.id.endsWith('characters'))!;
        const collisionBackground = labelSubLayers.find(layer =>
          layer.id.endsWith('collision-background')
        )!;

        t.ok(circles, 'renders circles sublayer');
        t.ok(labels, 'renders labels sublayer');
        t.ok(background, 'renders visible label background sublayer');
        t.ok(characters, 'renders label characters sublayer');
        t.ok(collisionBackground, 'renders collision-only background sublayer');
        t.ok(
          background.getShaders().vs.includes('labeledScatterplot_collisionIsVisible'),
          'visible background uses the shared label-box collision helper'
        );
        t.is(
          background.props.collisionEnabled,
          true,
          'visible background receives collision props'
        );
        t.ok(
          characters.getAttributeManager()?.getAttributes().instanceBoundingRects,
          'label characters get bounding rect attribute for collision checks'
        );
        t.ok(
          characters.getShaders().vs.includes('labeledScatterplot_collisionIsVisible'),
          'label characters use the shared label-box collision helper'
        );
        t.notOk(circles.props.collisionEnabled, 'circles do not receive collision props');
        t.is(characters.props.collisionEnabled, true, 'label characters receive collision props');
        t.is(characters.props.collisionGroup, 'labels', 'label characters receive collision group');
        t.notOk(
          circles.getAttributeManager()?.getAttributes().collisionPriorities,
          'circles do not get collision priority attribute'
        );
        t.ok(
          characters.getAttributeManager()?.getAttributes().collisionPriorities,
          'label characters get collision priority attribute'
        );
      }
    }
  ];

  testLayer({Layer: LabeledScatterplotLayer, testCases, onError: t.notOk});
  t.end();
});

test('LabeledScatterplotLayer#placement uniforms', t => {
  const pixelOffset = [3, 7];
  const testCases = [
    {
      props: {
        ...SAMPLE_PROPS,
        labelPosition: 'top',
        radiusUnits: 'pixels'
      },
      onAfterUpdate: ({subLayers}) => {
        const labels = subLayers.find(layer => layer.id.endsWith('labels'))!;
        const characters = labels.getSubLayers().find(layer => layer.id.endsWith('characters'))!;
        const placementUniforms = getLayerUniforms(characters, 'labeledScatterplotLabel');
        const scatterplotUniforms = getLayerUniforms(characters, 'scatterplot');

        t.is(placementUniforms.direction, -1, 'top labels offset upward');
        t.deepEqual(
          Array.from(placementUniforms.collisionPadding),
          [0, 0, 0, 0],
          'collision padding defaults to no background padding'
        );
        t.is(
          placementUniforms.boxSizeScale,
          1,
          'shared label-box size scale follows visible text props'
        );
        t.is(scatterplotUniforms.radiusUnits, UNIT.pixels, 'pixel radius units forwarded');
      }
    },
    {
      updateProps: {
        labelPosition: 'bottom',
        radiusUnits: 'meters'
      },
      onAfterUpdate: ({subLayers}) => {
        const labels = subLayers.find(layer => layer.id.endsWith('labels'))!;
        const characters = labels.getSubLayers().find(layer => layer.id.endsWith('characters'))!;
        const placementUniforms = getLayerUniforms(characters, 'labeledScatterplotLabel');
        const scatterplotUniforms = getLayerUniforms(characters, 'scatterplot');

        t.is(placementUniforms.direction, 1, 'bottom labels offset downward');
        t.is(
          placementUniforms.boxSizeUnits,
          UNIT.meters,
          'shared label-box size units follow visible text props'
        );
        t.is(scatterplotUniforms.radiusUnits, UNIT.meters, 'meter radius units forwarded');
      }
    },
    {
      updateProps: {
        radiusUnits: 'common',
        getPixelOffset: () => pixelOffset,
        backgroundPadding: [2, 3],
        collisionTestProps: {
          backgroundPadding: [5, 7],
          sizeScale: 9,
          sizeMinPixels: 9,
          sizeMaxPixels: 9
        }
      },
      onAfterUpdate: ({subLayers}) => {
        const labels = subLayers.find(layer => layer.id.endsWith('labels'))!;
        const characters = labels.getSubLayers().find(layer => layer.id.endsWith('characters'))!;
        const background = labels
          .getSubLayers()
          .find(
            layer => layer.id.endsWith('background') && !layer.id.endsWith('collision-background')
          )!;
        const placementUniforms = getLayerUniforms(characters, 'labeledScatterplotLabel');
        const backgroundPlacementUniforms = getLayerUniforms(background, 'labeledScatterplotLabel');
        const scatterplotUniforms = getLayerUniforms(characters, 'scatterplot');
        const {instancePixelOffset} = characters.getAttributeManager()!.getAttributes();

        t.is(scatterplotUniforms.radiusUnits, UNIT.common, 'common radius units forwarded');
        t.deepEqual(
          Array.from(placementUniforms.collisionPadding),
          [5, 7, 5, 7],
          'characters use the authoritative collision padding'
        );
        t.deepEqual(
          Array.from(backgroundPlacementUniforms.collisionPadding),
          [5, 7, 5, 7],
          'background uses the same authoritative collision padding'
        );
        t.deepEqual(
          Array.from(instancePixelOffset.value.slice(0, 2)),
          pixelOffset,
          'text pixel offset is preserved alongside label placement'
        );
      }
    }
  ];

  testLayer({Layer: LabeledScatterplotLayer, testCases, onError: t.notOk});
  t.end();
});
