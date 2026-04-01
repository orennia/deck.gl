# LabeledScatterplotLayer

import {LabeledScatterplotLayerDemo} from '@site/src/doc-demos/layers';

<LabeledScatterplotLayerDemo />

The `LabeledScatterplotLayer` combines a [ScatterplotLayer](./scatterplot-layer.md) and a [TextLayer](./text-layer.md) into a single composite point layer. It renders all circles, positions labels just outside each circle, and can apply collision filtering to labels without hiding the circles.

## Installation

To install from NPM:

```bash
npm install deck.gl
# or
npm install @deck.gl/core @deck.gl/layers

# optional, only if you want label collision filtering
npm install @deck.gl/extensions
```

```ts
import {LabeledScatterplotLayer} from '@deck.gl/layers';
import type {LabeledScatterplotLayerProps} from '@deck.gl/layers';

new LabeledScatterplotLayer<DataT>(...props: LabeledScatterplotLayerProps<DataT>[]);
```

## Example

```js
import {Deck} from '@deck.gl/core';
import {LabeledScatterplotLayer} from '@deck.gl/layers';
import {CollisionFilterExtension} from '@deck.gl/extensions';

const layer = new LabeledScatterplotLayer({
  id: 'stations',
  data: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/bart-stations.json',
  pickable: true,

  getPosition: d => d.coordinates,
  getRadius: d => Math.sqrt(d.exits),
  radiusScale: 2,
  radiusMinPixels: 4,
  radiusMaxPixels: 18,
  getFillColor: [255, 140, 0],
  getLineColor: [60, 60, 60],
  getLineWidth: 1,
  stroked: true,

  getText: d => d.name,
  getSize: 1,
  sizeScale: 14,
  sizeMinPixels: 14,
  sizeMaxPixels: 14,
  labelPosition: 'top',
  labelPadding: 6,
  background: true,
  getBackgroundColor: [255, 255, 255, 230],
  getBorderColor: [255, 140, 0, 255],
  getBorderWidth: 1,
  backgroundPadding: [8, 4],

  collisionEnabled: true,
  getCollisionPriority: d => Math.sqrt(d.exits),
  collisionTestProps: {
    backgroundPadding: [10, 6],
    sizeScale: 16,
    sizeMinPixels: 16,
    sizeMaxPixels: 16
  },
  extensions: [new CollisionFilterExtension()]
});

new Deck({
  initialViewState: {
    longitude: -122.4,
    latitude: 37.74,
    zoom: 11
  },
  controller: true,
  layers: [layer]
});
```

## Usage with GeoJsonLayer and MVTLayer

`GeoJsonLayer` and `MVTLayer` support this layer through `pointType: 'circle-label'`.

```js
import {GeoJsonLayer} from '@deck.gl/layers';
import {CollisionFilterExtension} from '@deck.gl/extensions';

new GeoJsonLayer({
  id: 'points',
  data,
  pointType: 'circle-label',
  getPointRadius: f => f.properties.radius,
  getText: f => f.properties.name,
  textLabelPosition: 'bottom',
  textCollisionEnabled: true,
  getTextCollisionPriority: f => f.properties.priority,
  extensions: [new CollisionFilterExtension()]
});
```

## Properties

Inherits all [Base Layer](../core/layer.md) and [CompositeLayer](../core/composite-layer.md) properties, plus all [ScatterplotLayer](./scatterplot-layer.md) circle styling props and all [TextLayer](./text-layer.md) text styling props.

Unlike `ScatterplotLayer` and `TextLayer`, this layer does not use a shared `billboard` prop. Use [pointBillboard](#pointbillboard) and [textBillboard](#textbillboard) separately.

### Placement

#### `labelPosition` ('top' | 'bottom', optional) {#labelposition}

* Default: `'top'`

Whether to place the label above or below the circle.

#### `labelPadding` (number, optional) {#labelpadding}

* Default: `4`

Extra padding in pixels between the rendered circle edge and the label.

#### `pointBillboard` (boolean, optional) {#pointbillboard}

* Default: `false`

Whether the circle should face the camera.

#### `textBillboard` (boolean, optional) {#textbillboard}

* Default: `true`

Whether the label should face the camera.

### Collision Filtering

These props are forwarded to sublayers and only take effect if the layer receives a [CollisionFilterExtension](../extensions/collision-filter-extension.md) in its `extensions` prop.

#### `collisionEnabled` (boolean, optional) {#collisionenabled}

* Default: `true`

Enable or disable label collision filtering.

#### `collisionGroup` (string, optional) {#collisiongroup}

* Default: `'default'`

Collision group for the label sublayer.

#### `collisionTestProps` (object, optional) {#collisiontestprops}

Props to override when rendering the label collision map. Use `backgroundPadding`, `backgroundBorderRadius`, and text sizing props such as `sizeScale`, `sizeMinPixels`, and `sizeMaxPixels` to expand the collision footprint.

#### `getCollisionPriority` (Accessor<number>, optional) {#getcollisionpriority}

Accessor used to prioritize which labels remain visible when collisions occur. Higher values are preferred.
