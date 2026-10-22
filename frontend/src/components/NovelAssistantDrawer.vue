<template>
  <el-drawer
    :model-value="modelValue"
    direction="rtl"
    size="min(460px, 94vw)"
    class="novel-assistant-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="drawer-head">
        <div>
          <span class="section-kicker">Story assistant</span>
          <h3>{{ novelTitle || '小说助手' }}</h3>
        </div>
        <el-button
          text
          size="small"
          :disabled="!messages.length || loading"
          @click="clear"
        >
          <el-icon><Delete /></el-icon>
          清空
        </el-button>
      </div>
    </template>

    <div class="quick-prompts">
      <span>可以这样问</span>
      <div class="prompt-list">
        <button
          v-for="prompt in quickPrompts"
          :key="prompt"
          type="button"
          :disabled="loading"
          @click="askQuick(prompt)"
        >
          {{ prompt }}
        </button>
      </div>
    </div>

    <AssistantPanel
      v-model="draft"
      hide-header
      :messages="messages"
      :loading="loading"
      title="小说助手"
      kicker="Story assistant"
      note="助手会读取当前作品的故事记忆卡、章节摘要和最近三章原文；不会读取其他作品或账号。"
      empty-text="这本书里谁还不知道真相？还有哪些伏笔没回收？下一章往哪里走？直接问它。"
      placeholder="比如：当前还有哪些未回收伏笔？"
      @send="send"
      @clear="clear"
    />
  </el-drawer>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AssistantPanel from './AssistantPanel.vue';
import { novelApi } from '../api';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  novelId: { type: [Number, String], required: true },
  novelTitle: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const messages = ref([]);
const draft = ref('');
const loading = ref(false);

const quickPrompts = [
  '当前还有哪些未回收伏笔？',
  '现在每个主要人物分别知道什么？',
  '下一章可以往哪些方向推进？',
  '有哪些设定是续写时绝对不能改的？',
];

async function send(question) {
  const text = String(question || '').trim();
  if (!text || loading.value) return;
  const userMessage = { role: 'user', content: text };
  const history = [...messages.value, userMessage].slice(-20);
  messages.value = history;
  draft.value = '';
  loading.value = true;
  try {
    const data = await novelApi.assistant(props.novelId, history);
    messages.value = [
      ...messages.value,
      { role: 'assistant', content: cleanReply(data.reply) },
    ];
  } catch (error) {
    messages.value = messages.value.slice(0, -1);
    draft.value = text;
    ElMessage.error(error.message || '小说助手暂时没有回应');
  } finally {
    loading.value = false;
  }
}

function cleanReply(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '· ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function askQuick(prompt) {
  send(prompt);
}

async function clear() {
  if (!messages.value.length || loading.value) return;
  try {
    await ElMessageBox.confirm('清空当前关于这本书的对话？', '清空对话', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  messages.value = [];
  draft.value = '';
}
</script>

<style scoped>
/* el-drawer 会传送到 body 外层，作用域属性到不了抽屉根节点，必须用全局类限定。 */
:global(.novel-assistant-drawer) {
  background: var(--paper-soft);
}

:global(.novel-assistant-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
}

:global(.novel-assistant-drawer .el-drawer__body) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 14px 18px 18px;
  overflow: hidden;
}

:global(.novel-assistant-drawer .el-drawer__body > .assistant-panel) {
  flex: 1;
  min-height: 0;
}

:global(.novel-assistant-drawer .el-drawer__body > .assistant-panel .message-list) {
  flex: 1;
  height: auto;
  min-height: 180px;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.drawer-head h3 {
  margin-top: 2px;
  font-size: 17px;
}

.quick-prompts {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quick-prompts > span {
  color: var(--muted-soft);
  font-size: 8.5px;
  letter-spacing: 0.04em;
}

.prompt-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.prompt-list button {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 253, 248, 0.55);
  color: var(--muted);
  font-size: 8.5px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.prompt-list button:hover:not(:disabled) {
  border-color: var(--vermilion);
  color: var(--vermilion);
}

.prompt-list button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
