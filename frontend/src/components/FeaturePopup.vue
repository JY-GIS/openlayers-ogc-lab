<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type Map from 'ol/Map'
import Overlay from 'ol/Overlay'
import type { Coordinate } from 'ol/coordinate'

interface SelectedFeatureInfo {
  id: string
  name: string
  category: string
  geometryType: string
}

const props = defineProps<{
  map: Map | null
  selectedFeature: SelectedFeatureInfo | null
  coordinate?: Coordinate
}>()

const emit = defineEmits<{
  close: []
}>()

const popupElement = ref<HTMLDivElement | null>(null)
let popupOverlay: Overlay | null = null
let overlayMap: Map | null = null

function removePopupOverlay() {
  if (overlayMap && popupOverlay) {
    overlayMap.removeOverlay(popupOverlay)
  }

  popupOverlay = null
  overlayMap = null
}

function createPopupOverlay() {
  removePopupOverlay()

  if (!props.map || !popupElement.value) return

  popupOverlay = new Overlay({
    element: popupElement.value,
    positioning: 'bottom-center',
    offset: [0, -12],
    stopEvent: true,
  })

  props.map.addOverlay(popupOverlay)
  overlayMap = props.map
  popupOverlay.setPosition(props.coordinate)
}

watch(() => props.map, createPopupOverlay)
watch(() => props.coordinate, coordinate => {
  popupOverlay?.setPosition(coordinate)
})

onMounted(createPopupOverlay)
onBeforeUnmount(removePopupOverlay)
</script>

<template>
  <div ref="popupElement" class="feature-popup">
    <button
      class="close-button"
      type="button"
      aria-label="关闭要素属性弹窗"
      @click="emit('close')"
    >
      ×
    </button>

    <dl v-if="selectedFeature" class="feature-properties">
      <dt>名称</dt>
      <dd>{{ selectedFeature.name }}</dd>

      <dt>编号</dt>
      <dd>{{ selectedFeature.id }}</dd>

      <dt>类型</dt>
      <dd>{{ selectedFeature.category }}</dd>

      <dt>几何类型</dt>
      <dd>{{ selectedFeature.geometryType }}</dd>
    </dl>
  </div>
</template>

<style scoped>
.feature-popup {
  position: relative;
  min-width: 220px;
  padding: 12px 36px 12px 14px;
  background: rgb(255 255 255 / 96%);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 3px 12px rgb(0 0 0 / 18%);
}

.close-button {
  position: absolute;
  top: 5px;
  right: 7px;
  padding: 2px 5px;
  color: #6b7280;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.close-button:hover {
  color: #111827;
}

.feature-popup::after {
  position: absolute;
  left: 50%;
  bottom: -7px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-right: 1px solid #d1d5db;
  border-bottom: 1px solid #d1d5db;
  content: '';
  transform: translateX(-50%) rotate(45deg);
}

.feature-properties {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 6px 10px;
  margin: 0;
  font-size: 13px;
}

.feature-properties dt {
  color: #6b7280;
}

.feature-properties dd {
  margin: 0;
  color: #111827;
  overflow-wrap: anywhere;
}
</style>
