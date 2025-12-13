<script setup>
const props = defineProps({
  modelValue: { type: String, default: 'all_time' },
})
const emit = defineEmits(['update:modelValue'])
const options = [
  { value: 'all_time', label: 'Global' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'weekly', label: 'Semanal' },
]
function setVal(v) { emit('update:modelValue', v) }
</script>

<template>
  <div class="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
    <button v-for="opt in options" :key="opt.value" @click="setVal(opt.value)"
      :class="['px-3 py-1.5 text-sm rounded-lg transition', modelValue===opt.value ? 'bg-[oklch(0.62_0.21_270)] text-white' : 'text-slate-200 hover:text-white']">
      {{ opt.label }}
    </button>
  </div>
  
</template>

