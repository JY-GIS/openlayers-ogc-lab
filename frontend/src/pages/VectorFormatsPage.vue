<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import GML32 from 'ol/format/GML32'
import WFS from 'ol/format/WFS'
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
  outputFormat: 'application/gml+xml; version=3.2',
  srsName: 'EPSG:3857',
})

const gmlSource = new VectorSource({
  url: `/geoserver/ogc_lab/ows?${params.toString()}`,
  format: new WFS({
    version: '2.0.0',
    featureNS: 'http://localhost/ogc_lab',
    featureType: 'facilities',
    gmlFormat: new GML32(),
  }),
})

const gmlLayer = new VectorLayer({
  source: gmlSource,
})

// 页面挂载后创建独立地图
onMounted(() => {
  if (!mapContainer.value) return

  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
      gmlLayer,
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
  <main ref="mapContainer" class="format-map"></main>
</template>

<style scoped>
.format-map {
  width: 100%;
  height: 100%;
}
</style>