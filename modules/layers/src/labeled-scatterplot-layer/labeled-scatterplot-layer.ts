// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {CompositeLayer, Layer, UNIT, picking, project32} from '@deck.gl/core';

import ScatterplotLayer from '../scatterplot-layer/scatterplot-layer';
import TextLayer from '../text-layer/text-layer';
import MultiIconLayer from '../text-layer/multi-icon-layer/multi-icon-layer';
import TextBackgroundLayer from '../text-layer/text-background-layer/text-background-layer';
import {DEFAULT_FONT_SETTINGS} from '../text-layer/font-atlas-manager';
import {textBackgroundUniforms} from '../text-layer/text-background-layer/text-background-layer-uniforms';
import {textUniforms} from '../text-layer/text-uniforms';
import textBackgroundFs from '../text-layer/text-background-layer/text-background-layer-fragment.glsl';
import multiIconFs from '../text-layer/multi-icon-layer/multi-icon-layer-fragment.glsl';
import {transformParagraph} from '../text-layer/utils';
import {scatterplotUniforms} from '../scatterplot-layer/scatterplot-layer-uniforms';
import labeledScatterplotTextBackgroundVs from './labeled-scatterplot-text-background-layer-vertex.glsl';
import labeledScatterplotCollisionTextBackgroundVs from './labeled-scatterplot-collision-text-background-layer-vertex.glsl';
import labeledScatterplotMultiIconVs from './labeled-scatterplot-multi-icon-layer-vertex.glsl';
import {labeledScatterplotLabelUniforms} from './labeled-scatterplot-label-uniforms';

import type {
  Accessor,
  AccessorContext,
  AccessorFunction,
  Color,
  DefaultProps,
  LayerDataSource,
  LayerProps,
  LayersList,
  Position,
  Unit
} from '@deck.gl/core';
import type {ScatterplotLayerProps} from '../scatterplot-layer/scatterplot-layer';
import type {TextLayerProps} from '../text-layer/text-layer';
import type {TextBackgroundProps} from '../text-layer/text-background-layer/text-background-layer-uniforms';
import type {TextModuleProps} from '../text-layer/text-uniforms';
import type {ScatterplotProps} from '../scatterplot-layer/scatterplot-layer-uniforms';
import type {LabeledScatterplotLabelProps} from './labeled-scatterplot-label-uniforms';

const scatterDefaultProps = {...ScatterplotLayer.defaultProps};
delete scatterDefaultProps.billboard;
const textDefaultProps = {...TextLayer.defaultProps};
delete textDefaultProps.billboard;
const collisionDefaultProps = {
  getCollisionPriority: {type: 'accessor', value: 0},
  collisionEnabled: true,
  collisionGroup: 'default',
  collisionTestProps: {}
} as const;

const TEXT_ANCHOR = {
  start: 1,
  middle: 0,
  end: -1
} as const;

const ALIGNMENT_BASELINE = {
  top: 1,
  center: 0,
  bottom: -1
} as const;

type ContentBox = [x: number, y: number, width: number, height: number];
type BoundingRect = Readonly<[number, number, number, number]>;
type TextDataWithAttributes = {
  length: number;
  attributes?: {
    background?: Record<string, unknown>;
    instancePickingColors?: unknown;
  } & Record<string, unknown>;
} & Record<string, unknown>;
type CollisionTestProps = {
  backgroundPadding?: Readonly<[number, number]> | Readonly<[number, number, number, number]>;
  backgroundBorderRadius?: number | Readonly<[number, number, number, number]>;
  getContentBox?: Accessor<unknown, BoundingRect>;
  padding?: Readonly<[number, number]> | Readonly<[number, number, number, number]>;
  borderRadius?: number | Readonly<[number, number, number, number]>;
  getClipRect?: Accessor<unknown, BoundingRect>;
  sizeScale?: number;
  sizeUnits?: Unit;
  sizeMinPixels?: number;
  sizeMaxPixels?: number;
} & Record<string, unknown>;

export type LabeledScatterplotCollisionProps<DataT> = {
  getCollisionPriority?: Accessor<DataT, number>;
  collisionEnabled?: boolean;
  collisionGroup?: string;
  collisionTestProps?: CollisionTestProps;
};

type LabeledScatterplotPlacementProps<DataT> = {
  getRadius?: Accessor<DataT, number>;
  radiusUnits?: Unit;
  radiusScale?: number;
  radiusMinPixels?: number;
  radiusMaxPixels?: number;
  labelPosition?: 'top' | 'bottom';
  labelPadding?: number;
};

type LabeledScatterplotBillboardProps = {
  pointBillboard?: boolean | null;
  textBillboard?: boolean | null;
};

type LabeledScatterplotTextLayerProps<DataT> = Omit<TextLayerProps<DataT>, 'billboard'> &
  LabeledScatterplotCollisionProps<DataT> &
  LabeledScatterplotPlacementProps<DataT> & {
    getContentBox?: Accessor<DataT, ContentBox>;
    contentCutoffPixels?: NonNullable<TextModuleProps['contentCutoffPixels']>;
    contentAlignHorizontal?: TextModuleProps['contentAlignHorizontal'];
    contentAlignVertical?: TextModuleProps['contentAlignVertical'];
  };

type LabeledScatterplotTextSubLayerProps<DataT> = LabeledScatterplotPlacementProps<DataT> & {
  data: LayerDataSource<DataT>;
  boxSizeScale?: number;
  boxSizeUnits?: Unit;
  boxSizeMinPixels?: number;
  boxSizeMaxPixels?: number;
  billboard?: boolean;
  sizeScale?: number;
  sizeUnits?: Unit;
  sizeMinPixels?: number;
  sizeMaxPixels?: number;
  getPosition?: Accessor<DataT, Position>;
  getSize?: Accessor<DataT, number>;
  getAngle?: Accessor<DataT, number>;
  getPixelOffset?: Accessor<DataT, Readonly<[number, number]>>;
  backgroundPadding?: Readonly<[number, number]> | Readonly<[number, number, number, number]>;
  getContentBox?: Accessor<DataT, ContentBox>;
  getBoundingRect?: Accessor<DataT, BoundingRect>;
};

type LabeledScatterplotTextBackgroundLayerProps<DataT> =
  LabeledScatterplotTextSubLayerProps<DataT> & {
    borderRadius?: number | Readonly<[number, number, number, number]>;
    padding?: Readonly<[number, number]> | Readonly<[number, number, number, number]>;
    getClipRect?: Accessor<DataT, BoundingRect>;
    getBoundingRect?: Accessor<DataT, BoundingRect>;
    getFillColor?: Accessor<DataT, Color>;
    getLineColor?: Accessor<DataT, Color>;
    getLineWidth?: Accessor<DataT, number>;
  };

type LabeledScatterplotMultiIconLayerProps<DataT> = LabeledScatterplotTextSubLayerProps<DataT> &
  LayerProps & {
    contentCutoffPixels?: NonNullable<TextModuleProps['contentCutoffPixels']>;
    contentAlignHorizontal?: TextModuleProps['contentAlignHorizontal'];
    contentAlignVertical?: TextModuleProps['contentAlignVertical'];
  };

export type LabeledScatterplotLayerProps<DataT = unknown> = Omit<
  ScatterplotLayerProps<DataT>,
  'billboard'
> &
  Omit<TextLayerProps<DataT>, 'billboard'> & {
    getContentBox?: Accessor<DataT, ContentBox>;
    contentCutoffPixels?: NonNullable<TextModuleProps['contentCutoffPixels']>;
    contentAlignHorizontal?: TextModuleProps['contentAlignHorizontal'];
    contentAlignVertical?: TextModuleProps['contentAlignVertical'];
  } & LabeledScatterplotCollisionProps<DataT> &
  LabeledScatterplotBillboardProps & {
    labelPosition?: 'top' | 'bottom';
    labelPadding?: number;
  };

const defaultProps: DefaultProps<LabeledScatterplotLayerProps> = {
  ...scatterDefaultProps,
  ...textDefaultProps,
  ...collisionDefaultProps,
  labelPosition: 'top',
  labelPadding: {type: 'number', min: 0, value: 4},
  pointBillboard: false,
  textBillboard: true
};

function getScatterplotShaderProps<DataT>(
  props: LabeledScatterplotPlacementProps<DataT>
): ScatterplotProps {
  return {
    radiusUnits: UNIT[props.radiusUnits ?? 'pixels'],
    radiusScale: props.radiusScale ?? 1,
    radiusMinPixels: props.radiusMinPixels ?? 0,
    radiusMaxPixels: props.radiusMaxPixels ?? Number.MAX_SAFE_INTEGER,
    lineWidthUnits: UNIT.pixels,
    lineWidthScale: 0,
    lineWidthMinPixels: 0,
    lineWidthMaxPixels: 0,
    stroked: false,
    filled: true,
    antialiasing: false,
    billboard: false
  };
}

function getLabelPlacementProps<DataT>(
  props: LabeledScatterplotPlacementProps<DataT> & {
    boxSizeScale?: number;
    boxSizeUnits?: Unit;
    boxSizeMinPixels?: number;
    boxSizeMaxPixels?: number;
    sizeScale?: number;
    sizeUnits?: Unit;
    sizeMinPixels?: number;
    sizeMaxPixels?: number;
    backgroundPadding?: Readonly<[number, number]> | Readonly<[number, number, number, number]>;
  }
): LabeledScatterplotLabelProps {
  const backgroundPadding = props.backgroundPadding ?? [0, 0, 0, 0];
  const collisionPadding =
    backgroundPadding.length < 4
      ? [backgroundPadding[0], backgroundPadding[1], backgroundPadding[0], backgroundPadding[1]]
      : [...backgroundPadding];

  return {
    padding: props.labelPadding ?? 4,
    // Text pixel offsets use screen coordinates where positive y moves downward.
    direction: props.labelPosition === 'bottom' ? 1 : -1,
    boxSizeScale: props.boxSizeScale ?? props.sizeScale ?? 1,
    boxSizeUnits: UNIT[props.boxSizeUnits ?? props.radiusUnits ?? props.sizeUnits ?? 'pixels'],
    boxSizeMinPixels: props.boxSizeMinPixels ?? props.sizeMinPixels ?? 0,
    boxSizeMaxPixels: props.boxSizeMaxPixels ?? props.sizeMaxPixels ?? Number.MAX_SAFE_INTEGER,
    collisionPadding: collisionPadding as [number, number, number, number]
  };
}

function filterCollisionExtensions(extensions: LayerProps['extensions'] = []) {
  return extensions.filter(
    extension =>
      ((extension as {extensionName?: string}).extensionName ??
        (extension.constructor as {extensionName?: string}).extensionName) !==
      'CollisionFilterExtension'
  );
}

function mapCollisionTestProps(collisionTestProps: CollisionTestProps | undefined) {
  if (!collisionTestProps) {
    return collisionTestProps;
  }

  const mappedProps = {...collisionTestProps};
  if ('backgroundPadding' in collisionTestProps) {
    mappedProps.padding = collisionTestProps.backgroundPadding;
    delete mappedProps.backgroundPadding;
  }
  if ('backgroundBorderRadius' in collisionTestProps) {
    mappedProps.borderRadius = collisionTestProps.backgroundBorderRadius;
    delete mappedProps.backgroundBorderRadius;
  }
  if ('getContentBox' in collisionTestProps) {
    mappedProps.getClipRect = collisionTestProps.getContentBox;
    delete mappedProps.getContentBox;
  }
  return mappedProps;
}

class BaseLabeledScatterplotTextBackgroundLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends TextBackgroundLayer<
  DataT,
  ExtraPropsT & Required<LabeledScatterplotTextBackgroundLayerProps<DataT>>
> {
  getShaders() {
    return Layer.prototype.getShaders.call(this, {
      vs: this.getVertexShader(),
      fs: textBackgroundFs,
      modules: [
        project32,
        picking,
        textBackgroundUniforms,
        textUniforms,
        scatterplotUniforms,
        labeledScatterplotLabelUniforms
      ]
    });
  }

  initializeState() {
    super.initializeState();
    const attributeManager = this.getAttributeManager();
    if (!attributeManager) {
      return;
    }

    attributeManager.addInstanced({
      instanceClipRect: {
        size: 4,
        accessor: 'getClipRect',
        defaultValue: [-1, -1, -1, -1]
      },
      instanceRadius: {
        size: 1,
        transition: true,
        accessor: 'getRadius',
        defaultValue: 1
      }
    });
  }

  draw() {
    const {billboard, sizeScale, sizeUnits, sizeMinPixels, sizeMaxPixels, getLineWidth} =
      this.props;
    let {padding, borderRadius} = this.props;

    if (padding.length < 4) {
      padding = [padding[0], padding[1], padding[0], padding[1]];
    }

    if (!Array.isArray(borderRadius)) {
      borderRadius = [
        borderRadius as number,
        borderRadius as number,
        borderRadius as number,
        borderRadius as number
      ];
    }

    const model = this.state.model;
    if (!model) {
      return;
    }

    const textBackgroundProps: TextBackgroundProps = {
      billboard,
      stroked: Boolean(getLineWidth),
      borderRadius: borderRadius as [number, number, number, number],
      padding: padding as [number, number, number, number],
      sizeUnits: UNIT[sizeUnits],
      sizeScale,
      sizeMinPixels,
      sizeMaxPixels
    };
    const textProps: TextModuleProps = {
      viewport: this.context.viewport
    };
    model.shaderInputs.setProps({
      textBackground: textBackgroundProps,
      text: textProps,
      scatterplot: getScatterplotShaderProps(this.props),
      labeledScatterplotLabel: getLabelPlacementProps(this.props)
    });
    model.draw(this.context.renderPass);
  }

  protected getVertexShader() {
    return labeledScatterplotTextBackgroundVs;
  }
}

class LabeledScatterplotTextBackgroundLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends BaseLabeledScatterplotTextBackgroundLayer<DataT, ExtraPropsT> {
  static layerName = 'LabeledScatterplotTextBackgroundLayer';
}

class LabeledScatterplotCollisionTextBackgroundLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends BaseLabeledScatterplotTextBackgroundLayer<DataT, ExtraPropsT> {
  static layerName = 'LabeledScatterplotCollisionTextBackgroundLayer';

  protected getVertexShader() {
    return labeledScatterplotCollisionTextBackgroundVs;
  }
}

class LabeledScatterplotMultiIconLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends MultiIconLayer<
  DataT,
  ExtraPropsT & Required<LabeledScatterplotMultiIconLayerProps<DataT>>
> {
  static layerName = 'LabeledScatterplotMultiIconLayer';

  getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      modules: [
        ...shaders.modules,
        textUniforms,
        scatterplotUniforms,
        labeledScatterplotLabelUniforms
      ],
      vs: labeledScatterplotMultiIconVs,
      fs: multiIconFs
    };
  }

  initializeState() {
    super.initializeState();
    const attributeManager = this.getAttributeManager();
    if (!attributeManager) {
      return;
    }

    attributeManager.addInstanced({
      instanceClipRect: {
        size: 4,
        accessor: 'getContentBox',
        defaultValue: [-1, -1, -1, -1]
      },
      instanceRadius: {
        size: 1,
        transition: true,
        accessor: 'getRadius',
        defaultValue: 1
      },
      instanceBoundingRects: {
        size: 4,
        accessor: 'getBoundingRect',
        defaultValue: [0, 0, 0, 0]
      }
    });
  }

  draw(params) {
    const model = this.state.model;
    if (!model) {
      return;
    }

    const textProps: TextModuleProps = {
      contentCutoffPixels: this.props.contentCutoffPixels,
      contentAlignHorizontal: this.props.contentAlignHorizontal,
      contentAlignVertical: this.props.contentAlignVertical,
      viewport: this.context.viewport
    };
    model.shaderInputs.setProps({
      text: textProps,
      scatterplot: getScatterplotShaderProps(this.props),
      labeledScatterplotLabel: getLabelPlacementProps(this.props)
    });
    super.draw(params);
  }
}

class LabeledScatterplotTextLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends TextLayer<DataT, ExtraPropsT & Required<LabeledScatterplotTextLayerProps<DataT>>> {
  static layerName = 'LabeledScatterplotTextLayer';
  static defaultProps = {
    ...TextLayer.defaultProps,
    ...collisionDefaultProps,
    getRadius: {type: 'accessor', value: 1},
    radiusUnits: 'pixels',
    radiusScale: {type: 'number', min: 0, value: 1},
    radiusMinPixels: {type: 'number', min: 0, value: 0},
    radiusMaxPixels: {type: 'number', min: 0, value: Number.MAX_SAFE_INTEGER},
    labelPosition: 'top',
    labelPadding: {type: 'number', min: 0, value: 4}
  };

  filterSubLayer({layer, renderPass}) {
    if (layer.id.endsWith('collision-background')) {
      return renderPass === 'collision';
    }

    return renderPass !== 'collision';
  }

  private _transformParagraph(
    object: DataT,
    objectInfo: AccessorContext<DataT>
  ): ReturnType<typeof transformParagraph> {
    const {fontAtlasManager, getText} = this.state;
    const {wordBreak, lineHeight, maxWidth} = this.props;
    const iconMapping = fontAtlasManager.mapping;
    if (!iconMapping) {
      return transformParagraph(
        '',
        lineHeight,
        wordBreak,
        maxWidth * fontAtlasManager.props.fontSize,
        {}
      );
    }

    const paragraph = getText?.(object, objectInfo) || '';
    return transformParagraph(
      paragraph,
      lineHeight,
      wordBreak,
      maxWidth * fontAtlasManager.props.fontSize,
      iconMapping
    );
  }

  private _getBoundingRectForLabel: AccessorFunction<DataT, [number, number, number, number]> = (
    object,
    objectInfo
  ) => {
    let {
      size: [width, height]
    } = this._transformParagraph(object, objectInfo);
    const {fontSize} = this.state.fontAtlasManager.props;
    width /= fontSize;
    height /= fontSize;

    const {getTextAnchor, getAlignmentBaseline} = this.props;
    const anchorX =
      TEXT_ANCHOR[
        typeof getTextAnchor === 'function' ? getTextAnchor(object, objectInfo) : getTextAnchor
      ];
    const anchorY =
      ALIGNMENT_BASELINE[
        typeof getAlignmentBaseline === 'function'
          ? getAlignmentBaseline(object, objectInfo)
          : getAlignmentBaseline
      ];

    return [((anchorX - 1) * width) / 2, ((anchorY - 1) * height) / 2, width, height];
  };

  private _getIconOffsetsForLabel: AccessorFunction<DataT, number[]> = (object, objectInfo) => {
    const {getTextAnchor, getAlignmentBaseline} = this.props;
    const {
      x,
      y,
      rowWidth,
      size: [width, height]
    } = this._transformParagraph(object, objectInfo);
    const anchorX =
      TEXT_ANCHOR[
        typeof getTextAnchor === 'function' ? getTextAnchor(object, objectInfo) : getTextAnchor
      ];
    const anchorY =
      ALIGNMENT_BASELINE[
        typeof getAlignmentBaseline === 'function'
          ? getAlignmentBaseline(object, objectInfo)
          : getAlignmentBaseline
      ];

    const numCharacters = x.length;
    const offsets = new Array(numCharacters * 2);
    let index = 0;

    for (let i = 0; i < numCharacters; i++) {
      const rowOffset = ((1 - anchorX) * (width - rowWidth[i])) / 2;
      offsets[index++] = ((anchorX - 1) * width) / 2 + rowOffset + x[i];
      offsets[index++] = ((anchorY - 1) * height) / 2 + y[i];
    }
    return offsets;
  };

  renderLayers() {
    const {
      startIndices,
      numInstances,
      getText,
      fontAtlasManager: {scale, atlas, mapping},
      styleVersion
    } = this.state;

    const {
      data,
      _dataDiff,
      getPosition,
      getColor,
      getSize,
      getAngle,
      getPixelOffset,
      getBackgroundColor,
      getBorderColor,
      getBorderWidth,
      getContentBox,
      backgroundBorderRadius,
      backgroundPadding,
      background,
      billboard,
      fontSettings,
      outlineWidth,
      outlineColor,
      sizeScale,
      sizeUnits,
      sizeMinPixels,
      sizeMaxPixels,
      contentCutoffPixels,
      contentAlignHorizontal,
      contentAlignVertical,
      collisionEnabled,
      collisionGroup,
      getCollisionPriority,
      transitions,
      updateTriggers,
      getRadius,
      radiusUnits,
      radiusScale,
      radiusMinPixels,
      radiusMaxPixels,
      labelPosition,
      labelPadding
    } = this.props;
    const getBoundingRect = this._getBoundingRectForLabel;
    const getIconOffsets = this._getIconOffsetsForLabel;
    const collisionTestProps = mapCollisionTestProps(this.props.collisionTestProps);
    const dataWithAttributes = data as TextDataWithAttributes;

    const CharactersLayerClass = this.getSubLayerClass(
      'characters',
      LabeledScatterplotMultiIconLayer
    );
    const BackgroundLayerClass = this.getSubLayerClass(
      'background',
      LabeledScatterplotTextBackgroundLayer
    );
    const CollisionBackgroundLayerClass = this.getSubLayerClass(
      'collision-background',
      LabeledScatterplotCollisionTextBackgroundLayer
    );

    const placementProps = {
      getRadius,
      radiusUnits,
      radiusScale,
      radiusMinPixels,
      radiusMaxPixels,
      labelPosition,
      labelPadding,
      backgroundPadding: collisionTestProps?.padding ?? backgroundPadding,
      boxSizeScale: collisionTestProps?.sizeScale ?? sizeScale,
      boxSizeUnits: collisionTestProps?.sizeUnits ?? radiusUnits ?? sizeUnits,
      boxSizeMinPixels: collisionTestProps?.sizeMinPixels ?? sizeMinPixels,
      boxSizeMaxPixels: collisionTestProps?.sizeMaxPixels ?? sizeMaxPixels
    };

    return [
      background &&
        new BackgroundLayerClass(
          {
            getFillColor: getBackgroundColor,
            getLineColor: getBorderColor,
            getLineWidth: getBorderWidth,
            borderRadius: backgroundBorderRadius,
            padding: backgroundPadding,

            getPosition,
            getSize,
            getAngle,
            getPixelOffset,
            collisionEnabled,
            collisionGroup,
            getCollisionPriority,
            getClipRect: getContentBox,
            billboard,
            sizeScale,
            sizeUnits,
            sizeMinPixels,
            sizeMaxPixels,
            ...placementProps,

            transitions: transitions && {
              getPosition: transitions.getPosition,
              getAngle: transitions.getAngle,
              getSize: transitions.getSize,
              getFillColor: transitions.getBackgroundColor,
              getLineColor: transitions.getBorderColor,
              getLineWidth: transitions.getBorderWidth,
              getPixelOffset: transitions.getPixelOffset,
              getRadius: transitions.getRadius
            }
          },
          this.getSubLayerProps({
            id: 'background',
            updateTriggers: {
              getPosition: updateTriggers.getPosition,
              getAngle: updateTriggers.getAngle,
              getSize: updateTriggers.getSize,
              getFillColor: updateTriggers.getBackgroundColor,
              getLineColor: updateTriggers.getBorderColor,
              getLineWidth: updateTriggers.getBorderWidth,
              getClipRect: updateTriggers.getContentBox,
              getPixelOffset: updateTriggers.getPixelOffset ?? getPixelOffset,
              getRadius: updateTriggers.getRadius,
              getBoundingRect: {
                getText: updateTriggers.getText,
                getTextAnchor: updateTriggers.getTextAnchor,
                getAlignmentBaseline: updateTriggers.getAlignmentBaseline,
                styleVersion
              }
            }
          }),
          {
            data: dataWithAttributes.attributes?.background
              ? {
                  length: dataWithAttributes.length,
                  attributes: dataWithAttributes.attributes.background
                }
              : data,
            _dataDiff,
            autoHighlight: false,
            getBoundingRect
          }
        ),
      new CollisionBackgroundLayerClass(
        {
          getPosition,
          getSize,
          getAngle,
          getPixelOffset,
          collisionEnabled,
          collisionGroup,
          getCollisionPriority,
          getClipRect: getContentBox,
          borderRadius: backgroundBorderRadius,
          padding: backgroundPadding,
          billboard,
          sizeScale,
          sizeUnits,
          sizeMinPixels,
          sizeMaxPixels,
          ...placementProps
        },
        this.getSubLayerProps({
          id: 'collision-background',
          updateTriggers: {
            getPosition: updateTriggers.getPosition,
            getAngle: updateTriggers.getAngle,
            getSize: updateTriggers.getSize,
            getClipRect: updateTriggers.getContentBox,
            getPixelOffset: updateTriggers.getPixelOffset ?? getPixelOffset,
            getRadius: updateTriggers.getRadius,
            getBoundingRect: {
              getText: updateTriggers.getText,
              getTextAnchor: updateTriggers.getTextAnchor,
              getAlignmentBaseline: updateTriggers.getAlignmentBaseline,
              styleVersion
            }
          }
        }),
        {
          data: dataWithAttributes.attributes?.background
            ? {
                length: dataWithAttributes.length,
                attributes: dataWithAttributes.attributes.background
              }
            : data,
          _dataDiff,
          autoHighlight: false,
          getBoundingRect,
          collisionTestProps
        }
      ),
      new CharactersLayerClass(
        {
          sdf: fontSettings.sdf,
          smoothing: Number.isFinite(fontSettings.smoothing)
            ? fontSettings.smoothing
            : DEFAULT_FONT_SETTINGS.smoothing,
          outlineWidth: outlineWidth / (fontSettings.radius || DEFAULT_FONT_SETTINGS.radius),
          outlineColor,
          iconAtlas: atlas,
          iconMapping: mapping,

          getPosition,
          getColor,
          getSize,
          getAngle,
          getPixelOffset,
          collisionEnabled,
          collisionGroup,
          getCollisionPriority,
          getContentBox,
          getBoundingRect,
          ...placementProps,

          billboard,
          sizeScale: sizeScale * scale,
          sizeUnits,
          sizeMinPixels: sizeMinPixels * scale,
          sizeMaxPixels: sizeMaxPixels * scale,
          contentCutoffPixels,
          contentAlignHorizontal,
          contentAlignVertical,

          transitions: transitions && {
            getPosition: transitions.getPosition,
            getAngle: transitions.getAngle,
            getColor: transitions.getColor,
            getSize: transitions.getSize,
            getPixelOffset: transitions.getPixelOffset,
            getContentBox: transitions.getContentBox,
            getRadius: transitions.getRadius
          }
        },
        this.getSubLayerProps({
          id: 'characters',
          updateTriggers: {
            all: updateTriggers.getText,
            getPosition: updateTriggers.getPosition,
            getAngle: updateTriggers.getAngle,
            getColor: updateTriggers.getColor,
            getSize: updateTriggers.getSize,
            getPixelOffset: updateTriggers.getPixelOffset ?? getPixelOffset,
            getContentBox: updateTriggers.getContentBox,
            getRadius: updateTriggers.getRadius,
            getBoundingRect: {
              getText: updateTriggers.getText,
              getTextAnchor: updateTriggers.getTextAnchor,
              getAlignmentBaseline: updateTriggers.getAlignmentBaseline,
              styleVersion
            },
            getIconOffsets: {
              getTextAnchor: updateTriggers.getTextAnchor,
              getAlignmentBaseline: updateTriggers.getAlignmentBaseline,
              styleVersion
            }
          }
        }),
        {
          data,
          _dataDiff,
          startIndices,
          numInstances,
          getBoundingRect,
          getIconOffsets,
          getIcon: getText
        }
      )
    ];
  }
}

/** Renders scatterplot circles plus decluttered labels positioned outside each circle. */
export default class LabeledScatterplotLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends CompositeLayer<ExtraPropsT & Required<LabeledScatterplotLayerProps<DataT>>> {
  static layerName = 'LabeledScatterplotLayer';
  static defaultProps = defaultProps;

  private _getPointBillboard(): boolean {
    const {pointBillboard} = this.props;
    return pointBillboard ?? false;
  }

  private _getTextBillboard(): boolean {
    const {textBillboard} = this.props;
    return textBillboard ?? true;
  }

  private _getCircleExtensions() {
    return filterCollisionExtensions(this.props.extensions);
  }

  private _getLabelExtensions() {
    return this.props.extensions || [];
  }

  private _getLabelData(): LayerDataSource<DataT> {
    const {data} = this.props;
    const dataWithAttributes = data as TextDataWithAttributes;
    const attributes = dataWithAttributes.attributes;
    if (!attributes) {
      return data;
    }

    const hasPointPickingColors = Boolean(attributes.instancePickingColors);
    const hasBackgroundPickingColors = Boolean(attributes.background?.instancePickingColors);
    if (!hasPointPickingColors && !hasBackgroundPickingColors) {
      return data;
    }

    const cleanedAttributes = {...attributes};
    const background = cleanedAttributes.background;
    delete cleanedAttributes.instancePickingColors;

    const backgroundAttributes = background ? {...background} : background;
    if (backgroundAttributes) {
      delete backgroundAttributes.instancePickingColors;
    }

    return {
      ...dataWithAttributes,
      attributes: backgroundAttributes
        ? {...cleanedAttributes, background: backgroundAttributes}
        : cleanedAttributes
    } as LayerDataSource<DataT>;
  }

  renderLayers(): Layer | null | LayersList {
    const {
      data,
      getPosition,
      getRadius,
      getFillColor,
      getLineColor,
      getLineWidth,
      radiusUnits,
      radiusScale,
      radiusMinPixels,
      radiusMaxPixels,
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      stroked,
      filled,
      antialiasing,
      getText,
      getColor,
      getSize,
      getAngle,
      getPixelOffset,
      getBackgroundColor,
      getBorderColor,
      getBorderWidth,
      background,
      backgroundBorderRadius,
      backgroundPadding,
      characterSet,
      fontFamily,
      fontWeight,
      lineHeight,
      maxWidth,
      outlineColor,
      outlineWidth,
      wordBreak,
      fontSettings,
      sizeUnits,
      sizeScale,
      sizeMinPixels,
      sizeMaxPixels,
      getContentBox,
      contentCutoffPixels,
      contentAlignHorizontal,
      contentAlignVertical,
      collisionEnabled,
      collisionGroup,
      collisionTestProps,
      getCollisionPriority,
      labelPosition,
      labelPadding,
      transitions,
      updateTriggers
    } = this.props;

    return [
      new ScatterplotLayer(
        {
          getPosition,
          getRadius,
          getFillColor,
          getLineColor,
          getLineWidth,
          radiusUnits,
          radiusScale,
          radiusMinPixels,
          radiusMaxPixels,
          lineWidthUnits,
          lineWidthScale,
          lineWidthMinPixels,
          lineWidthMaxPixels,
          stroked,
          filled,
          antialiasing,
          billboard: this._getPointBillboard(),
          transitions: transitions && {
            getPosition: transitions.getPosition,
            getRadius: transitions.getRadius,
            getFillColor: transitions.getFillColor,
            getLineColor: transitions.getLineColor,
            getLineWidth: transitions.getLineWidth
          }
        },
        this.getSubLayerProps({
          id: 'circles',
          extensions: this._getCircleExtensions(),
          updateTriggers: {
            getPosition: updateTriggers.getPosition,
            getRadius: updateTriggers.getRadius,
            getFillColor: updateTriggers.getFillColor,
            getLineColor: updateTriggers.getLineColor,
            getLineWidth: updateTriggers.getLineWidth
          }
        }),
        {data}
      ),
      new LabeledScatterplotTextLayer<DataT>(
        {
          data: this._getLabelData(),
          getText,
          getPosition,
          getColor,
          getSize,
          getAngle,
          getPixelOffset,
          getBackgroundColor,
          getBorderColor,
          getBorderWidth,
          background,
          backgroundBorderRadius,
          backgroundPadding,
          characterSet,
          fontFamily,
          fontWeight,
          lineHeight,
          maxWidth,
          outlineColor,
          outlineWidth,
          wordBreak,
          fontSettings,
          sizeUnits,
          sizeScale,
          sizeMinPixels,
          sizeMaxPixels,
          getContentBox,
          contentCutoffPixels,
          contentAlignHorizontal,
          contentAlignVertical,
          billboard: this._getTextBillboard(),
          getTextAnchor: 'middle',
          getAlignmentBaseline: labelPosition === 'bottom' ? 'top' : 'bottom',
          getRadius,
          radiusUnits,
          radiusScale,
          radiusMinPixels,
          radiusMaxPixels,
          labelPosition,
          labelPadding,
          collisionEnabled,
          collisionGroup,
          collisionTestProps,
          getCollisionPriority,
          transitions: transitions && {
            getPosition: transitions.getPosition,
            getSize: transitions.getSize,
            getAngle: transitions.getAngle,
            getPixelOffset: transitions.getPixelOffset,
            getColor: transitions.getColor,
            getBackgroundColor: transitions.getBackgroundColor,
            getBorderColor: transitions.getBorderColor,
            getBorderWidth: transitions.getBorderWidth,
            getContentBox: transitions.getContentBox,
            getRadius: transitions.getRadius
          }
        },
        this.getSubLayerProps({
          id: 'labels',
          extensions: this._getLabelExtensions(),
          updateTriggers: {
            ...updateTriggers,
            getTextAnchor: ['middle'],
            getAlignmentBaseline: [labelPosition]
          }
        })
      )
    ];
  }
}
