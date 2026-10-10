<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

import Map from 'ol/Map'    // 相当于 Cesium 的 Viewer
import View from 'ol/View'  // 相当于 Cesium 的 Camera / Scene

import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import MousePosition from 'ol/control/MousePosition'
import { createStringXY } from 'ol/coordinate'

// 坐标转换
import { fromLonLat } from 'ol/proj'

// OpenLayers 自带的地图控件样式
import 'ol/ol.css'

// 获取模板中地图容器的 DOM 引用
const mapContainer = ref<HTMLDivElement | null>(null)

// 获取页头中坐标显示区域的 DOM 引用
const coordinateContainer = ref<HTMLDivElement | null>(null)

// 保存 OpenLayers 地图实例
let map: Map | null = null

// Vue 组件挂载后初始化地图
onMounted(() => {
  if (!mapContainer.value || !coordinateContainer.value) return

  // 初始化地图
  map = new Map({
    // 将地图挂载到指定 HTML 元素
    target: mapContainer.value,

    // 地图图层
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
    ],

    // 地图初始视图
    view: new View({
      center: fromLonLat([114.05, 22.54]),  // 坐标转换 4326 -> 3857
      zoom: 12,
    }),
  })

  // 将鼠标所在位置转换成经纬度，并显示到页头
  map.addControl(new MousePosition({
    coordinateFormat: createStringXY(6),
    projection: 'EPSG:4326',
    target: coordinateContainer.value,
    placeholder: '--',
    className: 'coordinate-value',
  }))
})

// 组件卸载时解除地图挂载
onBeforeUnmount(() => {
  map?.setTarget(undefined)
  map = null
})
</script>

<template>
  <div class="page">
    <header class="header">
      <h2>OpenLayers OGC Lab</h2>
      <div class="header-info">
        <span>二维 WebGIS 空间数据实验平台</span>

        <div class="coordinate-display">
          <span>经纬度：</span>
          <div ref="coordinateContainer"></div>
        </div>
      </div>
    </header>

    <main ref="mapContainer" class="map"></main>
  </div>
</template>
