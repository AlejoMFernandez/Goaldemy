<script>
export default {
  name: 'SearchSelect',
  props: {
    label: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] }, // [{value,label}]
    placeholder: { type: String, default: '' },
    minChars: { type: Number, default: 3 },
  },
  emits: ['update:modelValue'],
  data() {
    return { q: '', open: false }
  },
  computed: {
    items() {
      const q = this.q.trim().toLowerCase()
      if (q.length < this.minChars) return this.options.slice(0, 30)
      return this.options.filter(o => o.label.toLowerCase().includes(q)).slice(0, 50)
    },
    displayText: {
      get() {
        return this.q !== '' ? this.q : (this.modelValue || '')
      },
      set(val) {
        this.q = val
        this.open = true
      }
    }
  },
  methods: {
    setVal(v) { this.$emit('update:modelValue', v); this.q = v; this.open = false },
    toggle() { this.open = !this.open },
  }
}
</script>

<template>
  <div class="relative">
    <label v-if="label" class="label">{{ label }}</label>
    <div class="flex gap-2">
      <input :placeholder="placeholder" class="input" v-model="displayText" @focus="open = true" />
      <button type="button" class="rounded-lg border border-white/10 px-3 text-slate-200 hover:bg-white/5" @click="toggle">Buscar</button>
    </div>
    <div v-if="open" class="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur shadow-lg max-h-64 overflow-auto">
      <ul>
        <li v-for="o in items" :key="o.value" @click="setVal(o.value)" class="px-3 py-2 hover:bg-white/5 cursor-pointer text-slate-200">
          {{ o.label }}
        </li>
        <li v-if="!items.length" class="px-3 py-2 text-slate-400">Sin resultados</li>
      </ul>
    </div>
    <p v-if="modelValue" class="mt-1 text-xs text-slate-400">Seleccionado: {{ modelValue }}</p>
  </div>
</template>

<style scoped>
</style>
