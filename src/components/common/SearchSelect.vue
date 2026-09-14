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
    imgShape: { type: String, default: 'circle' }, // 'circle' (equipos/jugadores) | 'flag' (banderas, respeta su relación de aspecto real)
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
    isCircle() { return this.imgShape !== 'flag' },
    flagStyle() {
      return { width: Math.round(this.imgSize * 1.33) + 'px', height: this.imgSize + 'px' }
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
        <!-- Escudos/fotos: círculo con el logo achicado adentro (78%) — si el logo
             llenara el círculo entero, sus esquinas (ej. la parte alta y ancha del
             escudo de Racing) quedan recortadas por la máscara circular. -->
        <span v-if="isCircle" class="shrink-0 rounded-full overflow-hidden bg-white/5 flex items-center justify-center" :style="{ width: imgSize + 'px', height: imgSize + 'px' }">
          <img :src="selectedOption.image" alt="sel" class="object-contain" style="width:78%;height:78%;" />
        </span>
        <!-- Banderas: respetan su proporción real, sin círculo -->
        <img v-else :src="selectedOption.image" alt="sel" class="shrink-0 rounded-sm object-cover" :style="flagStyle" />
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
            <span v-if="o.image && isCircle" class="shrink-0 rounded-full overflow-hidden bg-white/5 flex items-center justify-center" style="width:24px;height:24px;">
              <img :src="o.image" alt="img" class="object-contain" style="width:78%;height:78%;" />
            </span>
            <img v-else-if="o.image" :src="o.image" alt="img" class="shrink-0 rounded-sm object-cover" style="width:28px;height:21px;" />
            <div v-else class="w-6 h-6 rounded bg-slate-700 shrink-0"></div>
          </template>
          <span class="truncate">{{ o.label }}</span>
        </li>
        <li v-if="!items.length" class="px-3 py-2 text-slate-400">Sin resultados</li>
      </ul>
    </div>

  </div>
</template>
