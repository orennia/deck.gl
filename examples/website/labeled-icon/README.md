This is a standalone version of the LabeledIconLayer example on [deck.gl](http://deck.gl) website.

### Usage

Copy the content of this folder to your project.

```bash
# install dependencies
npm install
# or
yarn
# bundle and serve the app with vite
npm start
```

### What it shows

This example uses `LabeledIconLayer` to render point icons plus labels that sit just outside each icon. When `CollisionFilterExtension` is supplied through `extensions`, only the labels declutter while all icons remain visible.

### Data format

Sample data is stored in [deck.gl Example Data](https://github.com/visgl/deck.gl-data/tree/master/website), using BART station locations and ridership information.

To use your own data, check out the [documentation of LabeledIconLayer](../../../docs/api-reference/layers/labeled-icon-layer.md) and [GeoJsonLayer](../../../docs/api-reference/layers/geojson-layer.md).
