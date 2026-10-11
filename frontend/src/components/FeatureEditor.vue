<script setup lang="ts">
import { ref } from 'vue'

import type { FacilityInput } from '../services/ogcWfsTransaction'

type EditorMode = 'idle' | 'drawing' | 'form' | 'submitting'

defineProps<{
  mode: EditorMode
  message: string
}>()

const emit = defineEmits<{
  start: []
  cancel: []
  submit: [input: FacilityInput]
}>()

const name = ref('')
const facilityType = ref('custom')
const description = ref('')

// 清空表单并通知父组件开始绘制设施点
function startDrawing() {
  name.value = ''
  facilityType.value = 'custom'
  description.value = ''
  emit('start')
}

// 将表单属性提交给父组件
function submitFacility() {
  emit('submit', {
    name: name.value.trim(),
    facilityType: facilityType.value.trim(),
    description: description.value.trim(),
  })
}

// 通知父组件取消本次设施点新增
function cancelEditing() {
  emit('cancel')
}
</script>

<template>
  <aside class="editor-panel">
    <h3>WFS-T 设施点编辑</h3>

    <button
      v-if="mode === 'idle'"
      type="button"
      class="primary-button"
      @click="startDrawing"
    >
      新增设施点
    </button>

    <div v-else-if="mode === 'drawing'">
      <p class="editor-tip">
        请在地图上单击设施点位置
      </p>

      <button
        type="button"
        class="secondary-button"
        @click="cancelEditing"
      >
        取消绘制
      </button>
    </div>

    <form
      v-else
      class="editor-form"
      @submit.prevent="submitFacility"
    >
      <label>
        <span>名称</span>
        <input
          v-model="name"
          type="text"
          maxlength="100"
          required
        >
      </label>

      <label>
        <span>设施类型</span>
        <input
          v-model="facilityType"
          type="text"
          maxlength="50"
          required
        >
      </label>

      <label>
        <span>描述</span>
        <textarea
          v-model="description"
          maxlength="255"
          rows="3"
        ></textarea>
      </label>

      <div class="editor-actions">
        <button
          type="submit"
          class="primary-button"
          :disabled="mode === 'submitting'"
        >
          {{ mode === 'submitting' ? '提交中...' : '提交新增' }}
        </button>

        <button
          type="button"
          class="secondary-button"
          :disabled="mode === 'submitting'"
          @click="cancelEditing"
        >
          取消
        </button>
      </div>
    </form>

    <p v-if="message" class="transaction-message">
      {{ message }}
    </p>
  </aside>
</template>

<style scoped>
.editor-panel {
  position: absolute;
  top: 310px;
  right: 16px;
  z-index: 10;
  width: 180px;
  padding: 14px 16px;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}

.editor-panel h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.editor-tip,
.transaction-message {
  margin: 0 0 10px;
  color: #374151;
  font-size: 11px;
  line-height: 1.5;
}

.transaction-message {
  margin: 10px 0 0;
  overflow-wrap: anywhere;
}

.editor-form {
  display: grid;
  gap: 10px;
}

.editor-form label {
  display: grid;
  gap: 5px;
  color: #374151;
  font-size: 13px;
}

.editor-form input,
.editor-form textarea {
  width: 100%;
  padding: 7px 8px;
  font: inherit;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.editor-form textarea {
  resize: vertical;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.primary-button,
.secondary-button {
  padding: 7px 10px;
  font: inherit;
  border-radius: 5px;
  cursor: pointer;
}

.primary-button {
  color: #ffffff;
  background: #2563eb;
  border: 1px solid #2563eb;
}

.secondary-button {
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
}

.primary-button:disabled,
.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>