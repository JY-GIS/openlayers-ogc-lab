<script setup lang="ts">
import type { BaseMapType } from '../services/baseMaps'

defineProps<{
  selectedBaseMap: BaseMapType
  facilitiesVisible: boolean
  facilitiesWmtsVisible: boolean
}>()

const emit = defineEmits<{
  'base-map-change': [baseMap: BaseMapType]
  'visibility-change': [visible: boolean]
  'wmts-visibility-change': [visible: boolean]
}>()

// 将用户选择的底图通知父组件
function selectBaseMap(baseMap: BaseMapType) {
  emit('base-map-change', baseMap)
}

// 将复选框的新状态通知父组件
function handleVisibilityChange(event: Event) {
  const checkbox = event.target as HTMLInputElement
  emit('visibility-change', checkbox.checked)
}

// 将 WMTS 复选框的新状态通知父组件
function handleWmtsVisibilityChange(event: Event) {
  const checkbox = event.target as HTMLInputElement
  emit('wmts-visibility-change', checkbox.checked)
}

</script>

<template>
  <aside class="layer-panel">
    <section class="layer-section">
      <h3>底图</h3>

      <label class="layer-item">
        <input
          type="radio"
          name="base-map"
          :checked="selectedBaseMap === 'osm'"
          @change="selectBaseMap('osm')"
        >
        <span>OpenStreetMap</span>
      </label>

      <label class="layer-item">
        <input
          type="radio"
          name="base-map"
          :checked="selectedBaseMap === 'topographic'"
          @change="selectBaseMap('topographic')"
        >
        <span>地形底图</span>
      </label>
    </section>

    <section class="layer-section">
      <h3>OGC 图层</h3>

      <label class="layer-item">
        <input
          type="checkbox"
          :checked="facilitiesVisible"
          @change="handleVisibilityChange"
        >
        <span>WMS 设施点</span>
      </label>

      <label class="layer-item">
        <input
          type="checkbox"
          :checked="facilitiesWmtsVisible"
          @change="handleWmtsVisibilityChange"
        >
        <span>WMTS 设施点</span>
      </label>
    </section>
  </aside>
</template>

<style scoped>
.layer-panel {
  position: absolute;
  top: 61px;
  right: 16px;
  z-index: 10;
  width: 180px;
  padding: 14px 16px;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}

.layer-panel h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}

.layer-section + .layer-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.layer-item + .layer-item {
  margin-top: 8px;
}
</style>