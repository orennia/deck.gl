// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import React, {Component} from 'react';
import {DATA_URI, MAPBOX_STYLES, GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/labeled-scatterplot/app';

import {makeExample} from '../components';

class LabeledScatterplotDemo extends Component {
  static title = 'Labeled Scatterplot Layer';

  static data = {
    url: `${DATA_URI}/bart-stations.json`
  };

  static code = `${GITHUB_TREE}/examples/website/labeled-scatterplot`;

  static parameters = {
    textBackground: {
      displayName: 'Text background',
      type: 'checkbox',
      value: true
    },
    collisionEnabled: {
      displayName: 'Avoid overlap',
      type: 'checkbox',
      value: true
    },
    labelPosition: {
      displayName: 'Label position',
      type: 'select',
      options: ['top', 'bottom'],
      value: 'top'
    },
    textSize: {
      displayName: 'Label size',
      type: 'range',
      value: 14,
      step: 1,
      min: 10,
      max: 24
    },
    circleScale: {
      displayName: 'Circle scale',
      type: 'range',
      value: 2,
      step: 0.1,
      min: 0.5,
      max: 5
    }
  };

  static mapStyle = MAPBOX_STYLES.LIGHT;

  static renderInfo() {
    return (
      <div>
        <p>BART stations rendered with circles plus decluttered labels.</p>
        <p>
          The labels use <code>pointType: &apos;circle-label&apos;</code> so collision filtering
          only hides labels, while all points remain visible.
        </p>
      </div>
    );
  }

  render() {
    const {data, params, ...otherProps} = this.props;

    return (
      <App
        {...otherProps}
        data={data}
        textBackground={params.textBackground.value}
        collisionEnabled={params.collisionEnabled.value}
        labelPosition={params.labelPosition.value}
        textSize={params.textSize.value}
        circleScale={params.circleScale.value}
      />
    );
  }
}

export default makeExample(LabeledScatterplotDemo);
