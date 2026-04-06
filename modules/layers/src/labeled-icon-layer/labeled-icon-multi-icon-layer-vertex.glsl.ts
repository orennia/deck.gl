// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

export default /* glsl */ `\
#version 300 es
#define SHADER_NAME labeled-icon-multi-icon-layer-vertex-shader

in vec2 positions;

in vec3 instancePositions;
in vec3 instancePositions64Low;
in float instanceSizes;
in float instanceAngles;
in vec4 instanceColors;
in vec3 instancePickingColors;
in vec4 instanceIconFrames;
in float instanceColorModes;
in vec2 instanceOffsets;
in vec2 instancePixelOffset;
in vec4 instanceClipRect;
in vec4 instanceRects;
in vec4 instancePointPlacements;

out float vColorMode;
out vec4 vColor;
out vec2 vTextureCoords;
out vec2 uv;

#ifdef MODULE_COLLISION
vec2 labeledIconCollisionRectMin;
vec2 labeledIconCollisionRectMax;
vec2 labeledIconCollisionTotalOffset;
float labeledIconCollisionAngle;
#endif

vec2 rotate_by_angle(vec2 vertex, float angle) {
  float angle_radian = angle * PI / 180.0;
  float cos_angle = cos(angle_radian);
  float sin_angle = sin(angle_radian);
  mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
  return rotationMatrix * vertex;
}

float getPixelOffsetFromAlignment(
  float anchor,
  float extent,
  float clipStart,
  float clipEnd,
  int mode
) {
  if (clipEnd < clipStart) return 0.0;
  if (mode == ALIGN_MODE_START) {
    return max(-(anchor + clipStart), 0.0);
  }
  if (mode == ALIGN_MODE_CENTER) {
    float _min = max(0.0, anchor + clipStart);
    float _max = min(extent, anchor + clipEnd);
    return _min < _max ? (_min + _max) / 2.0 - anchor : 0.0;
  }
  if (mode == ALIGN_MODE_END) {
    return min(extent - (anchor + clipEnd), 0.0);
  }
  return 0.0;
}

#ifdef MODULE_COLLISION
vec2 labeledIcon_getCollisionTexCoords(vec2 pixelOffset) {
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

float labeledIcon_collisionOwnsSample(vec2 samplePoint, vec3 pickingColor) {
  return collision_match(
    labeledIcon_getCollisionTexCoords(
      rotate_by_angle(samplePoint, labeledIconCollisionAngle) + labeledIconCollisionTotalOffset
    ),
    pickingColor
  );
}

float labeledIcon_collisionIsVisible(vec3 pickingColor) {
  vec2 sampleMin = labeledIconCollisionRectMin;
  vec2 sampleMax = labeledIconCollisionRectMax;

  if (sampleMax.x < sampleMin.x) {
    float midX = (labeledIconCollisionRectMin.x + labeledIconCollisionRectMax.x) * 0.5;
    sampleMin.x = midX;
    sampleMax.x = midX;
  }
  if (sampleMax.y < sampleMin.y) {
    float midY = (labeledIconCollisionRectMin.y + labeledIconCollisionRectMax.y) * 0.5;
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
    min(labeledIcon_collisionOwnsSample(corner0, pickingColor), labeledIcon_collisionOwnsSample(corner1, pickingColor)),
    min(labeledIcon_collisionOwnsSample(corner2, pickingColor), labeledIcon_collisionOwnsSample(corner3, pickingColor))
  );
}
#endif

void main(void) {
  geometry.worldPosition = instancePositions;
  geometry.uv = positions;
  geometry.pickingColor = instancePickingColors;
  uv = positions;

  vec2 iconSize = instanceIconFrames.zw;
  float sizePixels = clamp(
    project_size_to_pixel(instanceSizes * icon.sizeScale, icon.sizeUnits),
    icon.sizeMinPixels,
    icon.sizeMaxPixels
  );

  float iconConstraint = icon.sizeBasis == 0.0 ? iconSize.x : iconSize.y;
  float instanceScale = iconConstraint == 0.0 ? 0.0 : sizePixels / iconConstraint;
  vec2 labelPixelOffset = labeledIcon_getPixelOffset(
    instancePointPlacements.x,
    instancePointPlacements.yzw
  );

#ifdef MODULE_COLLISION
  float collisionBoxSizePixels = labeledIcon_getLabelBoxSizePixels(instanceSizes);
  labeledIconCollisionRectMin = vec2(
    instanceRects.x * collisionBoxSizePixels - labeledIconLabel.collisionPadding.x,
    instanceRects.y * collisionBoxSizePixels - labeledIconLabel.collisionPadding.y
  );
  labeledIconCollisionRectMax = vec2(
    (instanceRects.x + instanceRects.z) * collisionBoxSizePixels +
      labeledIconLabel.collisionPadding.z,
    (instanceRects.y + instanceRects.w) * collisionBoxSizePixels +
      labeledIconLabel.collisionPadding.w
  );
  labeledIconCollisionTotalOffset = instancePixelOffset + labelPixelOffset;
  labeledIconCollisionAngle = instanceAngles;
  collision_fade_override = labeledIcon_collisionIsVisible(geometry.pickingColor / 255.0);
#endif

  vec2 pixelOffset = positions / 2.0 * iconSize + instanceOffsets;
  pixelOffset = rotate_by_angle(pixelOffset, instanceAngles) * instanceScale;
#ifdef MODULE_COLLISION
  pixelOffset += labeledIconCollisionTotalOffset;
#else
  pixelOffset += instancePixelOffset + labelPixelOffset;
#endif
  pixelOffset.y *= -1.0;

  vec2 anchorPosScreen;
  if (icon.billboard) {
    gl_Position = project_position_to_clipspace(
      instancePositions,
      instancePositions64Low,
      vec3(0.0),
      geometry.position
    );
    anchorPosScreen = gl_Position.xy / gl_Position.w;
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
    vec4 anchorPos = project_position_to_clipspace(
      instancePositions,
      instancePositions64Low,
      vec3(0.0)
    );
    anchorPosScreen = anchorPos.xy / anchorPos.w;
    gl_Position = project_position_to_clipspace(
      instancePositions,
      instancePositions64Low,
      offset_common,
      geometry.position
    );
    DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
  }

  anchorPosScreen =
    vec2(anchorPosScreen.x + 1.0, 1.0 - anchorPosScreen.y) / 2.0 *
    project.viewportSize /
    project.devicePixelRatio;
  vec2 xy = project_size_to_pixel(instanceClipRect.xy);
  vec2 wh = project_size_to_pixel(instanceClipRect.zw);
  if (text.flipY) {
    xy.y = -xy.y - wh.y;
  }
  if (text.align.x > 0 || text.align.y > 0) {
    vec2 viewportPixels = project.viewportSize / project.devicePixelRatio;
    vec2 scrollPixels = vec2(
      getPixelOffsetFromAlignment(anchorPosScreen.x, viewportPixels.x, xy.x, xy.x + wh.x, text.align.x),
      -getPixelOffsetFromAlignment(anchorPosScreen.y, viewportPixels.y, -xy.y - wh.y, -xy.y, text.align.y)
    );
    pixelOffset += scrollPixels;
    gl_Position.xy += project_pixel_size_to_clipspace(scrollPixels);
  }

  if (instanceClipRect.z >= 0.0) {
    if (pixelOffset.x < xy.x || pixelOffset.x > xy.x + wh.x) {
      gl_Position = vec4(0.0);
    } else if (text.cutoffPixels.x > 0.0) {
      float vpWidth = project.viewportSize.x / project.devicePixelRatio;
      float l = max(anchorPosScreen.x + xy.x, 0.0);
      float r = min(anchorPosScreen.x + xy.x + wh.x, vpWidth);
      if (r - l < text.cutoffPixels.x) {
        gl_Position = vec4(0.0);
      }
    }
  }
  if (instanceClipRect.w >= 0.0) {
    if (pixelOffset.y < xy.y || pixelOffset.y > xy.y + wh.y) {
      gl_Position = vec4(0.0);
    } else if (text.cutoffPixels.y > 0.0) {
      float vpHeight = project.viewportSize.y / project.devicePixelRatio;
      float t = max(anchorPosScreen.y - xy.y - wh.y, 0.0);
      float b = min(anchorPosScreen.y - xy.y, vpHeight);
      if (b - t < text.cutoffPixels.y) {
        gl_Position = vec4(0.0);
      }
    }
  }

  vTextureCoords =
    mix(instanceIconFrames.xy, instanceIconFrames.xy + iconSize, (positions.xy + 1.0) / 2.0) /
    icon.iconsTextureDim;

  vColor = instanceColors;
  DECKGL_FILTER_COLOR(vColor, geometry);

  vColorMode = instanceColorModes;
}
`;
