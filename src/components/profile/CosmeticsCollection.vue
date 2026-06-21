<script setup>
import { ref, computed, onMounted } from 'vue'
import { getCosmetics, equipCosmetic, frameStyle, rarity } from '../../services/cosmetics'
import { pushSuccessToast, pushErrorToast } from '../../stores/notifications'

const props = defineProps({
  avatarUrl: { type: String, default: '' },
  name: { type: String, default: '' },
  initial: { type: String, default: '?' },
})

const items = ref([])
const loading = ref(true)
const busy = ref(null)

const frames = computed(() => items.value.filter(c => c.type === 'frame'))
const titles = computed(() => items.value.filter(c => c.type === 'title'))
const equippedFrame = computed(() => frames.value.find(f => f.equipped) || frames.value.find(f => f.style_key === 'none') || {})
const equippedTitle = computed(() => titles.value.find(t => t.equipped) || null)

async function load() {
  loading.value = true
  items.value = await getCosmetics()
  loading.value = false
}

async function equip(c) {
  if (!c.owned || busy.value) return
  busy.value = c.code
  const res = await equipCosmetic(c.code)
  if (res.ok) {
    items.value = items.value.map(x => x.type === c.type ? { ...x, equipped: x.code === c.code } : x)
    pushSuccessToast(c.type === 'frame' ? 'Borde equipado' : 'Título equipado')
  } else {
    pushErrorToast('No se pudo equipar')
  }
  busy.value = null
}

async function unequipTitle() {
  if (busy.value) return
  busy.value = 'untitle'
  const res = await equipCosmetic('')
  if (res.ok) items.value = items.value.map(x => x.type === 'title' ? { ...x, equipped: false } : x)
  busy.value = null
}

onMounted(load)
</script>

<template>
  <div class="card p-6">
    <h2 class="font-display font-bold text-white text-xl mb-1">Colección</h2>
    <p class="text-sm text-slate-400 mb-5">Equipá bordes y títulos. Se desbloquean al subir de nivel.</p>

    <div v-if="loading" class="h-32 rounded-xl bg-white/5 animate-pulse"></div>

    <template v-else>
      <!-- Preview -->
      <div class="flex items-center gap-4 mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div :class="[frameStyle(equippedFrame.style_key).wrap, frameStyle(equippedFrame.style_key).pad, 'rounded-2xl shrink-0']">
          <div class="size-16 rounded-[13px] overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-500 grid place-items-center text-white font-extrabold text-xl">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
            <span v-else>{{ initial }}</span>
          </div>
        </div>
        <div class="min-w-0">
          <p class="text-white font-bold text-lg truncate">{{ name || 'Tu nombre' }}</p>
          <p v-if="equippedTitle" class="text-sm font-semibold" :class="rarity(equippedTitle.rarity).text">{{ equippedTitle.name }}</p>
          <p v-else class="text-sm text-slate-500">Sin título</p>
        </div>
      </div>

      <!-- Bordes -->
      <h3 class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2.5">Bordes</h3>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        <button
          v-for="f in frames"
          :key="f.code"
          :disabled="!f.owned || busy === f.code"
          @click="equip(f)"
          class="relative rounded-xl border p-3 flex flex-col items-center gap-2 transition-all"
          :class="[
            f.equipped ? 'border-emerald-400/50 bg-emerald-500/[0.07]' : rarity(f.rarity).border + ' bg-white/[0.02]',
            f.owned ? 'hover:bg-white/5 cursor-pointer' : 'opacity-50 cursor-not-allowed',
          ]"
        >
          <div :class="[frameStyle(f.style_key).wrap, frameStyle(f.style_key).pad, 'rounded-xl']">
            <div class="size-10 rounded-[9px] bg-slate-800 grid place-items-center text-slate-500 text-[10px]">●</div>
          </div>
          <span class="text-[11px] font-medium text-white truncate w-full text-center">{{ f.name }}</span>
          <span v-if="f.premium_only" class="absolute top-1.5 right-1.5 text-[8px] font-bold text-amber-300">PRO</span>
          <span v-if="!f.owned" class="text-[9px] text-slate-500">Nivel {{ f.unlock_level }}</span>
          <span v-else-if="f.equipped" class="text-[9px] text-emerald-400 font-bold">Equipado</span>
        </button>
      </div>

      <!-- Títulos -->
      <div class="flex items-center justify-between mb-2.5">
        <h3 class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Títulos</h3>
        <button v-if="equippedTitle" @click="unequipTitle" class="text-[11px] text-slate-500 hover:text-slate-300 transition">Quitar título</button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <button
          v-for="t in titles"
          :key="t.code"
          :disabled="!t.owned || busy === t.code"
          @click="equip(t)"
          class="relative rounded-xl border px-3 py-2.5 text-left transition-all"
          :class="[
            t.equipped ? 'border-emerald-400/50 bg-emerald-500/[0.07]' : rarity(t.rarity).border + ' ' + rarity(t.rarity).bg,
            t.owned ? 'hover:brightness-110 cursor-pointer' : 'opacity-50 cursor-not-allowed',
          ]"
        >
          <div class="text-sm font-bold truncate" :class="rarity(t.rarity).text">{{ t.name }}</div>
          <div class="text-[9px] mt-0.5" :class="t.owned ? 'text-slate-500' : 'text-slate-600'">
            <span v-if="t.premium_only" class="text-amber-300 font-bold">PREMIUM</span>
            <span v-else-if="!t.owned">Nivel {{ t.unlock_level }}</span>
            <span v-else-if="t.equipped" class="text-emerald-400 font-bold">Equipado</span>
            <span v-else>{{ rarity(t.rarity).label }}</span>
          </div>
        </button>
      </div>
    </template>
  </div>
</template>
