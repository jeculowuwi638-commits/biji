<template>
  <el-drawer
    :model-value="modelValue"
    direction="rtl"
    size="min(780px, 95vw)"
    class="bible-drawer"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="drawer-head">
        <div>
          <span class="section-kicker">Story bible</span>
          <h3>故事记忆卡</h3>
        </div>
        <div class="head-actions">
          <span v-if="bible" class="source-note">
            基于 {{ bible.sourceChapters }} 章 · {{ formatDateTime(bible.analyzedAt) }}
          </span>
          <el-button
            size="small"
            :loading="analyzing"
            :disabled="!hasChapters"
            @click="emit('analyze')"
          >
            <el-icon><Refresh /></el-icon>
            {{ bible ? '重新分析' : '分析章节' }}
          </el-button>
        </div>
      </div>
    </template>

    <div v-if="!bible" class="bible-empty">
      <span class="empty-seal seal">记</span>
      <h3>还没有故事记忆卡</h3>
      <p>
        系统会从已导入的章节中提取人物、关系、地点、世界观规则、时间线、重要事件和未回收伏笔。
        分析结果用于续写和一致性检查。
      </p>
      <el-button
        type="primary"
        :loading="analyzing"
        :disabled="!hasChapters"
        @click="emit('analyze')"
      >
        {{ hasChapters ? '开始分析章节' : '请先导入章节' }}
      </el-button>
      <p class="empty-note">一次分析会真实调用模型；不会使用缓存结果。</p>
    </div>

    <template v-else>
      <p class="readonly-banner">
        <el-icon><Lock /></el-icon>
        人物、时间线、伏笔等统计由模型从原文提取，不能直接改写。
        发现偏差请在“纠正与补充”里追加，作者纠正的优先级更高。
      </p>

      <el-tabs v-model="activeTab" class="bible-tabs">
        <el-tab-pane label="总览" name="overview">
          <div class="tab-body">
            <p class="story-summary">{{ core.summary }}</p>

            <div class="stat-grid">
              <div v-for="stat in stats" :key="stat.label" class="stat">
                <strong class="mono">{{ stat.value }}</strong>
                <span>{{ stat.label }}</span>
              </div>
            </div>

            <section class="bible-section">
              <div class="section-head">
                <h4>当前剧情状态</h4>
                <span>{{ core.currentState?.chapter }}</span>
              </div>
              <div class="state-card">
                <div class="state-meta">
                  <span>时间 · {{ core.currentState?.time || '未标注' }}</span>
                  <span>地点 · {{ core.currentState?.location || '未标注' }}</span>
                </div>
                <p>{{ core.currentState?.summary || '尚未提取' }}</p>
                <div v-if="core.currentState?.conflicts?.length" class="conflict-list">
                  <span v-for="item in core.currentState.conflicts" :key="item">{{ item }}</span>
                </div>
              </div>
            </section>

            <section class="bible-section">
              <div class="section-head">
                <h4>不可改事实</h4>
                <span>{{ core.immutableFacts?.length || 0 }} 条</span>
              </div>
              <ul v-if="core.immutableFacts?.length" class="fact-list">
                <li v-for="(fact, index) in core.immutableFacts" :key="`${fact}-${index}`">
                  {{ fact }}
                </li>
              </ul>
              <p v-else class="section-empty">模型没有单独列出不可改事实。</p>
            </section>

            <section class="bible-section">
              <div class="section-head">
                <h4>未回收伏笔</h4>
                <span>{{ openForeshadowing.length }} 条</span>
              </div>
              <div v-if="openForeshadowing.length" class="mini-foreshadow">
                <div v-for="item in openForeshadowing" :key="item.id" class="mini-foreshadow-row">
                  <span class="open-dot" />
                  <div>
                    <strong>{{ item.label }}</strong>
                    <p>{{ item.plantedChapter }} · {{ item.description }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="section-empty">当前没有未回收伏笔。</p>
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`人物 ${core.characters?.length || 0}`" name="characters">
          <div class="tab-body">
            <div v-if="core.characters?.length" class="character-grid">
              <article v-for="character in core.characters" :key="character.name" class="character-card">
                <header>
                  <div>
                    <h4>{{ character.name }}</h4>
                    <span>{{ character.role }}</span>
                  </div>
                  <b>{{ character.status }}</b>
                </header>
                <div v-if="character.traits?.length" class="trait-list">
                  <span v-for="trait in character.traits" :key="trait">{{ trait }}</span>
                </div>
                <div class="knowledge-block">
                  <span>截至最新章节，这个人知道</span>
                  <p>{{ character.knowledge }}</p>
                </div>
                <div v-if="character.relationships?.length" class="relation-lines">
                  <p v-for="line in character.relationships" :key="line">{{ line }}</p>
                </div>
                <div class="character-foot">
                  <span v-if="character.firstChapter">首次出现 · {{ character.firstChapter }}</span>
                  <p v-if="character.arc">{{ character.arc }}</p>
                </div>
              </article>
            </div>
            <p v-else class="section-empty">尚未提取人物。</p>

            <section v-if="core.relationships?.length" class="bible-section">
              <div class="section-head">
                <h4>人物关系</h4>
                <span>{{ core.relationships.length }} 组</span>
              </div>
              <div class="relationship-list">
                <div v-for="(relation, index) in core.relationships" :key="index" class="relationship-row">
                  <strong>{{ relation.from }} → {{ relation.to }}</strong>
                  <span>{{ relation.type }}</span>
                  <p>{{ relation.description }}<template v-if="relation.status"> · {{ relation.status }}</template></p>
                </div>
              </div>
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`世界 ${(core.places?.length || 0) + (core.worldRules?.length || 0)}`" name="world">
          <div class="tab-body">
            <section class="bible-section">
              <div class="section-head">
                <h4>地点</h4>
                <span>{{ core.places?.length || 0 }} 处</span>
              </div>
              <div v-if="core.places?.length" class="place-grid">
                <div v-for="place in core.places" :key="place.name" class="place-card">
                  <strong>{{ place.name }}</strong>
                  <p>{{ place.description || '暂无描述' }}</p>
                  <span v-if="place.rules">{{ place.rules }}</span>
                  <small v-if="place.firstChapter">{{ place.firstChapter }}</small>
                </div>
              </div>
              <p v-else class="section-empty">尚未提取地点。</p>
            </section>

            <section class="bible-section">
              <div class="section-head">
                <h4>世界观规则</h4>
                <span>{{ core.worldRules?.length || 0 }} 条</span>
              </div>
              <div v-if="core.worldRules?.length" class="rule-list">
                <div v-for="rule in core.worldRules" :key="rule.name" class="rule-row">
                  <span class="rule-mark">规</span>
                  <div>
                    <strong>{{ rule.name }}</strong>
                    <p>{{ rule.rule }}</p>
                    <small v-if="rule.evidence">依据：{{ rule.evidence }}</small>
                  </div>
                </div>
              </div>
              <p v-else class="section-empty">尚未提取世界观规则。</p>
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`时间线 ${core.timeline?.length || 0}`" name="timeline">
          <div class="tab-body">
            <section class="bible-section">
              <div class="section-head">
                <h4>故事时间线</h4>
                <span>{{ core.timeline?.length || 0 }} 个节点</span>
              </div>
              <div v-if="core.timeline?.length" class="timeline-list">
                <div v-for="(item, index) in core.timeline" :key="index" class="timeline-row">
                  <div class="timeline-side">
                    <strong>{{ item.chapter }}</strong>
                    <span>{{ item.time }}</span>
                  </div>
                  <span class="timeline-dot" />
                  <div class="timeline-copy">
                    <p>{{ item.event }}</p>
                    <small v-if="item.impact">影响：{{ item.impact }}</small>
                  </div>
                </div>
              </div>
              <p v-else class="section-empty">尚未提取时间线。</p>
            </section>

            <section class="bible-section">
              <div class="section-head">
                <h4>重要事件</h4>
                <span>{{ core.events?.length || 0 }} 件</span>
              </div>
              <div v-if="core.events?.length" class="event-list">
                <div v-for="(event, index) in core.events" :key="index" class="event-row">
                  <span>{{ event.chapter }}</span>
                  <div>
                    <strong>{{ event.title }}</strong>
                    <p>{{ event.summary }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="section-empty">尚未提取重要事件。</p>
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`伏笔 ${core.foreshadowing?.length || 0}`" name="foreshadowing">
          <div class="tab-body">
            <section class="bible-section">
              <div class="section-head">
                <h4>未回收</h4>
                <span>{{ openForeshadowing.length }} 条</span>
              </div>
              <div v-if="openForeshadowing.length" class="foreshadow-list">
                <article v-for="item in openForeshadowing" :key="item.id" class="foreshadow-card open">
                  <header>
                    <span class="status-open">未回收</span>
                    <span>{{ item.plantedChapter }}</span>
                  </header>
                  <h5>{{ item.label }}</h5>
                  <p>{{ item.description }}</p>
                  <small v-if="item.note">备注：{{ item.note }}</small>
                </article>
              </div>
              <p v-else class="section-empty">当前没有未回收伏笔。</p>
            </section>

            <section class="bible-section">
              <div class="section-head">
                <h4>已回收</h4>
                <span>{{ resolvedForeshadowing.length }} 条</span>
              </div>
              <div v-if="resolvedForeshadowing.length" class="foreshadow-list">
                <article v-for="item in resolvedForeshadowing" :key="item.id" class="foreshadow-card">
                  <header>
                    <span class="status-resolved">已回收</span>
                    <span>{{ item.resolvedChapter || '回收章节未标注' }}</span>
                  </header>
                  <h5>{{ item.label }}</h5>
                  <p>{{ item.description }}</p>
                </article>
              </div>
              <p v-else class="section-empty">还没有标记为已回收的伏笔。</p>
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`纠正 ${bible.corrections?.notes?.length || 0}`" name="corrections">
          <div class="tab-body">
            <section class="correction-form-card">
              <div class="section-head">
                <h4>纠正设定 / 补充设定</h4>
                <span>只追加，不改模型统计</span>
              </div>
              <p class="correction-hint">
                比如：“周砚左手虎口的伤是十二年前留下的，不是新伤”或“林澄不知道铜钥匙属于 307 房”。
                这些内容会以更高优先级进入续写和检查上下文。
              </p>
              <div class="correction-form">
                <el-select v-model="correctionType" style="width: 150px">
                  <el-option
                    v-for="type in correctionTypes"
                    :key="type.key"
                    :label="type.label"
                    :value="type.key"
                  />
                </el-select>
                <el-input
                  v-model="correctionTarget"
                  maxlength="100"
                  placeholder="对象（可选），如：周砚 / 白塔"
                />
              </div>
              <el-input
                v-model="correctionContent"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 6 }"
                maxlength="800"
                show-word-limit
                resize="none"
                placeholder="写清楚要纠正或补充的设定。"
              />
              <div class="correction-actions">
                <span>提交后会立即进入续写上下文。</span>
                <el-button
                  type="primary"
                  size="small"
                  :loading="savingCorrection"
                  :disabled="!correctionContent.trim()"
                  @click="submitCorrection"
                >
                  追加纠正
                </el-button>
              </div>
            </section>

            <section class="bible-section">
              <div class="section-head">
                <h4>已追加</h4>
                <span>{{ bible.corrections?.notes?.length || 0 }} 条</span>
              </div>
              <div v-if="bible.corrections?.notes?.length" class="correction-list">
                <article
                  v-for="note in bible.corrections.notes"
                  :key="note.id"
                  class="correction-row"
                >
                  <div class="correction-row-head">
                    <span class="correction-type">{{ note.typeLabel }}</span>
                    <strong v-if="note.target">{{ note.target }}</strong>
                    <span class="correction-date">{{ formatDateTime(note.createdAt) }}</span>
                    <el-button text size="small" @click="removeCorrection(note)">
                      删除
                    </el-button>
                  </div>
                  <p>{{ note.content }}</p>
                </article>
              </div>
              <p v-else class="section-empty">还没有作者纠正。模型结果保持原样。</p>
            </section>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { novelApi } from '../api';
import { formatDateTime } from '../utils/format';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  novelId: { type: [Number, String], required: true },
  bible: { type: Object, default: null },
  analyzing: { type: Boolean, default: false },
  hasChapters: { type: Boolean, default: false },
  correctionTypes: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'analyze', 'updated']);

const activeTab = ref('overview');
const correctionType = ref('character');
const correctionTarget = ref('');
const correctionContent = ref('');
const savingCorrection = ref(false);

const fallbackTypes = [
  { key: 'character', label: '人物与关系' },
  { key: 'place', label: '地点' },
  { key: 'world-rule', label: '世界观规则' },
  { key: 'timeline', label: '时间线' },
  { key: 'fact', label: '不可改事实' },
  { key: 'other', label: '其他' },
];
const correctionTypes = computed(() =>
  props.correctionTypes?.length ? props.correctionTypes : fallbackTypes
);

const core = computed(() => props.bible?.core || {});
const openForeshadowing = computed(() =>
  (core.value.foreshadowing || []).filter((item) => item.status === 'open')
);
const resolvedForeshadowing = computed(() =>
  (core.value.foreshadowing || []).filter((item) => item.status !== 'open')
);
const stats = computed(() => [
  { label: '人物', value: core.value.characters?.length || 0 },
  { label: '地点', value: core.value.places?.length || 0 },
  { label: '世界规则', value: core.value.worldRules?.length || 0 },
  { label: '时间节点', value: core.value.timeline?.length || 0 },
  { label: '重要事件', value: core.value.events?.length || 0 },
  { label: '未回收伏笔', value: openForeshadowing.value.length },
]);

async function submitCorrection() {
  const content = correctionContent.value.trim();
  if (!content || savingCorrection.value) return;
  savingCorrection.value = true;
  try {
    const data = await novelApi.addCorrection(props.novelId, {
      type: correctionType.value,
      target: correctionTarget.value.trim(),
      content,
    });
    emit('updated', data.bible);
    correctionContent.value = '';
    correctionTarget.value = '';
    ElMessage.success('纠正已追加，续写和检查会优先采用');
  } catch (error) {
    ElMessage.error(error.message || '纠正提交失败');
  } finally {
    savingCorrection.value = false;
  }
}

async function removeCorrection(note) {
  try {
    await ElMessageBox.confirm('删除这条纠正？删除后模型会回到原始提取结果。', '删除纠正', {
      confirmButtonText: '删除',
      cancelButtonText: '保留',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    const data = await novelApi.removeCorrection(props.novelId, note.id);
    emit('updated', data.bible);
    ElMessage.success('纠正已删除');
  } catch (error) {
    ElMessage.error(error.message || '删除失败');
  }
}
</script>

<style scoped>
/* el-drawer 会传送到 body 外层，作用域属性到不了抽屉根节点，必须用全局类限定。 */
:global(.bible-drawer) {
  background: var(--paper-soft);
}

:global(.bible-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
}

:global(.bible-drawer .el-drawer__body) {
  padding: 0 22px 28px;
  overflow-y: auto;
}

.drawer-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.drawer-head h3 {
  margin-top: 2px;
  font-size: 20px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.source-note {
  color: var(--muted-soft);
  font-size: 8.5px;
  white-space: nowrap;
}

.bible-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 90px 30px;
  text-align: center;
}

.bible-empty h3 {
  margin-top: 16px;
  font-size: 22px;
}

.bible-empty > p:not(.empty-note) {
  max-width: 440px;
  margin: 10px 0 22px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.8;
}

.empty-note {
  margin-top: 12px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.readonly-banner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 14px 0 4px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.55);
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.65;
}

.readonly-banner .el-icon {
  flex: none;
  margin-top: 2px;
  color: var(--gold);
}

.bible-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}

.bible-tabs :deep(.el-tabs__item) {
  height: 38px;
  font-size: 11px;
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.story-summary {
  padding: 14px 16px;
  border-left: 2px solid var(--vermilion);
  background: rgba(255, 253, 248, 0.6);
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.9;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 253, 248, 0.42);
}

.stat strong {
  color: var(--ink-soft);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
}

.stat span {
  color: var(--muted-soft);
  font-size: 8px;
}

.bible-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--line);
}

.section-head h4 {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.section-head > span {
  color: var(--muted-soft);
  font-size: 8.5px;
}

.state-card {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.45);
}

.state-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.state-card > p {
  margin-top: 7px;
  color: var(--ink-soft);
  font-size: 11px;
  line-height: 1.8;
}

.conflict-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.conflict-list span {
  padding: 2px 7px;
  border: 1px solid rgba(185, 65, 43, 0.2);
  border-radius: 2px;
  background: rgba(185, 65, 43, 0.05);
  color: var(--vermilion);
  font-size: 8.5px;
}

.fact-list {
  margin: 0;
  padding-left: 18px;
  color: var(--ink-soft);
  font-size: 10.5px;
  line-height: 1.8;
}

.fact-list li::marker {
  color: var(--gold);
}

.mini-foreshadow {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-foreshadow-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.open-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--vermilion);
}

.mini-foreshadow-row strong {
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
}

.mini-foreshadow-row p {
  margin-top: 2px;
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.6;
}

.section-empty {
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.6;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.character-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.42);
}

.character-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.character-card h4 {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
}

.character-card header span {
  color: var(--muted-soft);
  font-size: 8.5px;
}

.character-card header b {
  flex: none;
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted);
  font-size: 8px;
  font-weight: 400;
}

.trait-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.trait-list span {
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(28, 27, 24, 0.05);
  color: var(--muted);
  font-size: 8px;
}

.knowledge-block {
  padding: 7px 9px;
  border-left: 2px solid var(--gold);
  background: rgba(155, 123, 66, 0.05);
}

.knowledge-block span {
  color: var(--gold);
  font-size: 8px;
}

.knowledge-block p {
  margin-top: 2px;
  color: var(--ink-soft);
  font-size: 9.5px;
  line-height: 1.7;
}

.relation-lines p {
  color: var(--muted);
  font-size: 9px;
  line-height: 1.7;
}

.relation-lines p::before {
  content: "· ";
  color: var(--line-strong);
}

.character-foot {
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--line);
}

.character-foot span {
  color: var(--muted-soft);
  font-size: 8px;
}

.character-foot p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.65;
}

.relationship-list,
.rule-list,
.event-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.relationship-row {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.relationship-row strong {
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
}

.relationship-row span {
  margin-left: 8px;
  color: var(--vermilion);
  font-size: 8.5px;
}

.relationship-row p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.65;
}

.place-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.place-card {
  padding: 10px 11px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 253, 248, 0.4);
}

.place-card strong {
  font-family: var(--font-serif);
  font-size: 11.5px;
  font-weight: 600;
}

.place-card p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.65;
}

.place-card span {
  display: block;
  margin-top: 5px;
  color: var(--gold);
  font-size: 8.5px;
  line-height: 1.6;
}

.place-card small {
  display: block;
  margin-top: 5px;
  color: var(--muted-soft);
  font-size: 8px;
}

.rule-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.rule-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 10px;
}

.rule-row strong {
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
}

.rule-row p {
  margin-top: 2px;
  color: var(--ink-soft);
  font-size: 9.5px;
  line-height: 1.7;
}

.rule-row small {
  display: block;
  margin-top: 3px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.timeline-list {
  display: flex;
  flex-direction: column;
}

.timeline-row {
  display: grid;
  grid-template-columns: 96px 12px minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  padding: 7px 0;
}

.timeline-side {
  display: flex;
  flex-direction: column;
  gap: 1px;
  text-align: right;
}

.timeline-side strong {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 9.5px;
  font-weight: 600;
}

.timeline-side span {
  color: var(--muted-soft);
  font-size: 8px;
}

.timeline-dot {
  position: relative;
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border: 1px solid var(--vermilion);
  border-radius: 50%;
  background: var(--paper-soft);
}

.timeline-dot::after {
  content: "";
  position: absolute;
  top: 8px;
  left: 2px;
  width: 1px;
  height: calc(100% + 21px);
  background: var(--line);
}

.timeline-row:last-child .timeline-dot::after {
  display: none;
}

.timeline-copy p {
  color: var(--ink-soft);
  font-size: 10px;
  line-height: 1.7;
}

.timeline-copy small {
  display: block;
  margin-top: 2px;
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.6;
}

.event-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.event-row > span {
  flex: none;
  width: 68px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.event-row strong {
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
}

.event-row p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.65;
}

.foreshadow-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.foreshadow-card {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.4);
}

.foreshadow-card.open {
  border-left: 2px solid var(--vermilion);
}

.foreshadow-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.foreshadow-card header span {
  color: var(--muted-soft);
  font-size: 8.5px;
}

.status-open {
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(185, 65, 43, 0.08);
  color: var(--vermilion) !important;
}

.status-resolved {
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(69, 100, 82, 0.08);
  color: var(--jade) !important;
}

.foreshadow-card h5 {
  margin-top: 5px;
  font-family: var(--font-serif);
  font-size: 11.5px;
  font-weight: 600;
}

.foreshadow-card p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.7;
}

.foreshadow-card small {
  display: block;
  margin-top: 4px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.correction-form-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.5);
}

.correction-hint {
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.7;
}

.correction-form {
  display: flex;
  gap: 7px;
}

.correction-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.correction-actions span {
  color: var(--muted-soft);
  font-size: 8.5px;
}

.correction-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.correction-row {
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 253, 248, 0.38);
}

.correction-row-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.correction-type {
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted);
  font-size: 8px;
}

.correction-row-head strong {
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
}

.correction-date {
  margin-left: auto;
  color: var(--muted-soft);
  font-size: 8px;
}

.correction-row p {
  margin-top: 5px;
  color: var(--ink-soft);
  font-size: 9.5px;
  line-height: 1.7;
}

@media (max-width: 640px) {
  .drawer-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .head-actions {
    width: 100%;
    justify-content: space-between;
  }

  .source-note {
    white-space: normal;
  }

  .stat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .character-grid,
  .place-grid {
    grid-template-columns: 1fr;
  }

  .correction-form {
    flex-direction: column;
  }

  .correction-form .el-select {
    width: 100% !important;
  }
}
</style>
