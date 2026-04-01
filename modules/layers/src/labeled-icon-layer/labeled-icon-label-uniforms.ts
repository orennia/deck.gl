// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import type {ShaderModule} from '@luma.gl/shadertools';

const glslUniformBlock = `\
uniform labeledIconLabelUniforms {
  float boxSizeScale;
  float boxSizeMinPixels;
  float boxSizeMaxPixels;
  highp int boxSizeUnits;
  vec4 collisionPadding;
} labeledIconLabel;

float labeledIcon_getLabelBoxSizePixels(float size) {
  return clamp(
    project_size_to_pixel(size * labeledIconLabel.boxSizeScale, labeledIconLabel.boxSizeUnits),
    labeledIconLabel.boxSizeMinPixels,
    labeledIconLabel.boxSizeMaxPixels
  );
}

vec2 labeledIcon_getPixelOffset(float size, vec3 iconMetrics) {
  return vec2(0.0, 0.0);
}
`;

export type LabeledIconLabelProps = {
  boxSizeScale: number;
  boxSizeUnits: number;
  boxSizeMinPixels: number;
  boxSizeMaxPixels: number;
  collisionPadding: [number, number, number, number];
};

export const labeledIconLabelUniforms = {
  name: 'labeledIconLabel',
  vs: glslUniformBlock,
  fs: '',
  source: '',
  uniformTypes: {
    boxSizeScale: 'f32',
    boxSizeUnits: 'i32',
    boxSizeMinPixels: 'f32',
    boxSizeMaxPixels: 'f32',
    collisionPadding: 'vec4<f32>'
  }
} as const satisfies ShaderModule<LabeledIconLabelProps>;
