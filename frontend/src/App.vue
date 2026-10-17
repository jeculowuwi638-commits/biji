<template>
  <router-view v-if="isAuthLayout" />
  <AppShell v-else>
    <router-view />
  </AppShell>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from './components/AppShell.vue';

const route = useRoute();
const isAuthLayout = computed(() => route.meta.layout === 'auth');
</script>
