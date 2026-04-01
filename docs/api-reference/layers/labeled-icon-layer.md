# LabeledIconLayer

import {LabeledIconLayerDemo} from '@site/src/doc-demos/layers';

<LabeledIconLayerDemo />

The `LabeledIconLayer` combines an [IconLayer](./icon-layer.md) and a [TextLayer](./text-layer.md) into a single composite point layer. It renders all icons, positions labels just outside each icon, and can apply collision filtering to labels without hiding the icons.

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
import {LabeledIconLayer} from '@deck.gl/layers';
import type {LabeledIconLayerProps} from '@deck.gl/layers';

new LabeledIconLayer<DataT>(...props: LabeledIconLayerProps<DataT>[]);
```

## Example

```js
import {Deck} from '@deck.gl/core';
import {LabeledIconLayer} from '@deck.gl/layers';
import {CollisionFilterExtension} from '@deck.gl/extensions';

const layer = new LabeledIconLayer({
  id: 'stations',
  data: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/bart-stations.json',
  pickable: true,

  iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
  iconMapping: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json',
  getPosition: d => d.coordinates,
  getIcon: d => 'marker',
  getColor: [255, 140, 0],
  getSize: 1,
  sizeScale: 18,
  sizeMinPixels: 18,
  sizeMaxPixels: 18,

  getText: d => d.name,
  getTextSize: 1,
  textSizeScale: 14,
  textSizeMinPixels: 14,
  textSizeMaxPixels: 14,
  labelPosition: 'top',
  labelPadding: 6,
  textBackground: true,
  getTextBackgroundColor: [255, 255, 255, 230],
  getTextBorderColor: [255, 140, 0, 255],
  getTextBorderWidth: 1,
  textBackgroundPadding: [8, 4],

  textCollisionEnabled: true,
  getTextCollisionPriority: d => Math.sqrt(d.exits),
  textCollisionTestProps: {
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

`GeoJsonLayer` and `MVTLayer` support this layer through `pointType: 'icon-label'`.

```js
import {GeoJsonLayer} from '@deck.gl/layers';
import {CollisionFilterExtension} from '@deck.gl/extensions';

new GeoJsonLayer({
  id: 'points',
  data,
  pointType: 'icon-label',
  iconAtlas,
  iconMapping,
  getIcon: f => f.properties.icon,
  getIconSize: f => f.properties.iconSize,
  getText: f => f.properties.name,
  textLabelPosition: 'bottom',
  textCollisionEnabled: true,
  getTextCollisionPriority: f => f.properties.priority,
  extensions: [new CollisionFilterExtension()]
});
```

## Properties

Inherits all [Base Layer](../core/layer.md) and [CompositeLayer](../core/composite-layer.md) properties, plus all [IconLayer](./icon-layer.md) icon styling props.

Unlike `IconLayer` and `TextLayer`, this layer does not use a shared `billboard` prop. Use [iconBillboard](#iconbillboard) and [textBillboard](#textbillboard) separately.

Text styling follows the same prefixed prop names used by `GeoJsonLayer`, such as `getText`, `getTextColor`, `getTextSize`, `textSizeScale`, `textBackground`, `getTextBackgroundColor`, and `textFontSettings`.

### Placement

#### `labelPosition` ('top' | 'bottom', optional) {#labelposition}

* Default: `'top'`

Whether to place the label above or below the icon.

#### `labelPadding` (number, optional) {#labelpadding}

* Default: `4`

Extra padding in pixels between the rendered icon edge and the label.

#### `iconBillboard` (boolean, optional) {#iconbillboard}

* Default: `true`

Whether the icon should face the camera.

#### `textBillboard` (boolean, optional) {#textbillboard}

* Default: `true`

Whether the label should face the camera.

### Label Text Props

These props mirror [TextLayer](./text-layer.md) styling, using the `GeoJsonLayer`-style text prefixes to avoid conflicts with the icon props:

* `getText`
* `getTextColor`
* `getTextSize`
* `getTextAngle`
* `getTextPixelOffset`
* `textSizeScale`
* `textSizeUnits`
* `textSizeMinPixels`
* `textSizeMaxPixels`
* `textBackground`
* `getTextBackgroundColor`
* `getTextBorderColor`
* `getTextBorderWidth`
* `textBackgroundBorderRadius`
* `textBackgroundPadding`
* `textCharacterSet`
* `textFontFamily`
* `textFontWeight`
* `textLineHeight`
* `textMaxWidth`
* `textOutlineColor`
* `textOutlineWidth`
* `textWordBreak`
* `textFontSettings`
* `getTextContentBox`
* `textContentCutoffPixels`
* `textContentAlignHorizontal`
* `textContentAlignVertical`

### Collision Filtering

These props are forwarded to sublayers and only take effect if the layer receives a [CollisionFilterExtension](../extensions/collision-filter-extension.md) in its `extensions` prop.

#### `textCollisionEnabled` (boolean, optional) {#textcollisionenabled}

* Default: `true`

Enable or disable label collision filtering.

#### `textCollisionGroup` (string, optional) {#textcollisiongroup}

* Default: `'default'`

Collision group for the label sublayer.

#### `textCollisionTestProps` (object, optional) {#textcollisiontestprops}

Props to override when rendering the label collision map. Use `backgroundPadding`, `backgroundBorderRadius`, and text sizing props such as `sizeScale`, `sizeMinPixels`, and `sizeMaxPixels` to expand the collision footprint.

#### `getTextCollisionPriority` (Accessor<number>, optional) {#gettextcollisionpriority}

Accessor used to prioritize which labels remain visible when collisions occur. Higher values are preferred.
