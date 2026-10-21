<template>
  <section class="assistant-panel paper-card">
    <header class="assistant-head">
      <div>
        <span class="section-kicker">Writing assistant</span>
        <h3>写作助手</h3>
      </div>
      <el-button
        text
        size="small"
        :disabled="!messages.length || loading"
        @click="emit('clear')"
      >
        <el-icon><Delete /></el-icon>
        清空对话
      </el-button>
    </header>

    <p class="assistant-note">
      只把这段对话发给模型，不会读取你的档案或正文。需要它看某段文字时，
      把文字贴在问题里。
    </p>

    <div ref="listRef" class="message-list">
      <div v-if="!messages.length" class="assistant-empty">
        <span class="empty-mark">问</span>
        <p>不知道一句话怎么改、开头怎么起、结尾怎么收？直接问它。</p>
      </div>

      <div
        v-for="(message, index) in messages"
        :key="`${index}-${message.role}`"
        class="message"
        :class="message.role"
      >
        <span class="message-role">{{ message.role === 'user' ? '你' : '助手' }}</span>
        <div class="bubble">{{ message.content }}</div>
      </div>

      <div v-if="loading" class="message assistant">
        <span class="message-role">助手</span>
        <div class="bubble typing">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>

    <div class="assistant-input">
      <el-input
        :model-value="modelValue"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        resize="none"
        maxlength="4000"
        placeholder="比如：这句话太长了，帮我拆成两句。"
        @update:model-value="emit('update:modelValue', $event)"
        @keydown.enter.exact.prevent="submit"
      />
      <div class="input-foot">
        <span class="input-hint">Enter 发送 · Shift + Enter 换行</span>
        <el-button
          type="primary"
          size="small"
          :loading="loading"
          :disabled="!modelValue.trim()"
          @click="submit"
        >
          发送
        </el-button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'send', 'clear']);

const listRef = ref(null);

function submit() {
  const question = props.modelValue.trim();
  if (!question || props.loading) return;
  emit('send', question);
}

watch(
  () => [props.messages.length, props.loading],
  async () => {
    await nextTick();
    const list = listRef.value;
    if (list) list.scrollTop = list.scrollHeight;
  }
);
</script>

<style scoped>
.assistant-panel {
  display: flex;
  flex-direction: column;
  padding: 20px 20px 16px;
}

.assistant-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.assistant-head h3 {
  margin-top: 4px;
  font-size: 17px;
}

.assistant-head .el-button {
  flex: none;
  padding: 0;
  font-size: 9.5px;
}

.assistant-note {
  margin-top: 10px;
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.65;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 310px;
  margin-top: 12px;
  overflow-y: auto;
  padding-right: 3px;
}

.message-list::-webkit-scrollbar {
  width: 4px;
}

.assistant-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px 12px;
  text-align: center;
}

.assistant-empty .empty-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 17px;
}

.assistant-empty p {
  max-width: 220px;
  margin-top: 12px;
  color: var(--muted-soft);
  font-size: 10px;
  line-height: 1.7;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message.user {
  align-items: flex-end;
}

.message.assistant {
  align-items: flex-start;
}

.message-role {
  color: var(--muted-soft);
  font-size: 8.5px;
  letter-spacing: 0.08em;
}

.bubble {
  max-width: 92%;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(255, 253, 248, 0.6);
  color: var(--ink-soft);
  font-size: 11.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.message.user .bubble {
  border-color: rgba(185, 65, 43, 0.2);
  background: rgba(185, 65, 43, 0.065);
}

.bubble.typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 13px 14px;
}

.bubble.typing i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--muted-soft);
  animation: blink 1.1s ease-in-out infinite;
}

.bubble.typing i:nth-child(2) {
  animation-delay: 0.15s;
}

.bubble.typing i:nth-child(3) {
  animation-delay: 0.3s;
}

.assistant-input {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.assistant-input :deep(.el-textarea__inner) {
  padding: 9px 10px;
  font-family: var(--font-sans);
  font-size: 11.5px;
  line-height: 1.65;
}

.input-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
}

.input-hint {
  color: var(--muted-soft);
  font-size: 8.5px;
}

@keyframes blink {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
</style>
