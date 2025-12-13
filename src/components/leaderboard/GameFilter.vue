<script setup>
const props = defineProps({
  games: { type: Array, default: () => [] }, // [{id,name}]
  modelValue: { type: String, default: '' }, // '' -> Todos
})
const emit = defineEmits(['update:modelValue'])
function onChange(e) { emit('update:modelValue', e.target.value) }
</script>

<template>
  <label class="inline-flex items-center gap-2 text-sm text-slate-200">
    <span>Juego:</span>
    <select :value="modelValue" @change="onChange"
      class="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/10">
      <option value="">Todos</option>
      <option v-for="g in games" :key="g.id" :value="g.id">{{ g.name }}</option>
    </select>
  </label>
</template>

<style scoped>
/* Hint modern browsers to render native controls in dark theme */
select { color-scheme: dark; }
/* Improve dropdown option readability in some UAs */
option { background-color: #0b1220; color: #e2e8f0; }
option:disabled { color: #64748b; }
</style>

