// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {CompositeLayer, Layer, UNIT, picking, project32} from '@deck.gl/core';

import IconLayer from '../icon-layer/icon-layer';
import TextLayer from '../text-layer/text-layer';
import MultiIconLayer from '../text-layer/multi-icon-layer/multi-icon-layer';
import TextBackgroundLayer from '../text-layer/text-background-layer/text-background-layer';
import {DEFAULT_FONT_SETTINGS} from '../text-layer/font-atlas-manager';
import {textBackgroundUniforms} from '../text-layer/text-background-layer/text-background-layer-uniforms';
import {textUniforms} from '../text-layer/text-uniforms';
import textBackgroundFs from '../text-layer/text-background-layer/text-background-layer-fragment.glsl';
import multiIconFs from '../text-layer/multi-icon-layer/multi-icon-layer-fragment.glsl';
import {transformParagraph} from '../text-layer/utils';
import labeledIconTextBackgroundVs from './labeled-icon-text-background-layer-vertex.glsl';
import labeledIconCollisionTextBackgroundVs from './labeled-icon-collision-text-background-layer-vertex.glsl';
import labeledIconMultiIconVs from './labeled-icon-multi-icon-layer-vertex.glsl';
import {labeledIconLabelUniforms} from './labeled-icon-label-uniforms';

import type {
  Accessor,
  AccessorContext,
  AccessorFunction,
  Color,
  LayerDataSource,
  LayerProps,
  LayersList,
  Position,
  Viewport,
  UpdateParameters,
  Unit,
  DefaultProps
} from '@deck.gl/core';
import type {FontSettings} from '../text-layer/font-atlas-manager';
import type {IconLayerProps} from '../icon-layer/icon-layer';
import type {TextLayerProps} from '../text-layer/text-layer';
import type {TextBackgroundProps} from '../text-layer/text-background-layer/text-background-layer-uniforms';
import type {TextModuleProps} from '../text-layer/text-uniforms';
import type {IconMapping, UnpackedIcon} from '../icon-layer/icon-manager';
import type IconManager from '../icon-layer/icon-manager';
import type {LabeledIconLabelProps} from './labeled-icon-label-uniforms';

const iconDefaultProps = {...IconLayer.defaultProps};
delete iconDefaultProps.billboard;

const textLayerDefaultProps = TextLayer.defaultProps;
const textDefaultProps = {
  getText: textLayerDefaultProps.getText,
  getTextColor: textLayerDefaultProps.getColor,
  getTextSize: textLayerDefaultProps.getSize,
  getTextAngle: textLayerDefaultProps.getAngle,
  getTextPixelOffset: textLayerDefaultProps.getPixelOffset,
  getTextBackgroundColor: textLayerDefaultProps.getBackgroundColor,
  getTextBorderColor: textLayerDefaultProps.getBorderColor,
  getTextBorderWidth: textLayerDefaultProps.getBorderWidth,
  textSizeScale: textLayerDefaultProps.sizeScale,
  textSizeUnits: textLayerDefaultProps.sizeUnits,
  textSizeMinPixels: textLayerDefaultProps.sizeMinPixels,
  textSizeMaxPixels: textLayerDefaultProps.sizeMaxPixels,
  textBackground: textLayerDefaultProps.background,
  textBackgroundBorderRadius: textLayerDefaultProps.backgroundBorderRadius,
  textBackgroundPadding: textLayerDefaultProps.backgroundPadding,
  textCharacterSet: textLayerDefaultProps.characterSet,
  textFontFamily: textLayerDefaultProps.fontFamily,
  textFontWeight: textLayerDefaultProps.fontWeight,
  textLineHeight: textLayerDefaultProps.lineHeight,
  textMaxWidth: textLayerDefaultProps.maxWidth,
  textOutlineColor: textLayerDefaultProps.outlineColor,
  textOutlineWidth: textLayerDefaultProps.outlineWidth,
  textWordBreak: textLayerDefaultProps.wordBreak,
  textFontSettings: textLayerDefaultProps.fontSettings,
  textBillboard: textLayerDefaultProps.billboard,
  getTextContentBox: {
    type: 'accessor',
    value: [-1, -1, -1, -1] as [number, number, number, number]
  } as const,
  textContentCutoffPixels: {type: 'array', value: [0, 0] as [number, number]} as const,
  textContentAlignHorizontal: {type: 'number', value: 0} as const,
  textContentAlignVertical: {type: 'number', value: 0} as const
};

const collisionDefaultProps = {
  getTextCollisionPriority: {type: 'accessor', value: 0},
  textCollisionEnabled: true,
  textCollisionGroup: 'default',
  textCollisionTestProps: {}
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

type LabeledIconCollisionProps<DataT> = {
  getTextCollisionPriority?: Accessor<DataT, number>;
  textCollisionEnabled?: boolean;
  textCollisionGroup?: string;
  textCollisionTestProps?: CollisionTestProps;
};

type LabeledIconLabelTextProps<DataT> = {
  getText?: TextLayerProps<DataT>['getText'];
  getTextColor?: TextLayerProps<DataT>['getColor'];
  getTextSize?: TextLayerProps<DataT>['getSize'];
  getTextAngle?: TextLayerProps<DataT>['getAngle'];
  getTextPixelOffset?: TextLayerProps<DataT>['getPixelOffset'];
  getTextBackgroundColor?: TextLayerProps<DataT>['getBackgroundColor'];
  getTextBorderColor?: TextLayerProps<DataT>['getBorderColor'];
  getTextBorderWidth?: TextLayerProps<DataT>['getBorderWidth'];
  getTextContentBox?: Accessor<DataT, ContentBox>;
  textSizeScale?: TextLayerProps<DataT>['sizeScale'];
  textSizeUnits?: TextLayerProps<DataT>['sizeUnits'];
  textSizeMinPixels?: TextLayerProps<DataT>['sizeMinPixels'];
  textSizeMaxPixels?: TextLayerProps<DataT>['sizeMaxPixels'];
  textBackground?: TextLayerProps<DataT>['background'];
  textBackgroundBorderRadius?: TextLayerProps<DataT>['backgroundBorderRadius'];
  textBackgroundPadding?: TextLayerProps<DataT>['backgroundPadding'];
  textCharacterSet?: TextLayerProps<DataT>['characterSet'];
  textFontFamily?: TextLayerProps<DataT>['fontFamily'];
  textFontWeight?: TextLayerProps<DataT>['fontWeight'];
  textLineHeight?: TextLayerProps<DataT>['lineHeight'];
  textMaxWidth?: TextLayerProps<DataT>['maxWidth'];
  textOutlineColor?: TextLayerProps<DataT>['outlineColor'];
  textOutlineWidth?: TextLayerProps<DataT>['outlineWidth'];
  textWordBreak?: TextLayerProps<DataT>['wordBreak'];
  textFontSettings?: FontSettings;
  textContentCutoffPixels?: NonNullable<TextModuleProps['contentCutoffPixels']>;
  textContentAlignHorizontal?: TextModuleProps['contentAlignHorizontal'];
  textContentAlignVertical?: TextModuleProps['contentAlignVertical'];
  textBillboard?: TextLayerProps<DataT>['billboard'];
};

type LabeledIconPlacementProps<DataT> = {
  getPointSize?: Accessor<DataT, number>;
  pointSizeUnits?: Unit;
  pointSizeScale?: number;
  pointSizeBasis?: 'height' | 'width';
  pointSizeMinPixels?: number;
  pointSizeMaxPixels?: number;
  getPointPlacement?: Accessor<DataT, PointPlacement>;
  labelPosition?: 'top' | 'bottom';
  labelPadding?: number;
};

type PointPlacement = Readonly<[number, number, number, number]>;

type LabeledIconBillboardProps = {
  iconBillboard?: boolean;
  textBillboard?: boolean;
};

type LabeledIconTextLayerProps<DataT> = Omit<TextLayerProps<DataT>, 'billboard'> &
  LabeledIconPlacementProps<DataT> & {
    collisionEnabled?: boolean;
    collisionGroup?: string;
    collisionTestProps?: CollisionTestProps;
    getCollisionPriority?: Accessor<DataT, number>;
    getContentBox?: Accessor<DataT, ContentBox>;
    contentCutoffPixels?: NonNullable<TextModuleProps['contentCutoffPixels']>;
    contentAlignHorizontal?: TextModuleProps['contentAlignHorizontal'];
    contentAlignVertical?: TextModuleProps['contentAlignVertical'];
  };

type LabeledIconTextSubLayerProps<DataT> = LabeledIconPlacementProps<DataT> & {
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
  getPointPlacement?: Accessor<DataT, PointPlacement>;
  getContentBox?: Accessor<DataT, ContentBox>;
  getBoundingRect?: Accessor<DataT, BoundingRect>;
};

type LabeledIconTextBackgroundLayerProps<DataT> = LabeledIconTextSubLayerProps<DataT> & {
  borderRadius?: number | Readonly<[number, number, number, number]>;
  padding?: Readonly<[number, number]> | Readonly<[number, number, number, number]>;
  getClipRect?: Accessor<DataT, BoundingRect>;
  getBoundingRect?: Accessor<DataT, BoundingRect>;
  getFillColor?: Accessor<DataT, Color>;
  getLineColor?: Accessor<DataT, Color>;
  getLineWidth?: Accessor<DataT, number>;
};

type LabeledIconMultiIconLayerProps<DataT> = LabeledIconTextSubLayerProps<DataT> &
  LayerProps & {
    contentCutoffPixels?: NonNullable<TextModuleProps['contentCutoffPixels']>;
    contentAlignHorizontal?: TextModuleProps['contentAlignHorizontal'];
    contentAlignVertical?: TextModuleProps['contentAlignVertical'];
  };

export type LabeledIconLayerProps<DataT = unknown> = Omit<IconLayerProps<DataT>, 'billboard'> &
  LabeledIconLabelTextProps<DataT> &
  LabeledIconCollisionProps<DataT> &
  LabeledIconBillboardProps & {
    labelPosition?: 'top' | 'bottom';
    labelPadding?: number;
  };

const defaultProps: DefaultProps<LabeledIconLayerProps> = {
  ...iconDefaultProps,
  ...textDefaultProps,
  ...collisionDefaultProps,
  labelPosition: 'top',
  labelPadding: {type: 'number', min: 0, value: 4},
  iconBillboard: IconLayer.defaultProps.billboard,
  textBillboard: TextLayer.defaultProps.billboard
};

type ResolvedIconDefinition = {
  width: number;
  height: number;
  anchorX?: number;
  anchorY?: number;
};

type IconDefinitionResolver = {
  getIconMapping(icon: string | UnpackedIcon): ResolvedIconDefinition;
} | null;

type AccessorContextWithViewport<DataT> = AccessorContext<DataT> & {
  viewport?: Pick<Viewport, 'getDistanceScales' | 'scale'>;
};

function getIconKey(icon: string | UnpackedIcon | null | undefined): string | null {
  if (!icon) {
    return null;
  }
  if (typeof icon === 'string') {
    return icon;
  }
  return icon.id || icon.url || null;
}

function resolveIconDefinition(
  iconMapping: string | IconMapping | null | undefined,
  icon: string | UnpackedIcon | null | undefined,
  iconResolver: IconDefinitionResolver = null
): ResolvedIconDefinition {
  const mapping = typeof iconMapping === 'string' ? null : iconMapping;
  const iconKey = getIconKey(icon);
  const mappedIcon = iconKey && mapping ? mapping[iconKey] : null;

  if (mappedIcon) {
    return mappedIcon;
  }
  if (iconKey && iconResolver) {
    return iconResolver.getIconMapping(icon as string | UnpackedIcon);
  }
  if (icon && typeof icon !== 'string') {
    return icon;
  }
  return {width: 0, height: 0};
}

function createPointPlacementAccessor<DataT>(
  getPointSize: Accessor<DataT, number> | undefined,
  getIcon: Accessor<DataT, string> | Accessor<DataT, UnpackedIcon> | undefined,
  iconMapping: string | IconMapping | null | undefined,
  getIconResolver: (() => IconDefinitionResolver) | undefined
): Accessor<DataT, PointPlacement> {
  return (object, info) => {
    const pointSize =
      typeof getPointSize === 'function' ? getPointSize(object, info) : getPointSize;
    const icon = typeof getIcon === 'function' ? getIcon(object, info) : getIcon;
    const iconResolver = getIconResolver?.();
    const {width, height, anchorY} = resolveIconDefinition(iconMapping, icon, iconResolver);
    const resolvedAnchorY = anchorY ?? height / 2;

    return [pointSize ?? 1, width, height, resolvedAnchorY];
  };
}

function createIconAlignedPixelOffsetAccessor<DataT>(
  getPixelOffset: Accessor<DataT, Readonly<[number, number]>> | undefined,
  getPosition: Accessor<DataT, Position> | undefined,
  getPointSize: Accessor<DataT, number> | undefined,
  getIcon: Accessor<DataT, string> | Accessor<DataT, UnpackedIcon> | undefined,
  iconMapping: string | IconMapping | null | undefined,
  getIconResolver: (() => IconDefinitionResolver) | undefined,
  pointSizeUnits: Unit,
  pointSizeScale: number,
  pointSizeBasis: 'width' | 'height',
  pointSizeMinPixels: number,
  pointSizeMaxPixels: number,
  labelPosition: 'top' | 'bottom',
  labelPadding: number
): Accessor<DataT, Readonly<[number, number]>> {
  return (object, info) => {
    const basePixelOffset =
      typeof getPixelOffset === 'function'
        ? getPixelOffset(object, info)
        : (getPixelOffset ?? [0, 0]);
    const pointSize =
      typeof getPointSize === 'function' ? getPointSize(object, info) : (getPointSize ?? 1);
    const icon = typeof getIcon === 'function' ? getIcon(object, info) : getIcon;
    const position =
      typeof getPosition === 'function' ? getPosition(object, info) : (getPosition ?? [0, 0, 0]);
    const iconResolver = getIconResolver?.();
    const {
      width,
      height,
      anchorY = height / 2
    } = resolveIconDefinition(iconMapping, icon, iconResolver);

    let sizePixels = pointSize * pointSizeScale;
    const viewport = (info as AccessorContextWithViewport<DataT>).viewport;

    if (pointSizeUnits === 'meters') {
      const distanceScales = viewport?.getDistanceScales(position as unknown as number[]) as
        | {unitsPerMeter: [number, number, number]}
        | undefined;
      sizePixels *= distanceScales?.unitsPerMeter[2] ?? 1;
      sizePixels *= viewport?.scale ?? 1;
    } else if (pointSizeUnits === 'common') {
      sizePixels *= viewport?.scale ?? 1;
    }

    sizePixels = Math.max(pointSizeMinPixels, Math.min(pointSizeMaxPixels, sizePixels));
    const iconConstraint = pointSizeBasis === 'width' ? width : height;
    const scale = iconConstraint === 0 ? 0 : sizePixels / iconConstraint;
    const topExtent = anchorY * scale;
    const bottomExtent = (height - anchorY) * scale;
    const labelOffset =
      labelPosition === 'top' ? -(topExtent + labelPadding) : bottomExtent + labelPadding;

    return [basePixelOffset[0], basePixelOffset[1] + labelOffset];
  };
}

function getLabelPlacementProps<DataT>(
  props: LabeledIconPlacementProps<DataT> & {
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
): LabeledIconLabelProps {
  const backgroundPadding = props.backgroundPadding ?? [0, 0, 0, 0];
  const collisionPadding =
    backgroundPadding.length < 4
      ? [backgroundPadding[0], backgroundPadding[1], backgroundPadding[0], backgroundPadding[1]]
      : [...backgroundPadding];

  return {
    boxSizeScale: props.boxSizeScale ?? props.sizeScale ?? 1,
    boxSizeUnits: UNIT[props.boxSizeUnits ?? props.sizeUnits ?? 'pixels'],
    boxSizeMinPixels: props.boxSizeMinPixels ?? props.sizeMinPixels ?? 0,
    boxSizeMaxPixels: props.boxSizeMaxPixels ?? props.sizeMaxPixels ?? Number.MAX_SAFE_INTEGER,
    collisionPadding: collisionPadding as [number, number, number, number]
  };
}

function filterCollisionExtensions(extensions: LayerProps['extensions'] = []) {
  return extensions.filter(
    extension =>
      (extension.constructor as {extensionName?: string}).extensionName !==
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

class BaseLabeledIconTextBackgroundLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends TextBackgroundLayer<
  DataT,
  ExtraPropsT & Required<LabeledIconTextBackgroundLayerProps<DataT>>
> {
  static layerName = 'BaseLabeledIconTextBackgroundLayer';

  getShaders() {
    return Layer.prototype.getShaders.call(this, {
      vs: this.getVertexShader(),
      fs: textBackgroundFs,
      modules: [project32, picking, textBackgroundUniforms, textUniforms, labeledIconLabelUniforms]
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
      instancePickingColors: {
        type: 'uint8',
        size: 3,
        accessor: (_, {index, target: value}) => this.encodePickingColor(index, value)
      },
      instancePointPlacements: {
        size: 4,
        accessor: 'getPointPlacement',
        defaultValue: [1, 0, 0, 0]
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
      labeledIconLabel: getLabelPlacementProps(this.props)
    });
    model.draw(this.context.renderPass);
  }

  protected getVertexShader() {
    return labeledIconTextBackgroundVs;
  }
}

class LabeledIconTextBackgroundLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends BaseLabeledIconTextBackgroundLayer<DataT, ExtraPropsT> {
  static layerName = 'LabeledIconTextBackgroundLayer';
}

class LabeledIconCollisionTextBackgroundLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends BaseLabeledIconTextBackgroundLayer<DataT, ExtraPropsT> {
  static layerName = 'LabeledIconCollisionTextBackgroundLayer';

  protected getVertexShader() {
    return labeledIconCollisionTextBackgroundVs;
  }
}

class LabeledIconMultiIconLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends MultiIconLayer<DataT, ExtraPropsT & Required<LabeledIconMultiIconLayerProps<DataT>>> {
  static layerName = 'LabeledIconMultiIconLayer';

  getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      modules: [...shaders.modules, textUniforms, labeledIconLabelUniforms],
      vs: labeledIconMultiIconVs,
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
      instancePointPlacements: {
        size: 4,
        accessor: 'getPointPlacement',
        defaultValue: [1, 0, 0, 0]
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
      labeledIconLabel: getLabelPlacementProps(this.props)
    });
    super.draw(params);
  }
}

class LabeledIconIconLayer<DataT = unknown, ExtraPropsT extends object = object> extends IconLayer<
  DataT,
  ExtraPropsT & {onIconManagerUpdate?: (iconManager: IconManager) => void}
> {
  static layerName = 'LabeledIconIconLayer';

  updateState(params: UpdateParameters<this>) {
    super.updateState(params);
    this.props.onIconManagerUpdate?.(this.state.iconManager);
  }
}

class LabeledIconTextLayer<DataT = unknown, ExtraPropsT extends object = object> extends TextLayer<
  DataT,
  ExtraPropsT & Required<LabeledIconTextLayerProps<DataT>>
> {
  static layerName = 'LabeledIconTextLayer';
  static defaultProps = {
    ...TextLayer.defaultProps,
    getPointSize: {type: 'accessor', value: 1},
    getPointPlacement: {type: 'accessor', value: [1, 0, 0, 0]},
    pointSizeUnits: 'pixels',
    pointSizeScale: {type: 'number', min: 0, value: 1},
    pointSizeBasis: 'height',
    pointSizeMinPixels: {type: 'number', min: 0, value: 0},
    pointSizeMaxPixels: {type: 'number', min: 0, value: Number.MAX_SAFE_INTEGER},
    labelPosition: 'top',
    labelPadding: {type: 'number', min: 0, value: 4},
    collisionEnabled: true,
    collisionGroup: 'default',
    collisionTestProps: {},
    getCollisionPriority: {type: 'accessor', value: 0}
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
      pointSizeUnits,
      pointSizeScale,
      pointSizeBasis,
      pointSizeMinPixels,
      pointSizeMaxPixels,
      getPointPlacement,
      labelPosition,
      labelPadding
    } = this.props;
    const getBoundingRect = this._getBoundingRectForLabel;
    const getIconOffsets = this._getIconOffsetsForLabel;
    const collisionTestProps = mapCollisionTestProps(this.props.collisionTestProps);
    const dataWithAttributes = data as TextDataWithAttributes;
    const CharactersLayerClass = this.getSubLayerClass('characters', LabeledIconMultiIconLayer);
    const BackgroundLayerClass = this.getSubLayerClass(
      'background',
      LabeledIconTextBackgroundLayer
    );
    const CollisionBackgroundLayerClass = this.getSubLayerClass(
      'collision-background',
      LabeledIconCollisionTextBackgroundLayer
    );

    const placementProps = {
      pointSizeUnits,
      pointSizeScale,
      pointSizeBasis,
      pointSizeMinPixels,
      pointSizeMaxPixels,
      getPointPlacement,
      labelPosition,
      labelPadding,
      backgroundPadding: collisionTestProps?.padding ?? backgroundPadding,
      boxSizeScale: collisionTestProps?.sizeScale ?? sizeScale,
      boxSizeUnits: collisionTestProps?.sizeUnits ?? sizeUnits,
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
              getPixelOffset: transitions.getPixelOffset
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
              getPixelOffset: updateTriggers.getPixelOffset,
              getPointPlacement: {
                getPointPlacement: updateTriggers.getPointPlacement
              },
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
            getPixelOffset: updateTriggers.getPixelOffset,
            getPointPlacement: {
              getPointPlacement: updateTriggers.getPointPlacement
            },
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
            getContentBox: transitions.getContentBox
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
            getPixelOffset: updateTriggers.getPixelOffset,
            getContentBox: updateTriggers.getContentBox,
            getPointPlacement: {
              getPointPlacement: updateTriggers.getPointPlacement
            },
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

/** Renders icons plus decluttered labels positioned outside each icon. */
export default class LabeledIconLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends CompositeLayer<ExtraPropsT & Required<LabeledIconLayerProps<DataT>>> {
  static layerName = 'LabeledIconLayer';
  static defaultProps = defaultProps;

  private _getIconBillboard(): boolean {
    const {iconBillboard} = this.props;
    return iconBillboard ?? IconLayer.defaultProps.billboard;
  }

  private _getTextBillboard(): boolean {
    const {textBillboard} = this.props;
    return textBillboard ?? TextLayer.defaultProps.billboard;
  }

  private _getIconExtensions() {
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
    delete cleanedAttributes.instancePickingColors;

    if (cleanedAttributes.background) {
      cleanedAttributes.background = {...cleanedAttributes.background};
      delete cleanedAttributes.background.instancePickingColors;
    }

    return {
      ...dataWithAttributes,
      attributes: cleanedAttributes
    } as LayerDataSource<DataT>;
  }

  renderLayers(): Layer | null | LayersList {
    const {
      data,
      getPosition,
      getIcon,
      getColor,
      getSize,
      getAngle,
      getPixelOffset,
      iconAtlas,
      iconMapping,
      sizeScale,
      sizeUnits,
      sizeBasis,
      sizeMinPixels,
      sizeMaxPixels,
      alphaCutoff,
      getText,
      getTextColor,
      getTextSize,
      getTextAngle,
      getTextPixelOffset,
      getTextBackgroundColor,
      getTextBorderColor,
      getTextBorderWidth,
      textBackground,
      textBackgroundBorderRadius,
      textBackgroundPadding,
      textCharacterSet,
      textFontFamily,
      textFontWeight,
      textLineHeight,
      textMaxWidth,
      textOutlineColor,
      textOutlineWidth,
      textWordBreak,
      textFontSettings,
      textSizeUnits,
      textSizeScale,
      textSizeMinPixels,
      textSizeMaxPixels,
      getTextContentBox,
      textContentCutoffPixels,
      textContentAlignHorizontal,
      textContentAlignVertical,
      textCollisionEnabled,
      textCollisionGroup,
      textCollisionTestProps,
      getTextCollisionPriority,
      labelPosition,
      labelPadding,
      transitions,
      updateTriggers
    } = this.props;

    const iconManagerRef: {current: IconManager | null} = {current: null};
    const getPointPlacement = createPointPlacementAccessor(
      getSize,
      getIcon,
      iconMapping,
      () => iconManagerRef.current
    );
    const getAlignedPixelOffset = createIconAlignedPixelOffsetAccessor(
      getTextPixelOffset,
      getPosition,
      getSize,
      getIcon,
      iconMapping,
      () => iconManagerRef.current,
      sizeUnits,
      sizeScale,
      sizeBasis,
      sizeMinPixels,
      sizeMaxPixels,
      labelPosition,
      labelPadding
    );
    return [
      new LabeledIconIconLayer<DataT>(
        {
          getPosition,
          getIcon,
          getColor,
          getSize,
          getAngle,
          getPixelOffset,
          iconAtlas,
          iconMapping,
          sizeScale,
          sizeUnits,
          sizeBasis,
          sizeMinPixels,
          sizeMaxPixels,
          alphaCutoff,
          billboard: this._getIconBillboard(),
          onIconManagerUpdate: iconManager => {
            if (iconManagerRef.current !== iconManager) {
              iconManagerRef.current = iconManager;
              this.setNeedsUpdate();
            }
          },
          transitions: transitions && {
            getPosition: transitions.getPosition,
            getIcon: transitions.getIcon,
            getColor: transitions.getColor,
            getSize: transitions.getSize,
            getAngle: transitions.getAngle,
            getPixelOffset: transitions.getPixelOffset
          }
        },
        this.getSubLayerProps({
          id: 'icons',
          extensions: this._getIconExtensions(),
          updateTriggers: {
            getPosition: updateTriggers.getPosition,
            getIcon: updateTriggers.getIcon,
            getColor: updateTriggers.getColor,
            getSize: updateTriggers.getSize,
            getAngle: updateTriggers.getAngle,
            getPixelOffset: updateTriggers.getPixelOffset
          }
        }),
        {data}
      ),
      new LabeledIconTextLayer<DataT>(
        {
          data: this._getLabelData(),
          getText,
          getPosition,
          getColor: getTextColor,
          getSize: getTextSize,
          getAngle: getTextAngle,
          getBackgroundColor: getTextBackgroundColor,
          getBorderColor: getTextBorderColor,
          getBorderWidth: getTextBorderWidth,
          background: textBackground,
          backgroundBorderRadius: textBackgroundBorderRadius,
          backgroundPadding: textBackgroundPadding,
          characterSet: textCharacterSet,
          fontFamily: textFontFamily,
          fontWeight: textFontWeight,
          lineHeight: textLineHeight,
          maxWidth: textMaxWidth,
          outlineColor: textOutlineColor,
          outlineWidth: textOutlineWidth,
          wordBreak: textWordBreak,
          fontSettings: textFontSettings,
          sizeUnits: textSizeUnits,
          sizeScale: textSizeScale,
          sizeMinPixels: textSizeMinPixels,
          sizeMaxPixels: textSizeMaxPixels,
          getContentBox: getTextContentBox,
          contentCutoffPixels: textContentCutoffPixels,
          contentAlignHorizontal: textContentAlignHorizontal,
          contentAlignVertical: textContentAlignVertical,
          billboard: this._getTextBillboard(),
          getTextAnchor: 'middle',
          getAlignmentBaseline: labelPosition === 'bottom' ? 'top' : 'bottom',
          getPointSize: getSize,
          getPointPlacement,
          getPixelOffset: getAlignedPixelOffset,
          pointSizeUnits: sizeUnits,
          pointSizeScale: sizeScale,
          pointSizeBasis: sizeBasis,
          pointSizeMinPixels: sizeMinPixels,
          pointSizeMaxPixels: sizeMaxPixels,
          labelPosition,
          labelPadding,
          collisionEnabled: textCollisionEnabled,
          collisionGroup: textCollisionGroup,
          collisionTestProps: textCollisionTestProps,
          getCollisionPriority: getTextCollisionPriority,
          transitions: transitions && {
            getPosition: transitions.getPosition,
            getSize: transitions.getTextSize,
            getAngle: transitions.getTextAngle,
            getPixelOffset: transitions.getTextPixelOffset,
            getColor: transitions.getTextColor,
            getBackgroundColor: transitions.getTextBackgroundColor,
            getBorderColor: transitions.getTextBorderColor,
            getBorderWidth: transitions.getTextBorderWidth,
            getContentBox: transitions.getTextContentBox,
            getPointSize: transitions.getSize
          }
        },
        this.getSubLayerProps({
          id: 'labels',
          extensions: this._getLabelExtensions(),
          updateTriggers: {
            ...updateTriggers,
            getColor: updateTriggers.getTextColor,
            getSize: updateTriggers.getTextSize,
            getAngle: updateTriggers.getTextAngle,
            getPixelOffset: {
              getPixelOffset: updateTriggers.getTextPixelOffset,
              getPointSize: updateTriggers.getSize,
              getIcon: updateTriggers.getIcon,
              iconMapping,
              labelPosition,
              labelPadding,
              pointSizeUnits: sizeUnits,
              pointSizeScale: sizeScale,
              pointSizeBasis: sizeBasis,
              pointSizeMinPixels: sizeMinPixels,
              pointSizeMaxPixels: sizeMaxPixels
            },
            getBackgroundColor: updateTriggers.getTextBackgroundColor,
            getBorderColor: updateTriggers.getTextBorderColor,
            getBorderWidth: updateTriggers.getTextBorderWidth,
            getContentBox: updateTriggers.getTextContentBox,
            getPointSize: updateTriggers.getSize,
            getPointPlacement: {
              getPointSize: updateTriggers.getSize,
              getIcon: updateTriggers.getIcon,
              iconMapping
            },
            getTextAnchor: ['middle'],
            getAlignmentBaseline: [labelPosition]
          }
        })
      )
    ];
  }
}
