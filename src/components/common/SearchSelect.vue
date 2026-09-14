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
    imgSize: { type: Number, default: 24 }, // px del avatar mostrado una vez seleccionado
    imgShape: { type: String, default: 'circle' }, // 'circle' (jugadores) | 'badge' (escudos, sin recorte circular) | 'flag' (banderas, respeta su relación de aspecto real)
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
    },
    selectedImgStyle() {
      if (this.imgShape === 'flag') return { width: Math.round(this.imgSize * 1.33) + 'px', height: this.imgSize + 'px' }
      return { width: this.imgSize + 'px', height: this.imgSize + 'px' }
    },
    // "badge" (escudos) queda SIN redondeo circular a propósito: un escudo no
    // es un círculo, y rounded-full le recorta las puntas/esquinas sin importar
    // el object-fit. Las banderas usan un radio chico (no círculo tampoco).
    selectedImgClass() {
      if (this.imgShape === 'flag') return 'rounded-sm'
      if (this.imgShape === 'badge') return 'rounded-md'
      return 'rounded-full'
    },
    // Las banderas usan cover porque ya respetan su proporción real. Escudos y
    // fotos usan contain para no recortar contenido dentro de su caja.
    selectedImgFit() {
      return this.imgShape === 'flag' ? 'object-cover' : 'object-contain'
    }
  },
  methods: {
    setVal(v) {
      this.$emit('update:modelValue', v)
      // Mostrar el NOMBRE, no el value crudo (ej. código de país "ar") —
      // si no, el input queda mostrando algo como "ar" en vez de "Argentina".
      const opt = this.options.find(o => o.value === v)
      this.q = opt ? opt.label : v
      this.open = false
    },
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
        <img :src="selectedOption.image" alt="sel" class="shrink-0" :class="[selectedImgClass, selectedImgFit]" :style="selectedImgStyle" />
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
          class="option-row group relative px-3 py-2 cursor-pointer text-slate-200 flex items-center gap-2 transition-colors hover:bg-white/5"
        >
          <span class="absolute left-0 top-0 h-full w-0.5 scale-y-0 bg-gradient-to-b from-emerald-400 to-cyan-400 transition-transform duration-200 group-hover:scale-y-100"></span>
          <template v-if="showImages">
            <img v-if="o.image" :src="o.image" alt="img" :class="[selectedImgClass, selectedImgFit]" :style="imgShape === 'flag' ? { width: '28px', height: '21px' } : { width: '24px', height: '24px' }" />
            <div v-else class="w-6 h-6 rounded bg-slate-700"></div>
          </template>
          <span class="truncate">{{ o.label }}</span>
        </li>
        <li v-if="!items.length" class="px-3 py-2 text-slate-400">Sin resultados</li>
      </ul>
    </div>

  </div>
</template>
