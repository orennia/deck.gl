// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

/* global document */
import test from 'tape-promise/tape';

import {UNIT} from '@deck.gl/core';
import {CollisionFilterExtension} from '@deck.gl/extensions';
import {LabeledIconLayer} from '@deck.gl/layers';
import {getLayerUniforms, testLayer} from '@deck.gl/test-utils';

import * as FIXTURES from 'deck.gl-test/data';

const iconAtlas = document.createElement('canvas');
iconAtlas.width = 24;
iconAtlas.height = 24;

const iconMapping = {
  marker: {x: 0, y: 0, width: 20, height: 30, anchorX: 10, anchorY: 0}
};

const iconMappingWithoutAnchor = {
  marker: {x: 0, y: 0, width: 20, height: 30}
};

const SAMPLE_PROPS = {
  data: FIXTURES.points,
  iconAtlas,
  iconMapping,
  getPosition: d => d.COORDINATES,
  getIcon: () => 'marker',
  getSize: () => 12,
  getText: d => d.ADDRESS
};

test('LabeledIconLayer#composition', t => {
  const testCases = [
    {
      props: {
        ...SAMPLE_PROPS,
        textBackground: true,
        textCollisionGroup: 'labels',
        getTextCollisionPriority: d => d.SPACES,
        extensions: [new CollisionFilterExtension()]
      },
      onAfterUpdate: ({subLayers}) => {
        t.is(subLayers.length, 2, 'renders icon and label sublayers');

        const icons = subLayers.find(layer => layer.id.endsWith('icons'));
        const labels = subLayers.find(layer => layer.id.endsWith('labels'));
        t.ok(icons, 'renders icons sublayer');
        t.ok(labels, 'renders labels sublayer');
        if (!icons || !labels) {
          return;
        }

        const labelSubLayers = labels.getSubLayers();
        const background = labelSubLayers.find(
          layer => layer.id.endsWith('background') && !layer.id.endsWith('collision-background')
        );
        const characters = labelSubLayers.find(layer => layer.id.endsWith('characters'));
        const collisionBackground = labelSubLayers.find(layer =>
          layer.id.endsWith('collision-background')
        );
        t.ok(background, 'renders visible label background sublayer');
        t.ok(characters, 'renders label characters sublayer');
        t.ok(collisionBackground, 'renders collision-only background sublayer');
        if (!background || !characters || !collisionBackground) {
          return;
        }

        t.ok(
          characters.getAttributeManager()?.getAttributes().instancePointPlacements,
          'label characters get packed point placement attribute'
        );
        t.ok(
          collisionBackground.getAttributeManager()?.getAttributes().instancePickingColors,
          'collision backgrounds get picking colors for the collision pass'
        );
        t.notOk(icons.props.collisionEnabled, 'icons do not receive collision props');
        t.is(characters.props.collisionEnabled, true, 'label characters receive collision props');
        t.is(characters.props.collisionGroup, 'labels', 'label characters receive collision group');
      }
    }
  ];

  testLayer({Layer: LabeledIconLayer, testCases, onError: t.notOk});
  t.end();
});

test('LabeledIconLayer#placement uniforms', t => {
  const testCases = [
    {
      props: {
        ...SAMPLE_PROPS,
        labelPosition: 'top',
        sizeUnits: 'pixels',
        sizeScale: 2,
        sizeBasis: 'width'
      },
      onAfterUpdate: ({subLayers}) => {
        const labels = subLayers.find(layer => layer.id.endsWith('labels'));
        t.ok(labels, 'renders labels sublayer');
        if (!labels) {
          return;
        }

        const characters = labels.getSubLayers().find(layer => layer.id.endsWith('characters'));
        t.ok(characters, 'renders characters sublayer');
        if (!characters) {
          return;
        }

        const placementUniforms = getLayerUniforms(characters, 'labeledIconLabel');
        const {instancePointPlacements} = characters.getAttributeManager()?.getAttributes() || {};
        t.ok(instancePointPlacements, 'packed point placement attribute is available');
        if (!instancePointPlacements) {
          return;
        }

        t.is(placementUniforms.direction, -1, 'top labels offset upward');
        t.is(placementUniforms.pointSizeUnits, UNIT.pixels, 'pixel icon units forwarded');
        t.is(placementUniforms.pointSizeBasis, 0, 'width-constrained icon sizing forwarded');
        t.deepEqual(
          Array.from(instancePointPlacements.value.slice(0, 4)),
          [12, 20, 30, 0],
          'icon size and anchor data are forwarded in a packed attribute'
        );
      }
    },
    {
      updateProps: {
        labelPosition: 'bottom',
        sizeUnits: 'meters',
        sizeBasis: 'height',
        textBackgroundPadding: [2, 3],
        textCollisionTestProps: {
          backgroundPadding: [5, 7],
          sizeScale: 9,
          sizeMinPixels: 9,
          sizeMaxPixels: 9
        }
      },
      onAfterUpdate: ({subLayers}) => {
        const labels = subLayers.find(layer => layer.id.endsWith('labels'));
        t.ok(labels, 'renders labels sublayer');
        if (!labels) {
          return;
        }

        const characters = labels.getSubLayers().find(layer => layer.id.endsWith('characters'));
        const background = labels
          .getSubLayers()
          .find(
            layer => layer.id.endsWith('background') && !layer.id.endsWith('collision-background')
          );
        t.ok(characters, 'renders characters sublayer');
        t.ok(background, 'renders background sublayer');
        if (!characters || !background) {
          return;
        }

        const placementUniforms = getLayerUniforms(characters, 'labeledIconLabel');
        const backgroundPlacementUniforms = getLayerUniforms(background, 'labeledIconLabel');

        t.is(placementUniforms.direction, 1, 'bottom labels offset downward');
        t.is(placementUniforms.pointSizeUnits, UNIT.meters, 'meter icon units forwarded');
        t.is(placementUniforms.pointSizeBasis, 1, 'height-constrained icon sizing forwarded');
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
      }
    }
  ];

  testLayer({Layer: LabeledIconLayer, testCases, onError: t.notOk});
  t.end();
});

test('LabeledIconLayer#default label alignment', t => {
  const testCases = [
    {
      props: {
        data: FIXTURES.points,
        iconAtlas,
        iconMapping: iconMappingWithoutAnchor,
        getPosition: d => d.COORDINATES,
        getIcon: () => 'marker',
        getSize: () => 12,
        getText: d => d.ADDRESS,
        labelPosition: 'top'
      },
      onAfterUpdate: ({subLayers}) => {
        const labels = subLayers.find(layer => layer.id.endsWith('labels'));
        t.ok(labels, 'renders labels sublayer');
        if (!labels) {
          return;
        }

        const characters = labels.getSubLayers().find(layer => layer.id.endsWith('characters'));
        t.ok(characters, 'renders characters sublayer');
        if (!characters) {
          return;
        }

        const {instancePointPlacements} = characters.getAttributeManager()?.getAttributes() || {};
        t.ok(instancePointPlacements, 'packed point placement attribute is available');
        if (!instancePointPlacements) {
          return;
        }

        t.deepEqual(
          Array.from(instancePointPlacements.value.slice(0, 4)),
          [12, 20, 30, 30],
          'top labels default to the bottom icon edge when anchorY is omitted'
        );
      }
    },
    {
      updateProps: {
        labelPosition: 'bottom'
      },
      onAfterUpdate: ({subLayers}) => {
        const labels = subLayers.find(layer => layer.id.endsWith('labels'));
        t.ok(labels, 'renders labels sublayer');
        if (!labels) {
          return;
        }

        const characters = labels.getSubLayers().find(layer => layer.id.endsWith('characters'));
        t.ok(characters, 'renders characters sublayer');
        if (!characters) {
          return;
        }

        const {instancePointPlacements} = characters.getAttributeManager()?.getAttributes() || {};
        t.ok(instancePointPlacements, 'packed point placement attribute is available');
        if (!instancePointPlacements) {
          return;
        }

        t.deepEqual(
          Array.from(instancePointPlacements.value.slice(0, 4)),
          [12, 20, 30, 0],
          'bottom labels default to the top icon edge when anchorY is omitted'
        );
      }
    }
  ];

  testLayer({Layer: LabeledIconLayer, testCases, onError: t.notOk});
  t.end();
});
