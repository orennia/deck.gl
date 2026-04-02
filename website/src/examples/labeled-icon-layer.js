// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {Component} from 'react';
import {DATA_URI, MAPBOX_STYLES, GITHUB_TREE} from '../constants/defaults';
import App from 'website-examples/labeled-icon/app';

import {makeExample} from '../components';

class LabeledIconDemo extends Component {
  static title = 'Labeled Icon Layer';

  static data = {
    url: `${DATA_URI}/bart-stations.json`
  };

  static code = `${GITHUB_TREE}/examples/website/labeled-icon`;

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
    iconScale: {
      displayName: 'Icon size',
      type: 'range',
      value: 18,
      step: 1,
      min: 10,
      max: 36
    }
  };

  static mapStyle = MAPBOX_STYLES.LIGHT;

  static renderInfo() {
    return (
      <div>
        <p>BART stations rendered with icons plus decluttered labels.</p>
        <p>
          The labels use <code>pointType: &apos;icon-label&apos;</code> so collision filtering
          only hides labels, while all icons remain visible.
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
        iconScale={params.iconScale.value}
      />
    );
  }
}

export default makeExample(LabeledIconDemo);
