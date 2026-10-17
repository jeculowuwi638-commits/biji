<template>
  <div ref="chartRef" class="profile-radar" :style="{ height: `${height}px` }" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { clamp } from '../utils/format';

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  semantic: { type: Object, default: () => ({}) },
  height: { type: Number, default: 260 },
});

const chartRef = ref(null);
let chart = null;
let observer = null;

function buildOption() {
  const stats = props.stats || {};
  const semantic = props.semantic || {};
  const values = [
    clamp(stats.formality),
    clamp(stats.colloquialism),
    clamp(stats.emotion),
    clamp(stats.metaphorDensity),
    clamp(stats.personalExperienceRatio),
    clamp(semantic.viewpointStrength),
  ];

  return {
    animationDuration: 550,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fffdf8',
      borderColor: 'rgba(28, 27, 24, 0.16)',
      textStyle: { color: '#1c1b18', fontSize: 12 },
      formatter: () =>
        [
          '正式度 ' + values[0],
          '口语度 ' + values[1],
          '情绪浓度 ' + values[2],
          '比喻密度 ' + values[3],
          '个人经历 ' + values[4],
          '观点强度 ' + values[5],
        ].join('<br/>'),
    },
    radar: {
      center: ['50%', '52%'],
      radius: '66%',
      splitNumber: 4,
      indicator: [
        { name: '正式', max: 100 },
        { name: '口语', max: 100 },
        { name: '情绪', max: 100 },
        { name: '比喻', max: 100 },
        { name: '经历', max: 100 },
        { name: '观点', max: 100 },
      ],
      axisName: {
        color: '#7b7467',
        fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 11,
      },
      splitLine: { lineStyle: { color: 'rgba(28, 27, 24, 0.1)' } },
      splitArea: {
        areaStyle: {
          color: ['rgba(255, 253, 248, 0)', 'rgba(28, 27, 24, 0.018)'],
        },
      },
      axisLine: { lineStyle: { color: 'rgba(28, 27, 24, 0.12)' } },
    },
    series: [
      {
        name: '笔迹指纹',
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#b9412b', width: 1.6 },
        itemStyle: { color: '#b9412b' },
        areaStyle: { color: 'rgba(185, 65, 43, 0.16)' },
        data: [{ value: values, name: '笔迹指纹' }],
      },
    ],
  };
}

function render() {
  if (!chart) return;
  chart.setOption(buildOption(), true);
}

onMounted(() => {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value);
  render();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(chartRef.value);
});

watch(() => [props.stats, props.semantic], render, { deep: true });

onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.profile-radar {
  width: 100%;
  min-height: 220px;
}
</style>
