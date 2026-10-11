<script setup lang="ts">
import type { WfsLoadState } from '../services/ogcWfs'

interface SelectedFeatureInfo {
  id: string
  name: string
  category: string
  geometryType: string
}

defineProps<{
  visible: boolean
  selectedFeature: SelectedFeatureInfo | null
  loadStates: WfsLoadState[]
}>()
</script>

<template>
  <aside v-if="visible" class="feature-panel">
    <section>
      <h3>WFS 加载状态</h3>

      <div
        v-for="state in loadStates"
        :key="state.key"
        class="load-state"
      >
        <span>{{ state.label }}</span>

        <span v-if="state.status === 'idle'" class="state-idle">
          未请求
        </span>

        <span v-else-if="state.status === 'loading'" class="state-loading">
          加载中
        </span>

        <span
          v-else-if="state.status === 'success' && state.count === 0"
          class="state-empty"
        >
          当前范围无数据
        </span>

        <span
          v-else-if="state.status === 'success'"
          class="state-success"
        >
          {{ state.count }} 个
        </span>

        <span v-else class="state-error">
          {{ state.message }}
        </span>
      </div>
    </section>

    <section class="feature-section">
      <h3>要素属性</h3>

      <dl v-if="selectedFeature" class="feature-properties">
        <dt>编号</dt>
        <dd>{{ selectedFeature.id }}</dd>

        <dt>名称</dt>
        <dd>{{ selectedFeature.name }}</dd>

        <dt>类型</dt>
        <dd>{{ selectedFeature.category }}</dd>

        <dt>几何类型</dt>
        <dd>{{ selectedFeature.geometryType }}</dd>
      </dl>

      <p v-else class="empty-tip">
        点击地图中的 WFS 点、线或面查看属性
      </p>
    </section>
  </aside>
</template>

<style scoped>
.feature-panel {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 10;
  width: 280px;
  padding: 14px 16px;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}

.feature-panel h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.load-state {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #374151;
  font-size: 13px;
}

.load-state + .load-state {
  margin-top: 6px;
}

.load-state span:last-child {
  text-align: right;
}

.state-idle,
.state-empty {
  color: #6b7280;
}

.state-loading {
  color: #2563eb;
}

.state-success {
  color: #15803d;
}

.state-error {
  color: #dc2626;
}

.feature-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}

.feature-properties {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 7px 10px;
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

.empty-tip {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}
</style>