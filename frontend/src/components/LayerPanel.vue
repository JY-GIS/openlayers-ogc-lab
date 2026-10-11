<script setup lang="ts">

defineProps<{
  facilitiesVisible: boolean
}>()

const emit = defineEmits<{
  'visibility-change': [visible: boolean]
}>()

// 将复选框的新状态通知父组件
function handleVisibilityChange(event: Event) {
  const checkbox = event.target as HTMLInputElement
  emit('visibility-change', checkbox.checked)
}

</script>

<template>
  <aside class="layer-panel">
    <h3>WMS 图层</h3>

    <label class="layer-item">
      <input
        type="checkbox"
        :checked="facilitiesVisible"
        @change="handleVisibilityChange"
      >
      <span>设施点</span>
    </label>
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
</style>