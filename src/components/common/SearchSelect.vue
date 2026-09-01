<script>
export default {
  name: 'SearchSelect',
  props: {
    label: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] }, // [{value,label}]
    placeholder: { type: String, default: '' },
    minChars: { type: Number, default: 3 },
    showImages: { type: Boolean, default: false },
    icon: { type: String, default: '' }, // 'player' | 'team'
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
    },
    selectedOption() {
      return this.options.find(o => o.value === this.modelValue) || null
    }
  },
  methods: {
    setVal(v) { this.$emit('update:modelValue', v); this.q = v; this.open = false },
    clear() { this.$emit('update:modelValue', ''); this.q = ''; this.open = false },
    onDocClick(e) { try { if (!this.$el.contains(e.target)) this.open = false } catch {} },
  },
  mounted() { document.addEventListener('click', this.onDocClick) },
  unmounted() { document.removeEventListener('click', this.onDocClick) }
}
</script>

<template>
  <div class="relative">
    <label v-if="label" class="label">{{ label }}</label>
    <!-- Control wrapper kept relative so dropdown anchors to full width -->
    <div class="relative">
      <!-- When we have an image, render it OUTSIDE the input (like flags) and shrink the input -->
      <div v-if="showImages && selectedOption?.image" class="flex items-center gap-2">
        <img :src="selectedOption.image" alt="sel" class="w-6 h-6 rounded object-cover ring-1 ring-white/10" />
        <div class="relative flex-1">
          <input
            :placeholder="placeholder"
            class="input truncate pr-8"
            v-model="displayText"
            @focus="open = true"
            @input="($event) => { q = $event.target.value; if (q === '') $emit('update:modelValue', '') }"
            @keydown.esc.prevent="open=false"
          />
          <button v-if="modelValue" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200" @click="clear" aria-label="Limpiar">✕</button>
        </div>
      </div>
      <!-- Fallback: plain input occupying full width -->
      <div v-else class="relative">
        <input
          :placeholder="placeholder"
          class="input truncate pr-8"
          v-model="displayText"
          @focus="open = true"
          @input="($event) => { q = $event.target.value; if (q === '') $emit('update:modelValue', '') }"
          @keydown.esc.prevent="open=false"
        />
        <button v-if="modelValue" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200" @click="clear" aria-label="Limpiar">✕</button>
      </div>
    </div>
    <div v-if="open" class="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur shadow-lg max-h-64 overflow-auto">
      <ul>
        <li
          v-for="o in items"
          :key="o.value"
          @click="setVal(o.value)"
          class="option-row group relative overflow-hidden px-3 py-2 cursor-pointer text-slate-200 flex items-center gap-2 transition-colors hover:bg-white/5"
        >
          <!-- Silueta gráfica: la propia imagen del ítem (bandera/escudo/foto), llevada a negro y
               agrandada solo en hover — decorativa, no busca ser identificable, solo da "peso" visual.
               Del tamaño de la fila para que no fuerce scroll ni se recorte de más. -->
          <img
            v-if="showImages && o.image"
            :src="o.image"
            alt=""
            aria-hidden="true"
            class="option-silhouette pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 z-0 w-9 h-9 object-contain opacity-0 scale-75 transition-all duration-300 ease-out group-hover:opacity-60 group-hover:scale-125"
          />
          <span class="absolute left-0 top-0 h-full w-0.5 scale-y-0 bg-gradient-to-b from-emerald-400 to-cyan-400 transition-transform duration-200 group-hover:scale-y-100"></span>
          <template v-if="showImages">
            <img v-if="o.image" :src="o.image" alt="img" class="relative w-6 h-6 rounded object-cover ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-110" />
            <div v-else class="relative w-6 h-6 rounded bg-slate-700"></div>
          </template>
          <span class="relative truncate">{{ o.label }}</span>
        </li>
        <li v-if="!items.length" class="px-3 py-2 text-slate-400">Sin resultados</li>
      </ul>
    </div>
    
  </div>
</template>

<style scoped>
.option-silhouette {
  filter: brightness(0) drop-shadow(0 0 10px rgba(45, 212, 191, 0.55));
}
</style>

