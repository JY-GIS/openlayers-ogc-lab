<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import KML from 'ol/format/KML'
import Map from 'ol/Map'
import View from 'ol/View'
import VectorLayer from 'ol/layer/Vector'
import TileLayer from 'ol/layer/Tile'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'

import 'ol/ol.css'

const mapContainer = ref<HTMLDivElement | null>(null)

let map: Map | null = null

const params = new URLSearchParams({
  service: 'WFS',
  version: '2.0.0',
  request: 'GetFeature',
  typeNames: 'ogc_lab:facilities',
  outputFormat: 'application/vnd.google-earth.kml+xml',
  srsName: 'EPSG:4326',
})

const kmlSource = new VectorSource({
  url: `/geoserver/ogc_lab/ows?${params.toString()}`,
  format: new KML({
    extractStyles: true,
  }),
})

const kmlLayer = new VectorLayer({
  source: kmlSource,
})

const shapeZipParams = new URLSearchParams({
  service: 'WFS',
  version: '2.0.0',
  request: 'GetFeature',
  typeNames: 'ogc_lab:facilities',
  outputFormat: 'SHAPE-ZIP',
  srsName: 'EPSG:4326',
  format_options: 'CHARSET:UTF-8',
})

const shapeZipUrl = `/geoserver/ogc_lab/ows?${shapeZipParams.toString()}`

// 页面挂载后创建独立地图
onMounted(() => {
  if (!mapContainer.value) return

  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
      kmlLayer,
    ],
    view: new View({
      center: fromLonLat([120.38, 36.06]),
      zoom: 12,
    }),
  })
})

// 页面卸载时解除地图与 DOM 的连接
onBeforeUnmount(() => {
  map?.setTarget(undefined)
  map = null
})
</script>

<template>
  <main class="format-page">
    <div ref="mapContainer" class="format-map"></div>

    <a :href="shapeZipUrl" class="download-button">
      下载设施点 Shapefile
    </a>
  </main>
</template>

<style scoped>
.format-page,
.format-map {
  width: 100%;
  height: 100%;
}

.format-page {
  position: relative;
}

.download-button {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  padding: 10px 14px;
  color: #ffffff;
  text-decoration: none;
  background: #2563eb;
  border-radius: 5px;
}
</style>