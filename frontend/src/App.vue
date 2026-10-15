<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

import LayerPanel from './components/LayerPanel.vue'
import FeatureEditor from './components/FeatureEditor.vue'
import FeatureInfoPanel from './components/FeatureInfoPanel.vue'
import MeasurementPanel from './components/MeasurementPanel.vue'
import { createFacilitiesWmsLayer } from './services/ogcWms'
import { createFacilitiesWmtsLayer } from './services/ogcWmts'
import { createWfsLayers } from './services/ogcWfs'
import { createBaseMapLayers } from './services/baseMaps'
import { deleteFacility, insertFacility, updateFacility, updateGeometry } from './services/ogcWfsTransaction'
import type { EditableGeometryLayer, FacilityInput } from './services/ogcWfsTransaction'
import type { BaseMapType } from './services/baseMaps'
import type { WfsLoadState } from './services/ogcWfs'

import Map from 'ol/Map'    // 相当于 Cesium 的 Viewer
import View from 'ol/View'  // 相当于 Cesium 的 Camera / Scene
import type TileLayer from 'ol/layer/Tile'
import type WMTS from 'ol/source/WMTS'
import type Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import Select from 'ol/interaction/Select'
import Draw from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'

import MousePosition from 'ol/control/MousePosition'
import { createStringXY } from 'ol/coordinate'
import LineString from 'ol/geom/LineString'
import { getLength as getSphereLength } from 'ol/sphere'

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

type EditorMode =
  | 'idle'
  | 'drawing'
  | 'form'
  | 'submitting'
  | 'editing'
  | 'updating'
  | 'deleting'
  | 'geometry-editing'
  | 'geometry-updating'

// 获取模板中地图容器的 DOM 引用
const mapContainer = ref<HTMLDivElement | null>(null)

// 获取页头中坐标显示区域的 DOM 引用
const coordinateContainer = ref<HTMLDivElement | null>(null)

// 保存 OpenLayers 地图实例
let map: Map | null = null
// 保存 WFS 要素选择交互，组件卸载时用于移除
let selectInteraction: Select | null = null
// 保存点绘制交互，绘制完成或取消时用于移除
let drawInteraction: Draw | null = null
// 保存几何修改交互，提交或取消时用于移除
let modifyInteraction: Modify | null = null

type MeasurementMode = 'idle' | 'distance'

let measurementDrawInteraction: Draw | null = null
const measurementMode = ref<MeasurementMode>('idle')
const measurementResult = ref('')

// 保存当前从 WFS 选中的原始要素
let selectedWfsFeature: Feature<Geometry> | null = null
// 保存当前等待提交的临时设施点
let draftFeature: Feature<Geometry> | null = null
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
const selectedFacilityInput = ref<FacilityInput | null>(null)
const selectedGeometryLabel = ref<string | null>(null)
const selectedGeometryLayer = ref<EditableGeometryLayer | null>(null)

const editorMode = ref<EditorMode>('idle')
const transactionMessage = ref('')

const draftSource = new VectorSource<Feature<Geometry>>()

const draftPointStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#facc15' }),
    stroke: new Stroke({ color: '#111827', width: 2 }),
  }),
})

const draftLineStyle = new Style({
  stroke: new Stroke({ color: '#facc15', width: 5 }),
})

const draftPolygonStyle = new Style({
  fill: new Fill({ color: 'rgb(250 204 21 / 25%)' }),
  stroke: new Stroke({ color: '#facc15', width: 4 }),
})

const draftLayer = new VectorLayer({
  source: draftSource,
  style: feature => {
    const geometryType = feature.getGeometry()?.getType()

    if (geometryType === 'LineString') return draftLineStyle
    if (geometryType === 'Polygon') return draftPolygonStyle

    return draftPointStyle
  },
})

// 测量要素使用独立数据源，不参与 WFS-T
const measurementSource = new VectorSource<Feature<Geometry>>()

const measurementStyle = new Style({
  stroke: new Stroke({
    color: '#2563eb',
    width: 4,
  }),
})

const measurementLayer = new VectorLayer({
  source: measurementSource,
  style: measurementStyle,
})

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

// 判断选中的要素是否属于当前允许编辑的 facilities 图层
function isFacilityFeature(feature: Feature<Geometry>): boolean {
  const featureId = String(feature.getId() ?? '')
  return featureId.startsWith('facilities.') && feature.getGeometry()?.getType() === 'Point'
}

// 识别允许修改形状的道路和服务范围面
function getEditableGeometryTarget(feature: Feature<Geometry>): {
  layer: EditableGeometryLayer
  label: string
} | null {
  const featureId = String(feature.getId() ?? '')
  const geometryType = feature.getGeometry()?.getType()
  const featureName = String(feature.get('name') ?? '未命名要素')

  if (featureId.startsWith('demo_roads.') && geometryType === 'LineString') {
    return { layer: 'roads', label: `道路“${featureName}”` }
  }

  if (featureId.startsWith('demo_zones.') && geometryType === 'Polygon') {
    return { layer: 'zones', label: `服务范围面“${featureName}”` }
  }

  return null
}

// 恢复原要素样式，并清除当前 WFS 要素选择及属性状态
function clearSelectedWfsFeature() {
  selectedWfsFeature?.setStyle(undefined)
  selectInteraction?.getFeatures().clear()
  selectedWfsFeature = null
  selectedFeature.value = null
  selectedFacilityInput.value = null
  selectedGeometryLabel.value = null
  selectedGeometryLayer.value = null
}

// 使用球面算法计算长度，并根据大小选择米或千米
function formatLength(line: LineString): string {
  if (!map) return '--'

  const length = getSphereLength(line, {
    projection: map.getView().getProjection(),
  })

  if (length >= 1000) return `${(length / 1000).toFixed(2)} km`

  return `${length.toFixed(2)} m`
}

// 从地图中移除当前 Draw 交互
function removeDrawInteraction() {
  if (map && drawInteraction) {
    map.removeInteraction(drawInteraction)
  }

  drawInteraction = null
}

// 放弃未完成的测量草图，并从地图移除测量 Draw
function cancelMeasurementDrawing() {
  if (measurementDrawInteraction) {
    measurementDrawInteraction.abortDrawing()
    map?.removeInteraction(measurementDrawInteraction)
  }

  measurementDrawInteraction = null
  measurementMode.value = 'idle'

  // 测量结束后恢复 WFS 要素选择
  selectInteraction?.setActive(true)
}

// 开始绘制测距线
function startDistanceMeasurement() {
  if (!map || editorMode.value !== 'idle') return

  // 保证同一时刻只有一个测量 Draw
  cancelMeasurementDrawing()

  // 测量点击不应同时触发 WFS Select
  selectInteraction?.setActive(false)

  const interaction = new Draw({
    source: measurementSource,
    type: 'LineString',
  })

  measurementDrawInteraction = interaction
  measurementMode.value = 'distance'
  measurementResult.value = ''

  interaction.once('drawend', event => {
    const geometry = event.feature.getGeometry()

    if (geometry instanceof LineString) {
      measurementResult.value = formatLength(geometry)
    }

    // 当前版本每次点击按钮只绘制一条测量线
    map?.removeInteraction(interaction)

    if (measurementDrawInteraction === interaction) {
      measurementDrawInteraction = null
    }

    measurementMode.value = 'idle'
    selectInteraction?.setActive(true)
  })

  map.addInteraction(interaction)
}

// 从地图中移除当前 Modify 交互
function removeModifyInteraction() {
  if (map && modifyInteraction) {
    map.removeInteraction(modifyInteraction)
  }

  modifyInteraction = null
}

// 开始在地图上绘制一个临时设施点
function startFacilityInsert() {
  if (!map) return

  cancelMeasurementDrawing()
  handleWfsVisibilityChange(true)
  removeDrawInteraction()
  removeModifyInteraction()
  clearSelectedWfsFeature()
  draftSource.clear()
  draftFeature = null
  transactionMessage.value = ''

  // 绘制时暂停选择，避免一次点击同时触发 Select
  selectInteraction?.setActive(false)

  drawInteraction = new Draw({ source: draftSource, type: 'Point' })

  // 点绘制完成后保存临时 Feature，并进入属性填写阶段
  drawInteraction.once('drawend', event => {
    draftFeature = event.feature
    editorMode.value = 'form'
    removeDrawInteraction()
    selectInteraction?.setActive(true)
  })

  map.addInteraction(drawInteraction)
  editorMode.value = 'drawing'
}

// 取消当前新增或修改操作并清除临时点
function cancelFacilityEditing() {
  removeDrawInteraction()
  removeModifyInteraction()
  draftSource.clear()
  draftFeature = null
  clearSelectedWfsFeature()
  editorMode.value = 'idle'
  transactionMessage.value = ''
  selectInteraction?.setActive(true)
}

// 将选中的服务器设施点复制到临时图层并启动 Modify
function startFacilityUpdate() {
  if (!map || !selectedWfsFeature || !selectedFacilityInput.value) {
    return
  }

  cancelMeasurementDrawing()
  removeDrawInteraction()
  removeModifyInteraction()
  draftSource.clear()
  transactionMessage.value = ''

  // clone 避免提交成功前直接修改 WFS 图层中的原始要素
  draftFeature = selectedWfsFeature.clone()

  // clone 会复制 Select 的红色样式，清除后才会使用草稿图层的黄色样式
  draftFeature.setStyle(undefined)
  draftSource.addFeature(draftFeature)

  // 先清除 Select 的红色样式，再临时隐藏服务器原要素
  selectInteraction?.getFeatures().clear()
  selectedWfsFeature.setStyle([])
  selectInteraction?.setActive(false)

  modifyInteraction = new Modify({ source: draftSource })

  map.addInteraction(modifyInteraction)
  editorMode.value = 'editing'
}

// 将选中的道路或服务范围面复制到草稿图层，并允许拖动顶点
function startGeometryUpdate() {
  if (!map || !selectedWfsFeature || !selectedGeometryLabel.value) {
    return
  }

  cancelMeasurementDrawing()
  removeDrawInteraction()
  removeModifyInteraction()
  draftSource.clear()
  transactionMessage.value = ''

  draftFeature = selectedWfsFeature.clone()
  draftFeature.setStyle(undefined)
  draftSource.addFeature(draftFeature)

  selectInteraction?.getFeatures().clear()
  selectedWfsFeature.setStyle([])
  selectInteraction?.setActive(false)

  modifyInteraction = new Modify({ source: draftSource })
  map.addInteraction(modifyInteraction)
  editorMode.value = 'geometry-editing'
}

// 提交道路或服务范围面的 WFS-T Update，并重新读取服务器数据
async function submitGeometryUpdate() {
  const featureId = selectedWfsFeature?.getId()
  const geometryLayer = selectedGeometryLayer.value
  const geometryLabel = selectedGeometryLabel.value

  if (!draftFeature || !featureId || !geometryLayer) return

  editorMode.value = 'geometry-updating'
  transactionMessage.value = ''

  try {
    await updateGeometry(draftFeature, String(featureId), geometryLayer)

    removeModifyInteraction()
    draftSource.clear()
    draftFeature = null
    clearSelectedWfsFeature()
    editorMode.value = 'idle'
    transactionMessage.value = `几何修改成功：${geometryLabel ?? featureId}`
    selectInteraction?.setActive(true)

    wfsLayers.forEach(layer => {
      layer.getSource()?.refresh()
    })
  } catch (error) {
    editorMode.value = 'geometry-editing'
    transactionMessage.value = error instanceof Error
      ? error.message
      : '线面几何修改失败'
  }
}

// 提交 WFS-T Insert，并从服务器重新读取图层
async function submitFacilityInsert(input: FacilityInput) {
  if (!draftFeature) return

  editorMode.value = 'submitting'
  transactionMessage.value = ''

  try {
    const featureId = await insertFacility(draftFeature, input)

    draftSource.clear()
    draftFeature = null
    editorMode.value = 'idle'
    transactionMessage.value = `新增成功，服务端要素 ID : ${featureId}`

    // refresh 会清除范围缓存并重新执行 WFS GetFeature
    wfsLayers.forEach(layer => { layer.getSource()?.refresh() })
  } catch (error) {
    editorMode.value = 'form'
    transactionMessage.value = error instanceof Error ? error.message : '设施点新增失败'
  }
}

// 删除当前选中的服务器设施点，并重新读取 WFS 图层
async function submitFacilityDelete() {
  const featureId = selectedWfsFeature?.getId()

  if (!featureId || !selectedFacilityInput.value) return

  const confirmed = window.confirm(`确定删除设施点“${selectedFacilityInput.value.name}”吗？`)

  if (!confirmed) return

  editorMode.value = 'deleting'
  transactionMessage.value = ''

  try {
    await deleteFacility(String(featureId))

    clearSelectedWfsFeature()
    editorMode.value = 'idle'
    transactionMessage.value = `删除成功：${featureId}`

    wfsLayers.forEach(layer => {
      layer.getSource()?.refresh()
    })
  } catch (error) {
    editorMode.value = 'idle'
    transactionMessage.value = error instanceof Error ? error.message : '设施点删除失败'
  }
}

// 提交 WFS-T Update，并重新读取服务器数据
async function submitFacilityUpdate(input: FacilityInput) {
  const featureId = selectedWfsFeature?.getId()

  if (!draftFeature || !featureId) return

  editorMode.value = 'updating'
  transactionMessage.value = ''

  try {
    await updateFacility(
      draftFeature,
      input,
      String(featureId),
    )

    removeModifyInteraction()
    draftSource.clear()
    draftFeature = null
    clearSelectedWfsFeature()
    editorMode.value = 'idle'
    transactionMessage.value = `修改成功：${featureId}`
    selectInteraction?.setActive(true)

    wfsLayers.forEach(layer => {
      layer.getSource()?.refresh()
    })
  } catch (error) {
    editorMode.value = 'editing'
    transactionMessage.value = error instanceof Error ? error.message : '设施点修改失败'
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
      draftLayer,
      measurementLayer,
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

  // 保存选中要素，并在设施点被选中时准备编辑属性
  selectInteraction.on('select', event => {
    const feature = event.selected[0] as Feature<Geometry> | undefined

    selectedWfsFeature = feature ?? null
    selectedFeature.value = feature ? createSelectedFeatureInfo(feature) : null

    selectedFacilityInput.value = feature && isFacilityFeature(feature)
      ? {
          name: String(feature.get('name') ?? ''),
          facilityType: String(feature.get('facility_type') ?? ''),
          description: String(feature.get('description') ?? ''),
        }
      : null

    const geometryTarget = feature
      ? getEditableGeometryTarget(feature)
      : null

    selectedGeometryLabel.value = geometryTarget?.label ?? null
    selectedGeometryLayer.value = geometryTarget?.layer ?? null
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
  cancelMeasurementDrawing()
  removeDrawInteraction()
  removeModifyInteraction()

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
    <MeasurementPanel
      :disabled="editorMode !== 'idle'"
      :active="measurementMode === 'distance'"
      :result="measurementResult"
      @start-distance="startDistanceMeasurement"
    />
    <FeatureInfoPanel
      :visible="wfsVisible"
      :selected-feature="selectedFeature"
      :load-states="wfsLoadStates"
    />
    <FeatureEditor
      :mode="editorMode"
      :message="transactionMessage"
      :selected-facility="selectedFacilityInput"
      :selected-geometry-label="selectedGeometryLabel"
      @start="startFacilityInsert"
      @edit="startFacilityUpdate"
      @edit-geometry="startGeometryUpdate"
      @delete="submitFacilityDelete"
      @cancel="cancelFacilityEditing"
      @submit="submitFacilityInsert"
      @update="submitFacilityUpdate"
      @submit-geometry="submitGeometryUpdate"
    />
  </div>
</template>
