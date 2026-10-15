<script setup lang="ts">
defineProps<{
  disabled: boolean
  active: boolean
  result: string
}>()

defineEmits<{
  'start-distance': []
}>()
</script>

<template>
  <aside class="measurement-panel">
    <h3>地图测量</h3>

    <button
      type="button"
      class="primary-button"
      :disabled="disabled || active"
      @click="$emit('start-distance')"
    >
      {{ active ? '测距中...' : '测距' }}
    </button>

    <p v-if="active" class="measurement-tip">
      单击添加线段顶点，双击结束绘制
    </p>

    <p v-if="result" class="measurement-result">
      测量结果：{{ result }}
    </p>
  </aside>
</template>

<style scoped>
.measurement-panel {
  position: absolute;
  top: 61px;
  left: 16px;
  z-index: 10;
  width: 190px;
  padding: 14px 16px;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}

.measurement-panel h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.primary-button {
  width: 100%;
  padding: 7px 10px;
  color: #ffffff;
  font: inherit;
  background: #2563eb;
  border: 1px solid #2563eb;
  border-radius: 5px;
  cursor: pointer;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.measurement-tip,
.measurement-result {
  margin: 10px 0 0;
  color: #374151;
  font-size: 12px;
  line-height: 1.5;
}

.measurement-result {
  font-weight: 600;
}
</style>
