<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

import LayerPanel from './components/LayerPanel.vue'
import FeatureInfoPanel from './components/FeatureInfoPanel.vue'
import { createFacilitiesWmsLayer } from './services/ogcWms'
import { createFacilitiesWmtsLayer } from './services/ogcWmts'
import { createWfsLayers } from './services/ogcWfs'
import { createBaseMapLayers } from './services/baseMaps'
import type { BaseMapType } from './services/baseMaps'
import type { WfsLoadState } from './services/ogcWfs'

import Map from 'ol/Map'    // 相当于 Cesium 的 Viewer
import View from 'ol/View'  // 相当于 Cesium 的 Camera / Scene
import type TileLayer from 'ol/layer/Tile'
import type WMTS from 'ol/source/WMTS'
import type Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import Select from 'ol/interaction/Select'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'

import MousePosition from 'ol/control/MousePosition'
import { createStringXY } from 'ol/coordinate'

// 坐标转换
import { fromLonLat } from 'ol/proj'

// OpenLayers 自带的地图控件样式
import 'ol/ol.css'

interface SelectedFeatureInfo {
  id: string
  name: string
  category: string
  geometryType: string
}

// 获取模板中地图容器的 DOM 引用
const mapContainer = ref<HTMLDivElement | null>(null)

// 获取页头中坐标显示区域的 DOM 引用
const coordinateContainer = ref<HTMLDivElement | null>(null)

// 保存 OpenLayers 地图实例
let map: Map | null = null
// 保存 WFS 要素选择交互，组件卸载时用于移除
let selectInteraction: Select | null = null
// 保存当前选择的底图
const selectedBaseMap = ref<BaseMapType>('osm')
// 创建标准地图和地形地图两个底图
const baseMapLayers = createBaseMapLayers()
// 切换底图并保证同一时刻只显示一个底图
function handleBaseMapChange(baseMap: BaseMapType) {
  selectedBaseMap.value = baseMap
  baseMapLayers.osmLayer.setVisible(baseMap === 'osm')
  baseMapLayers.topographicLayer.setVisible(baseMap === 'topographic')
}

const facilitiesWmsVisible = ref(true)
const facilitiesWmsLayer = createFacilitiesWmsLayer()
const facilitiesWmtsVisible = ref(false)
// 保存异步创建的设施点 WMTS 图层
let facilitiesWmtsLayer: TileLayer<WMTS> | null = null
const wfsVisible = ref(false)
const selectedFeature = ref<SelectedFeatureInfo | null>(null)

const wfsLoadStates = ref<WfsLoadState[]>([
  { key: 'facilities', label: '设施点', status: 'idle' },
  { key: 'roads', label: '道路', status: 'idle' },
  { key: 'zones', label: '服务范围面', status: 'idle' },
])

// 更新指定 WFS 图层的加载状态
function handleWfsLoadState(nextState: WfsLoadState) {
  wfsLoadStates.value = wfsLoadStates.value.map(currentState =>
    currentState.key === nextState.key ? nextState : currentState,
  )
}

const selectedWfsStyle = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: '#ef4444' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
  fill: new Fill({ color: 'rgb(239 68 68 / 22%)' }),
  stroke: new Stroke({ color: '#ef4444', width: 3 }),
})

const wfsLayers = createWfsLayers(handleWfsLoadState)

// 同步界面状态并切换全部 WFS 矢量图层
function handleWfsVisibilityChange(visible: boolean) {
  wfsVisible.value = visible
  wfsLayers.forEach(layer => layer.setVisible(visible))

  if (!visible) {
    selectInteraction?.getFeatures().clear()
    selectedFeature.value = null
  }
}
// 同步界面状态并切换设施点 WMTS 图层
function handleFacilitiesWmtsVisibilityChange(visible: boolean) {
  facilitiesWmtsVisible.value = visible
  facilitiesWmtsLayer?.setVisible(visible)
}
// 同步界面状态并切换设施点 WMS 图层
function handleFacilitiesVisibilityChange(visible: boolean) {
  facilitiesWmsVisible.value = visible
  facilitiesWmsLayer.setVisible(visible)
}

// 从三种测试图层中读取对应的业务类型字段
function getFeatureCategory(feature: Feature<Geometry>): string {
  const category = feature.get('facility_type') ?? feature.get('road_level') ?? feature.get('zone_type')
  return String(category ?? '--')
}

// 将 OpenLayers Feature 转换成属性面板需要的数据
function createSelectedFeatureInfo(feature: Feature<Geometry>): SelectedFeatureInfo {
  return {
    id: String(feature.get('id') ?? feature.getId() ?? '--'),
    name: String(feature.get('name') ?? '--'),
    category: getFeatureCategory(feature),
    geometryType: feature.getGeometry()?.getType() ?? '--',
  }
}

// Vue 组件挂载后初始化地图
onMounted(async () => {
  if (!mapContainer.value || !coordinateContainer.value) return

  // 初始化地图
  map = new Map({
    // 将地图挂载到指定 HTML 元素
    target: mapContainer.value,

    // 地图图层
    layers: [
      baseMapLayers.osmLayer,
      baseMapLayers.topographicLayer,
      facilitiesWmsLayer,
      ...wfsLayers,
    ],

    // 地图初始视图
    view: new View({
      center: fromLonLat([120.38, 36.06]),  // 坐标转换 4326 -> 3857
      zoom: 12,
    }),
  })

  // 创建只作用于 WFS 图层的点击选择交互
  selectInteraction = new Select({
    layers: wfsLayers,
    hitTolerance: 6,
    style: selectedWfsStyle,
  })

  // 将选中的 OpenLayers Feature 转换成属性面板数据
  selectInteraction.on('select', event => {
    const feature = event.selected[0] as Feature<Geometry> | undefined
    selectedFeature.value = feature ? createSelectedFeatureInfo(feature) : null
  })

  map.addInteraction(selectInteraction)

  // 将鼠标所在位置转换成经纬度，并显示到页头
  map.addControl(new MousePosition({
    coordinateFormat: createStringXY(6),
    projection: 'EPSG:4326',
    target: coordinateContainer.value,
    placeholder: '--',
    className: 'coordinate-value',
  }))

  // 读取能力文档后，将设施点 WMTS 图层加入地图
  facilitiesWmtsLayer = await createFacilitiesWmtsLayer()
  facilitiesWmtsLayer.setVisible(facilitiesWmtsVisible.value)
  map.addLayer(facilitiesWmtsLayer)
})

// 组件卸载时解除地图挂载
onBeforeUnmount(() => {
  if (map && selectInteraction) {
    map.removeInteraction(selectInteraction)
  }

  selectInteraction = null
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
    <LayerPanel
      :selected-base-map="selectedBaseMap"
      :facilities-visible="facilitiesWmsVisible"
      :facilities-wmts-visible="facilitiesWmtsVisible"
      :wfs-visible="wfsVisible"
      @base-map-change="handleBaseMapChange"
      @visibility-change="handleFacilitiesVisibilityChange"
      @wmts-visibility-change="handleFacilitiesWmtsVisibilityChange"
      @wfs-visibility-change="handleWfsVisibilityChange"
    />
    <FeatureInfoPanel
      :visible="wfsVisible"
      :selected-feature="selectedFeature"
      :load-states="wfsLoadStates"
    />
  </div>
</template>
