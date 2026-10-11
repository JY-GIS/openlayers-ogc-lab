<script setup lang="ts">
import { ref } from 'vue'

import type { FacilityInput } from '../services/ogcWfsTransaction'

type EditorMode =
  | 'idle'
  | 'drawing'
  | 'form'
  | 'submitting'
  | 'editing'
  | 'updating'

const props = defineProps<{
  mode: EditorMode
  message: string
  selectedFacility: FacilityInput | null
}>()

const emit = defineEmits<{
  start: []
  edit: []
  cancel: []
  submit: [input: FacilityInput]
  update: [input: FacilityInput]
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

// 使用选中设施点的现有属性初始化修改表单
function startUpdating() {
  if (!props.selectedFacility) return

  name.value = props.selectedFacility.name
  facilityType.value = props.selectedFacility.facilityType
  description.value = props.selectedFacility.description
  emit('edit')
}

// 将表单属性提交给父组件
function submitFacility() {
  const input: FacilityInput = {
    name: name.value.trim(),
    facilityType: facilityType.value.trim(),
    description: description.value.trim(),
  }

  if (props.mode === 'editing') {
    emit('update', input)
    return
  }

  emit('submit', input)
}

// 通知父组件取消本次设施点新增
function cancelEditing() {
  emit('cancel')
}
</script>

<template>
  <aside class="editor-panel">
    <h3>WFS-T 设施点编辑</h3>

    <div v-if="mode === 'idle'" class="idle-actions">
      <button
          type="button"
          class="primary-button"
          @click="startDrawing"
      >
        新增设施点
      </button>

      <button
        type="button"
        :class="selectedFacility ? 'primary-button' : 'secondary-button'"
        :disabled="!selectedFacility"
        @click="startUpdating"
      >
        修改选中设施点
      </button>
    </div>

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
      <p v-if="mode === 'editing'" class="editor-tip">
        可拖动黄色设施点修改位置，也可以直接修改属性
      </p>
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
          :disabled="mode === 'submitting' || mode === 'updating'"
        >
          {{
             mode === 'submitting'
               ? '提交中...' : mode === 'updating'
                 ? '修改中...' : mode === 'editing'
                   ? '提交修改' : '提交新增'
          }}
        </button>

        <button
          type="button"
          class="secondary-button"
          :disabled="mode === 'submitting' || mode === 'updating'"
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

.idle-actions {
  display: grid;
  gap: 8px;
}
</style>