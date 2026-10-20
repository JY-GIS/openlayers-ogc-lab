<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'

import LayerPanel from './components/LayerPanel.vue'
import FeatureEditor from './components/FeatureEditor.vue'
import FeatureInfoPanel from './components/FeatureInfoPanel.vue'
import FeaturePopup from './components/FeaturePopup.vue'
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
import Overlay from 'ol/Overlay'
import View from 'ol/View'  // 相当于 Cesium 的 Camera / Scene
import type { EventsKey } from 'ol/events'
import type TileLayer from 'ol/layer/Tile'
import type WMTS from 'ol/source/WMTS'
import type Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import Select from 'ol/interaction/Select'
import Draw from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import Snap from 'ol/interaction/Snap'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'

import MousePosition from 'ol/control/MousePosition'
import { createStringXY } from 'ol/coordinate'
import type { Coordinate } from 'ol/coordinate'
import LineString from 'ol/geom/LineString'
import Polygon from 'ol/geom/Polygon'
import { unByKey } from 'ol/Observable'
import { getArea as getSphereArea, getLength as getSphereLength } from 'ol/sphere'

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
// 只向属性弹窗组件提供地图实例，不深度代理 OpenLayers 对象
const mapInstance = shallowRef<Map | null>(null)
// 保存 WFS 要素选择交互，组件卸载时用于移除
let selectInteraction: Select | null = null
// 保存点绘制交互，绘制完成或取消时用于移除
let drawInteraction: Draw | null = null
// 保存几何修改交互，提交或取消时用于移除
let modifyInteraction: Modify | null = null
// 保存设施点新增时的道路吸附交互
let snapInteraction: Snap | null = null

type MeasurementMode = 'idle' | 'distance' | 'area'
type ActiveMeasurementMode = Exclude<MeasurementMode, 'idle'>

let measurementDrawInteraction: Draw | null = null
let measurementGeometryChangeKey: EventsKey | null = null
let measurementDrawEventKeys: EventsKey[] = []
let activeMeasurementOverlay: Overlay | null = null
const completedMeasurementOverlays: Overlay[] = []
let selectActiveBeforeMeasurement = true
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
const featurePopupCoordinate = ref<Coordinate | undefined>(undefined)
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
  fill: new Fill({
    color: 'rgb(37 99 235 / 18%)',
  }),
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

const { layers: wfsLayers, roadSource } = createWfsLayers(handleWfsLoadState)

// 同步界面状态并切换全部 WFS 矢量图层
function handleWfsVisibilityChange(visible: boolean) {
  wfsVisible.value = visible
  wfsLayers.forEach(layer => layer.setVisible(visible))

  if (!visible) {
    selectInteraction?.getFeatures().clear()
    selectedFeature.value = null
    hideFeaturePopup()
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

// 只隐藏属性弹窗，不清除 WFS-T 编辑仍需使用的要素引用
function hideFeaturePopup() {
  featurePopupCoordinate.value = undefined
}

// 恢复原要素样式，并清除当前 WFS 要素选择及属性状态
function clearSelectedWfsFeature() {
  selectedWfsFeature?.setStyle(undefined)
  selectInteraction?.getFeatures().clear()
  selectedWfsFeature = null
  selectedFeature.value = null
  hideFeaturePopup()
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

// 使用球面算法计算面积，并根据大小选择平方米或平方千米
function formatArea(polygon: Polygon): string {
  if (!map) return '--'

  const area = getSphereArea(polygon, {
    projection: map.getView().getProjection(),
  })

  if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`

  return `${area.toFixed(2)} m²`
}

// 解除当前草图几何的实时变化监听
function removeMeasurementGeometryChangeListener() {
  if (!measurementGeometryChangeKey) return

  unByKey(measurementGeometryChangeKey)
  measurementGeometryChangeKey = null
}

// 解除当前测量 Draw 的开始与结束监听
function removeMeasurementDrawEventListeners() {
  if (measurementDrawEventKeys.length === 0) return

  unByKey(measurementDrawEventKeys)
  measurementDrawEventKeys = []
}

// 创建一个跟随测量几何的地图标签
function createMeasurementOverlay(): Overlay | null {
  if (!map) return null

  const element = document.createElement('div')
  element.className = 'measurement-tooltip measurement-tooltip--active'

  const overlay = new Overlay({
    element,
    offset: [0, -12],
    positioning: 'bottom-center',
    stopEvent: false,
  })

  map.addOverlay(overlay)
  return overlay
}

// 移除未完成测量使用的实时标签
function removeActiveMeasurementOverlay() {
  if (!activeMeasurementOverlay) return

  map?.removeOverlay(activeMeasurementOverlay)
  activeMeasurementOverlay.getElement()?.remove()
  activeMeasurementOverlay = null
}

// 根据草图的当前几何更新面板和地图标签
function updateMeasurementResult(mode: ActiveMeasurementMode, geometry: Geometry) {
  let result: string
  let position: number[]

  if (mode === 'distance' && geometry instanceof LineString) {
    result = formatLength(geometry)
    position = geometry.getLastCoordinate()
  } else if (mode === 'area' && geometry instanceof Polygon) {
    result = formatArea(geometry)
    position = geometry.getInteriorPoint().getCoordinates()
  } else {
    return
  }

  measurementResult.value = result

  const element = activeMeasurementOverlay?.getElement()
  if (element) element.textContent = result

  activeMeasurementOverlay?.setPosition(position)
}

// 将实时标签转换为保留在地图上的最终结果标签
function finishMeasurementOverlay() {
  if (!activeMeasurementOverlay) return

  const element = activeMeasurementOverlay.getElement()
  element?.classList.remove('measurement-tooltip--active')
  element?.classList.add('measurement-tooltip--static')

  completedMeasurementOverlays.push(activeMeasurementOverlay)
  activeMeasurementOverlay = null
}

// 从地图中移除当前 Draw 交互
function removeDrawInteraction() {
  if (map && drawInteraction) {
    map.removeInteraction(drawInteraction)
  }

  drawInteraction = null
}

// 从地图中移除设施点新增使用的 Snap 交互
function removeSnapInteraction() {
  if (map && snapInteraction) {
    map.removeInteraction(snapInteraction)
  }

  snapInteraction = null
}

// 放弃未完成的测量草图，并从地图移除测量 Draw
function cancelMeasurementDrawing() {
  const hadActiveMeasurement = measurementDrawInteraction !== null
    || measurementMode.value !== 'idle'

  if (!hadActiveMeasurement) return

  if (measurementDrawInteraction) {
    measurementDrawInteraction.abortDrawing()
    map?.removeInteraction(measurementDrawInteraction)
  }

  removeMeasurementGeometryChangeListener()
  removeMeasurementDrawEventListeners()
  removeActiveMeasurementOverlay()
  measurementDrawInteraction = null
  measurementMode.value = 'idle'
  measurementResult.value = ''

  // 恢复进入测量之前的 Select 激活状态
  selectInteraction?.setActive(selectActiveBeforeMeasurement)
}

// 清空未完成草图、已完成要素与全部结果标签
function clearMeasurements() {
  cancelMeasurementDrawing()
  measurementSource.clear()
  measurementResult.value = ''

  completedMeasurementOverlays.forEach(overlay => {
    map?.removeOverlay(overlay)
    overlay.getElement()?.remove()
  })
  completedMeasurementOverlays.length = 0
}

// 根据测量模式创建线或面的 Draw 交互
function startMeasurement(mode: ActiveMeasurementMode) {
  if (!map || editorMode.value !== 'idle') return

  // 保证同一时刻只有一个测量 Draw
  cancelMeasurementDrawing()
  hideFeaturePopup()

  // 测量点击不应同时触发 WFS Select
  selectActiveBeforeMeasurement = selectInteraction?.getActive() ?? false
  selectInteraction?.setActive(false)

  const interaction = new Draw({
    source: measurementSource,
    type: mode === 'distance' ? 'LineString' : 'Polygon',
  })

  measurementDrawInteraction = interaction
  measurementMode.value = mode
  measurementResult.value = ''

  const drawStartKey = interaction.on('drawstart', event => {
    const geometry = event.feature.getGeometry()
    if (!geometry) return

    removeMeasurementGeometryChangeListener()
    removeActiveMeasurementOverlay()
    activeMeasurementOverlay = createMeasurementOverlay()

    const updateResult = () => updateMeasurementResult(mode, geometry)
    updateResult()
    measurementGeometryChangeKey = geometry.on('change', updateResult)
  })

  const drawEndKey = interaction.on('drawend', event => {
    const geometry = event.feature.getGeometry()

    if (geometry) updateMeasurementResult(mode, geometry)

    removeMeasurementGeometryChangeListener()
    finishMeasurementOverlay()

    // 当前版本每次点击按钮只绘制一个测量图形
    map?.removeInteraction(interaction)

    if (measurementDrawInteraction === interaction) {
      measurementDrawInteraction = null
    }

    removeMeasurementDrawEventListeners()
    measurementMode.value = 'idle'
    selectInteraction?.setActive(selectActiveBeforeMeasurement)
  })

  measurementDrawEventKeys = [drawStartKey, drawEndKey]

  map.addInteraction(interaction)
}

function startDistanceMeasurement() {
  startMeasurement('distance')
}

function startAreaMeasurement() {
  startMeasurement('area')
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
  removeSnapInteraction()
  removeModifyInteraction()
  clearSelectedWfsFeature()
  draftSource.clear()
  draftFeature = null
  transactionMessage.value = ''

  // 绘制时暂停选择，避免一次点击同时触发 Select
  selectInteraction?.setActive(false)

  drawInteraction = new Draw({ source: draftSource, type: 'Point' })
  snapInteraction = new Snap({
    source: roadSource,
    pixelTolerance: 10,
    vertex: true,
    edge: true,
  })

  // 点绘制完成后保存临时 Feature，并进入属性填写阶段
  drawInteraction.once('drawend', event => {
    draftFeature = event.feature
    editorMode.value = 'form'
    removeSnapInteraction()
    removeDrawInteraction()
    selectInteraction?.setActive(true)
  })

  // 交互会按添加顺序的反向处理：Snap 后添加，但会先处理指针事件
  map.addInteraction(drawInteraction)
  map.addInteraction(snapInteraction)
  editorMode.value = 'drawing'
}

// 取消当前新增或修改操作并清除临时点
function cancelFacilityEditing() {
  removeDrawInteraction()
  removeSnapInteraction()
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
  hideFeaturePopup()
  removeDrawInteraction()
  removeSnapInteraction()
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
  hideFeaturePopup()
  removeDrawInteraction()
  removeSnapInteraction()
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
  mapInstance.value = map

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
    featurePopupCoordinate.value = feature ? event.mapBrowserEvent?.coordinate : undefined

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
  clearMeasurements()
  removeDrawInteraction()
  removeSnapInteraction()
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
      :mode="measurementMode"
      :result="measurementResult"
      @start-distance="startDistanceMeasurement"
      @start-area="startAreaMeasurement"
      @cancel="cancelMeasurementDrawing"
      @clear="clearMeasurements"
    />
    <FeatureInfoPanel
      :visible="wfsVisible"
      :selected-feature="selectedFeature"
      :load-states="wfsLoadStates"
    />
    <FeaturePopup
      :map="mapInstance"
      :selected-feature="selectedFeature"
      :coordinate="featurePopupCoordinate"
      @close="clearSelectedWfsFeature"
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
