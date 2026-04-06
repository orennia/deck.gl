// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

export default /* glsl */ `\
#version 300 es
#define SHADER_NAME labeled-scatterplot-text-background-layer-vertex-shader

in vec2 positions;

in vec3 instancePositions;
in vec3 instancePositions64Low;
in vec4 instanceRects;
in vec4 instanceClipRect;
in float instanceSizes;
in float instanceAngles;
in vec2 instancePixelOffsets;
in float instanceLineWidths;
in vec4 instanceFillColors;
in vec4 instanceLineColors;
in vec3 instancePickingColors;
in float instanceRadius;

out vec4 vFillColor;
out vec4 vLineColor;
out float vLineWidth;
out vec2 uv;
out vec2 dimensions;

#ifdef MODULE_COLLISION
vec2 labeledScatterplotCollisionRectMin;
vec2 labeledScatterplotCollisionRectMax;
vec2 labeledScatterplotCollisionTotalOffset;
float labeledScatterplotCollisionAngle;
#endif

vec2 rotate_by_angle(vec2 vertex, float angle) {
  float angle_radian = radians(angle);
  float cos_angle = cos(angle_radian);
  float sin_angle = sin(angle_radian);
  mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
  return rotationMatrix * vertex;
}

#ifdef MODULE_COLLISION
vec2 labeledScatterplot_getCollisionTexCoords(vec2 pixelOffset) {
  vec4 clipPosition = project_position_to_clipspace(
    instancePositions,
    instancePositions64Low,
    vec3(0.0),
    geometry.position
  );
  vec2 anchorTexCoords = (1.0 + clipPosition.xy / clipPosition.w) / 2.0;
  vec2 collisionTextureSize = vec2(textureSize(collision_texture, 0));
  return anchorTexCoords + vec2(pixelOffset.x, -pixelOffset.y) / collisionTextureSize;
}

float labeledScatterplot_collisionOwnsSample(vec2 samplePoint, vec3 pickingColor) {
  return collision_match(
    labeledScatterplot_getCollisionTexCoords(
      rotate_by_angle(samplePoint, labeledScatterplotCollisionAngle) +
        labeledScatterplotCollisionTotalOffset
    ),
    pickingColor
  );
}

float labeledScatterplot_collisionIsVisible(vec3 pickingColor) {
  vec2 sampleMin = labeledScatterplotCollisionRectMin;
  vec2 sampleMax = labeledScatterplotCollisionRectMax;

  if (sampleMax.x < sampleMin.x) {
    float midX = (labeledScatterplotCollisionRectMin.x + labeledScatterplotCollisionRectMax.x) * 0.5;
    sampleMin.x = midX;
    sampleMax.x = midX;
  }
  if (sampleMax.y < sampleMin.y) {
    float midY = (labeledScatterplotCollisionRectMin.y + labeledScatterplotCollisionRectMax.y) * 0.5;
    sampleMin.y = midY;
    sampleMax.y = midY;
  }

  vec2 cornerInset = min(sampleMax - sampleMin, vec2(1.0)) * 0.5;
  vec2 cornerMin = sampleMin + cornerInset;
  vec2 cornerMax = sampleMax - cornerInset;
  vec2 corner0 = cornerMin;
  vec2 corner1 = vec2(cornerMax.x, cornerMin.y);
  vec2 corner2 = vec2(cornerMin.x, cornerMax.y);
  vec2 corner3 = cornerMax;

  return min(
    min(
      labeledScatterplot_collisionOwnsSample(corner0, pickingColor),
      labeledScatterplot_collisionOwnsSample(corner1, pickingColor)
    ),
    min(
      labeledScatterplot_collisionOwnsSample(corner2, pickingColor),
      labeledScatterplot_collisionOwnsSample(corner3, pickingColor)
    )
  );
}
#endif

void main(void) {
  geometry.worldPosition = instancePositions;
  geometry.uv = positions;
  geometry.pickingColor = instancePickingColors;
  uv = positions;
  vLineWidth = instanceLineWidths;

  float sizePixels = clamp(
    project_size_to_pixel(instanceSizes * textBackground.sizeScale, textBackground.sizeUnits),
    textBackground.sizeMinPixels, textBackground.sizeMaxPixels
  );

  vec2 labelPixelOffset = labeledScatterplot_getPixelOffset(instanceRadius);
  vec2 totalPixelOffset = instancePixelOffsets + labelPixelOffset;
  vec2 totalPixelOffsetScreen = vec2(totalPixelOffset.x, -totalPixelOffset.y);

#ifdef MODULE_COLLISION
  float collisionBoxSizePixels = labeledScatterplot_getLabelBoxSizePixels(instanceSizes);
  labeledScatterplotCollisionRectMin =
    instanceRects.xy * collisionBoxSizePixels - labeledScatterplotLabel.collisionPadding.xy;
  labeledScatterplotCollisionRectMax =
    (instanceRects.xy + instanceRects.zw) * collisionBoxSizePixels +
    labeledScatterplotLabel.collisionPadding.zw;
  labeledScatterplotCollisionTotalOffset = totalPixelOffset;
  labeledScatterplotCollisionAngle = instanceAngles;
  collision_fade_override = labeledScatterplot_collisionIsVisible(geometry.pickingColor / 255.0);
#endif

  dimensions = instanceRects.zw * sizePixels + textBackground.padding.xy + textBackground.padding.zw;

  vec2 pixelOffset =
    (positions * instanceRects.zw + instanceRects.xy) * sizePixels +
    mix(-textBackground.padding.xy, textBackground.padding.zw, positions);
  pixelOffset = rotate_by_angle(pixelOffset, instanceAngles);
  pixelOffset += totalPixelOffset;
  pixelOffset.y *= -1.0;

  vec2 xy = project_size_to_pixel(instanceClipRect.xy);
  vec2 wh = project_size_to_pixel(instanceClipRect.zw);
  if (text.flipY) {
    xy.y = -xy.y - wh.y;
  }
  if (instanceClipRect.z >= 0.0) {
    dimensions.x = wh.x;
    pixelOffset.x =
      totalPixelOffsetScreen.x +
      xy.x +
      uv.x * wh.x +
      mix(-textBackground.padding.x, textBackground.padding.z, uv.x);
  }
  if (instanceClipRect.w >= 0.0) {
    dimensions.y = wh.y;
    pixelOffset.y =
      totalPixelOffsetScreen.y +
      xy.y +
      uv.y * wh.y +
      mix(-textBackground.padding.y, textBackground.padding.w, uv.y);
  }

  if (textBackground.billboard) {
    gl_Position = project_position_to_clipspace(
      instancePositions,
      instancePositions64Low,
      vec3(0.0),
      geometry.position
    );
    DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
    vec3 offset = vec3(pixelOffset, 0.0);
    DECKGL_FILTER_SIZE(offset, geometry);
    gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
  } else {
    vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
    if (text.flipY) {
      offset_common.y *= -1.0;
    }
    DECKGL_FILTER_SIZE(offset_common, geometry);
    gl_Position = project_position_to_clipspace(
      instancePositions,
      instancePositions64Low,
      offset_common,
      geometry.position
    );
    DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
  }

  vFillColor = vec4(instanceFillColors.rgb, instanceFillColors.a * layer.opacity);
  DECKGL_FILTER_COLOR(vFillColor, geometry);
  vLineColor = vec4(instanceLineColors.rgb, instanceLineColors.a * layer.opacity);
  DECKGL_FILTER_COLOR(vLineColor, geometry);
}
`;
