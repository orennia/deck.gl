// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

/* global fetch */
import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl/maplibre';
import {DeckGL} from '@deck.gl/react';
import {GeoJsonLayer} from '@deck.gl/layers';
import {CollisionFilterExtension} from '@deck.gl/extensions';

import type {MapViewState} from '@deck.gl/core';
import type {Feature, FeatureCollection, Point} from 'geojson';

const DATA_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/bart-stations.json';

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

function toFeatureCollection(data?: BartStation[] | null): FeatureCollection<Point, BartStation> {
  const stations = data || [];
  return {
    type: 'FeatureCollection',
    features: stations.map(
      station =>
        ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: station.coordinates
          },
          properties: station
        }) as Feature<Point, BartStation>
    )
  };
}

export default function App({
  data = [],
  mapStyle = 'https://deck.gl/mapstyle/deck-light.json',
  textBackground = true,
  collisionEnabled = true,
  labelPosition = 'top',
  textSize = 14,
  circleScale = 2
}: {
  data?: BartStation[] | null;
  mapStyle?: string;
  textBackground?: boolean;
  collisionEnabled?: boolean;
  labelPosition?: 'top' | 'bottom';
  textSize?: number;
  circleScale?: number;
}) {
  const geojson = useMemo(() => toFeatureCollection(data), [data]);
  const [showBackground, setShowBackground] = useState(textBackground);
  const [showCollision, setShowCollision] = useState(collisionEnabled);
  const [currentLabelPosition, setCurrentLabelPosition] = useState(labelPosition);
  const [currentCircleScale, setCurrentCircleScale] = useState(circleScale);

  useEffect(() => {
    setShowBackground(textBackground);
  }, [textBackground]);

  useEffect(() => {
    setShowCollision(collisionEnabled);
  }, [collisionEnabled]);

  useEffect(() => {
    setCurrentLabelPosition(labelPosition);
  }, [labelPosition]);

  useEffect(() => {
    setCurrentCircleScale(circleScale);
  }, [circleScale]);

  const extensions = useMemo(
    () => (showCollision ? [new CollisionFilterExtension()] : []),
    [showCollision]
  );

  const layer = new GeoJsonLayer<BartStation>({
    id: 'bart-stations',
    data: geojson,
    pointType: 'circle-label',
    pickable: true,
    filled: true,
    stroked: true,

    getFillColor: [255, 140, 0],
    getLineColor: [60, 60, 60],
    getLineWidth: 1,
    getPointRadius: f => Math.sqrt(f.properties.exits),
    pointRadiusScale: currentCircleScale,

    getText: f => f.properties.name,
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
    textLabelPosition: currentLabelPosition,
    textLabelPadding: 6,
    textBillboard: true,

    textCollisionEnabled: showCollision,
    getTextCollisionPriority: f => Math.sqrt(f.properties.exits),
    textCollisionTestProps: {
      backgroundPadding: [10, 6],
      sizeScale: textSize + 2,
      sizeMinPixels: textSize + 2,
      sizeMaxPixels: textSize + 2
    },
    extensions
  });

  return (
    <div style={{position: 'relative', width: '100%', height: '100%'}}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        getTooltip={({object}) =>
          object && `${object.properties.name}\n${object.properties.address}`
        }
        layers={[layer]}
      >
        <Map reuseMaps mapStyle={mapStyle} />
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
            <option value="top">Above circle</option>
            <option value="bottom">Below circle</option>
          </select>
        </label>
        <label style={{display: 'grid', gap: 4}}>
          <span>Circle scale: {currentCircleScale.toFixed(1)}</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={currentCircleScale}
            onChange={event => setCurrentCircleScale(Number(event.target.value))}
          />
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
