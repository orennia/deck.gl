// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import type {ShaderModule} from '@luma.gl/shadertools';

const glslUniformBlock = `\
uniform labeledScatterplotLabelUniforms {
  float padding;
  float direction;
  float boxSizeScale;
  float boxSizeMinPixels;
  float boxSizeMaxPixels;
  highp int boxSizeUnits;
  vec4 collisionPadding;
} labeledScatterplotLabel;

vec2 labeledScatterplot_getPixelOffset(float radius) {
  float radiusPixels = clamp(
    project_size_to_pixel(scatterplot.radiusScale * radius, scatterplot.radiusUnits),
    scatterplot.radiusMinPixels,
    scatterplot.radiusMaxPixels
  );
  return vec2(0.0, labeledScatterplotLabel.direction * (radiusPixels + labeledScatterplotLabel.padding));
}

float labeledScatterplot_getLabelBoxSizePixels(float size) {
  return clamp(
    project_size_to_pixel(
      size * labeledScatterplotLabel.boxSizeScale,
      labeledScatterplotLabel.boxSizeUnits
    ),
    labeledScatterplotLabel.boxSizeMinPixels,
    labeledScatterplotLabel.boxSizeMaxPixels
  );
}
`;

export type LabeledScatterplotLabelProps = {
  padding: number;
  direction: number;
  boxSizeScale: number;
  boxSizeUnits: number;
  boxSizeMinPixels: number;
  boxSizeMaxPixels: number;
  collisionPadding: [number, number, number, number];
};

export const labeledScatterplotLabelUniforms = {
  name: 'labeledScatterplotLabel',
  vs: glslUniformBlock,
  fs: '',
  source: '',
  uniformTypes: {
    padding: 'f32',
    direction: 'f32',
    boxSizeScale: 'f32',
    boxSizeUnits: 'i32',
    boxSizeMinPixels: 'f32',
    boxSizeMaxPixels: 'f32',
    collisionPadding: 'vec4<f32>'
  }
} as const satisfies ShaderModule<LabeledScatterplotLabelProps>;
