// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

/* global fetch */
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {Map as MapLibreMap} from 'react-map-gl/maplibre';
import {DeckGL} from '@deck.gl/react';
import {CollisionFilterExtension} from '@deck.gl/extensions';
import {LabeledIconLayer as BaseLabeledIconLayer} from '../../../modules/layers/src';

import type {Layer, MapViewState} from '@deck.gl/core';

const DATA_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/bart-stations.json';
const ICON_ATLAS_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png';
const ICON_MAPPING_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -122.4,
  latitude: 37.74,
  zoom: 11
};

type BartStation = {
  name: string;
  address: string;
  exits: number;
  coordinates: [number, number];
};

type SizeTestPoint = {
  label: string;
  size: number;
  coordinates: [number, number];
};

type LabeledIconDatum = BartStation | SizeTestPoint;

type DataMode = 'bart' | 'size-test';

type HorizontalAlignment = 'left' | 'center' | 'right';
type VerticalAlignment = 'top' | 'center' | 'bottom';

type IconMapping = Record<
  string,
  {
    x: number;
    y: number;
    width: number;
    height: number;
    anchorX?: number;
    anchorY?: number;
    mask?: boolean;
  }
>;

const LabeledIconLayer = BaseLabeledIconLayer as unknown as new (
  props: Record<string, unknown>
) => Layer;

const SIZE_TEST_COLUMNS = 6;
const SIZE_TEST_ROWS = 5;
const SIZE_TEST_MIN = 7;
const SIZE_TEST_MAX = 36;
const SIZE_TEST_LONGITUDE_STEP = 0.012;
const SIZE_TEST_LATITUDE_STEP = 0.009;

function loadIconAtlas(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load icon atlas: ${url}`));
    image.src = url;
  });
}

function getAlignedAnchor(
  position: HorizontalAlignment | VerticalAlignment,
  extent: number
): number {
  switch (position) {
    case 'left':
    case 'top':
      return 0;

    case 'center':
      return extent / 2;

    case 'right':
    case 'bottom':
      return extent;

    default:
      return extent / 2;
  }
}

function formatSize(size: number): string {
  const rounded = Math.round(size * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function createSizeTestData(): SizeTestPoint[] {
  const totalPoints = SIZE_TEST_COLUMNS * SIZE_TEST_ROWS;
  const longitudeStart =
    INITIAL_VIEW_STATE.longitude - ((SIZE_TEST_COLUMNS - 1) * SIZE_TEST_LONGITUDE_STEP) / 2;
  const latitudeStart =
    INITIAL_VIEW_STATE.latitude + ((SIZE_TEST_ROWS - 1) * SIZE_TEST_LATITUDE_STEP) / 2;

  return Array.from({length: totalPoints}, (_, index) => {
    const column = index % SIZE_TEST_COLUMNS;
    const row = Math.floor(index / SIZE_TEST_COLUMNS);
    const size =
      SIZE_TEST_MIN + ((SIZE_TEST_MAX - SIZE_TEST_MIN) * index) / Math.max(totalPoints - 1, 1);

    return {
      label: formatSize(size),
      size,
      coordinates: [
        longitudeStart + column * SIZE_TEST_LONGITUDE_STEP,
        latitudeStart - row * SIZE_TEST_LATITUDE_STEP
      ]
    };
  });
}

const SIZE_TEST_DATA = createSizeTestData();

export default function App({
  data = [],
  mapStyle = 'https://deck.gl/mapstyle/deck-light.json',
  textBackground = true,
  collisionEnabled = true,
  labelPosition = 'top',
  textSize = 14,
  iconScale = 36
}: {
  data?: BartStation[];
  mapStyle?: string;
  textBackground?: boolean;
  collisionEnabled?: boolean;
  labelPosition?: 'top' | 'bottom';
  textSize?: number;
  iconScale?: number;
}) {
  const [showBackground, setShowBackground] = React.useState(textBackground);
  const [showCollision, setShowCollision] = React.useState(collisionEnabled);
  const [currentLabelPosition, setCurrentLabelPosition] = React.useState(labelPosition);
  const [currentIconScale, setCurrentIconScale] = React.useState(iconScale);
  const [currentDataMode, setCurrentDataMode] = React.useState<DataMode>('bart');
  const [currentHorizontalAlignment, setCurrentHorizontalAlignment] =
    React.useState<HorizontalAlignment>('center');
  const [currentVerticalAlignment, setCurrentVerticalAlignment] =
    React.useState<VerticalAlignment>('bottom');
  const [iconAtlas, setIconAtlas] = React.useState<HTMLImageElement | null>(null);
  const [iconMapping, setIconMapping] = React.useState<IconMapping | null>(null);

  React.useEffect(() => {
    setShowBackground(textBackground);
  }, [textBackground]);

  React.useEffect(() => {
    setShowCollision(collisionEnabled);
  }, [collisionEnabled]);

  React.useEffect(() => {
    setCurrentLabelPosition(labelPosition);
  }, [labelPosition]);

  React.useEffect(() => {
    setCurrentIconScale(iconScale);
  }, [iconScale]);

  const currentData = React.useMemo<LabeledIconDatum[]>(
    () => (currentDataMode === 'bart' ? data : SIZE_TEST_DATA),
    [currentDataMode, data]
  );

  const currentIconSizeProps = React.useMemo(
    () =>
      currentDataMode === 'bart'
        ? {
            getSize: () => 1,
            sizeScale: currentIconScale,
            sizeMinPixels: currentIconScale,
            sizeMaxPixels: currentIconScale
          }
        : {
            getSize: (d: SizeTestPoint) => d.size,
            sizeScale: 1,
            sizeMinPixels: SIZE_TEST_MIN,
            sizeMaxPixels: SIZE_TEST_MAX
          },
    [currentDataMode, currentIconScale]
  );

  React.useEffect(() => {
    let cancelled = false;

    async function loadIcons() {
      try {
        const [atlas, mapping] = await Promise.all([
          loadIconAtlas(ICON_ATLAS_URL),
          fetch(ICON_MAPPING_URL).then(resp => resp.json() as Promise<IconMapping>)
        ]);

        if (!cancelled) {
          setIconAtlas(atlas);
          setIconMapping(mapping);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadIcons();

    return () => {
      cancelled = true;
    };
  }, []);

  const extensions = React.useMemo(
    () => (showCollision ? [new CollisionFilterExtension()] : []),
    [showCollision]
  );

  const currentIconMapping = React.useMemo(() => {
    if (!iconMapping) {
      return null;
    }

    const marker = iconMapping.marker;
    if (!marker) {
      return iconMapping;
    }

    return {
      ...iconMapping,
      marker: {
        ...marker,
        anchorX: getAlignedAnchor(currentHorizontalAlignment, marker.width),
        anchorY: getAlignedAnchor(currentVerticalAlignment, marker.height)
      }
    };
  }, [currentHorizontalAlignment, currentVerticalAlignment, iconMapping]);

  const layer = React.useMemo(
    () =>
      iconAtlas && currentIconMapping
        ? new LabeledIconLayer({
            id: 'bart-stations',
            data: currentData,
            pickable: true,

            iconAtlas,
            iconMapping: currentIconMapping,
            getPosition: (d: LabeledIconDatum) => d.coordinates,
            getIcon: () => 'marker',
            getColor: [255, 140, 0],
            ...currentIconSizeProps,

            getText: (d: LabeledIconDatum) => ('name' in d ? d.name : d.label),
            getTextColor: [32, 32, 48],
            getTextSize: 1,
            textSizeScale: textSize,
            textSizeMinPixels: textSize,
            textSizeMaxPixels: textSize,
            textBackground: showBackground,
            textBackgroundPadding: [8, 4],
            getTextBackgroundColor: [255, 255, 255, 230],
            getTextBorderColor: [255, 140, 0, 255],
            getTextBorderWidth: 1,
            labelPosition: currentLabelPosition,
            labelPadding: 6,
            textBillboard: true,

            textCollisionEnabled: showCollision,
            getTextCollisionPriority: (d: LabeledIconDatum) =>
              'exits' in d ? Math.sqrt(d.exits) : d.size,
            textCollisionTestProps: {
              backgroundPadding: [10, 6],
              sizeScale: textSize + 2,
              sizeMinPixels: textSize + 2,
              sizeMaxPixels: textSize + 2
            },
            extensions
          })
        : null,
    [
      currentIconScale,
      currentLabelPosition,
      currentData,
      currentDataMode,
      currentIconSizeProps,
      extensions,
      iconAtlas,
      currentHorizontalAlignment,
      currentIconMapping,
      currentVerticalAlignment,
      showBackground,
      showCollision,
      textSize
    ]
  );

  return (
    <div style={{position: 'relative', width: '100%', height: '100%'}}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        getTooltip={({object}) => {
          if (!object) {
            return null;
          }

          if ('address' in object) {
            return `${object.name}\n${object.address}`;
          }

          return `Size: ${object.label}px`;
        }}
        layers={layer ? [layer] : []}
      >
        <MapLibreMap reuseMaps mapStyle={mapStyle} />
      </DeckGL>
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1,
          display: 'grid',
          gap: 8,
          padding: 12,
          background: 'rgba(255, 255, 255, 0.92)',
          border: '1px solid rgba(60, 60, 60, 0.2)',
          borderRadius: 8,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
          font: '12px/1.4 Monaco, monospace',
          color: '#202030'
        }}
      >
        <label style={{display: 'grid', gap: 4}}>
          <span>Dataset</span>
          <select
            value={currentDataMode}
            onChange={event => setCurrentDataMode(event.target.value as DataMode)}
          >
            <option value="bart">Semi-realistic BART stations</option>
            <option value="size-test">Size test grid</option>
          </select>
        </label>
        {currentDataMode === 'bart' ? (
          <label style={{display: 'grid', gap: 4}}>
            <span>Icon size: {currentIconScale}px</span>
            <input
              type="range"
              min="10"
              max="36"
              step="1"
              value={currentIconScale}
              onChange={event => setCurrentIconScale(Number(event.target.value))}
            />
          </label>
        ) : (
          <div style={{lineHeight: 1.3, color: '#4a4a5c'}}>
            30 points arranged in a 6 by 5 grid with sizes from 7px to 36px.
          </div>
        )}
        <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <input
            type="checkbox"
            checked={showBackground}
            onChange={event => setShowBackground(event.target.checked)}
          />
          Text background
        </label>
        <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <input
            type="checkbox"
            checked={showCollision}
            onChange={event => setShowCollision(event.target.checked)}
          />
          Collision filtering
        </label>
        <label style={{display: 'grid', gap: 4}}>
          <span>Label position</span>
          <select
            value={currentLabelPosition}
            onChange={event => setCurrentLabelPosition(event.target.value as 'top' | 'bottom')}
          >
            <option value="top">Above icon</option>
            <option value="bottom">Below icon</option>
          </select>
        </label>
        <label style={{display: 'grid', gap: 4}}>
          <span>Icon horizontal alignment</span>
          <select
            value={currentHorizontalAlignment}
            onChange={event =>
              setCurrentHorizontalAlignment(event.target.value as HorizontalAlignment)
            }
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label style={{display: 'grid', gap: 4}}>
          <span>Icon vertical alignment</span>
          <select
            value={currentVerticalAlignment}
            onChange={event => setCurrentVerticalAlignment(event.target.value as VerticalAlignment)}
          >
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export function renderToDOM(container: HTMLDivElement) {
  container.style.width = '100%';
  container.style.height = '100%';
  const root = createRoot(container);
  root.render(<App />);

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  fetch(DATA_URL)
    .then(resp => resp.json())
    .then((data: BartStation[]) => {
      root.render(<App data={data} />);
    });
}
