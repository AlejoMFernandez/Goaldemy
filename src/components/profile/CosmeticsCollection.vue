<script setup>
import { ref, computed, onMounted } from 'vue'
import { getCosmetics, equipCosmetic, frameStyle, bannerStyle, rarity } from '../../services/cosmetics'
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
const icons = computed(() => items.value.filter(c => c.type === 'icon'))
const banners = computed(() => items.value.filter(c => c.type === 'banner'))

const equippedFrame = computed(() => frames.value.find(f => f.equipped) || frames.value.find(f => f.style_key === 'none') || {})
const equippedTitle = computed(() => titles.value.find(t => t.equipped) || null)
const equippedIcon = computed(() => icons.value.find(i => i.equipped) || null)
const equippedBanner = computed(() => banners.value.find(b => b.equipped) || banners.value.find(b => b.style_key === 'default') || {})

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
    pushSuccessToast('Equipado')
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
    <p class="text-sm text-slate-400 mb-5">Equipá bordes, títulos, íconos y banners. Se desbloquean al subir de nivel.</p>

    <div v-if="loading" class="h-32 rounded-xl bg-white/5 animate-pulse"></div>

    <template v-else>
      <!-- Preview -->
      <div class="relative overflow-hidden rounded-2xl border border-white/10 mb-6">
        <div class="absolute inset-0 opacity-90" :class="bannerStyle(equippedBanner.style_key)"></div>
        <div class="relative flex items-center gap-4 p-4">
          <div :class="[frameStyle(equippedFrame.style_key).wrap, frameStyle(equippedFrame.style_key).pad, 'rounded-2xl shrink-0']">
            <div class="size-16 rounded-[13px] overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-500 grid place-items-center text-white font-extrabold text-2xl">
              <span v-if="equippedIcon && equippedIcon.style_key">{{ equippedIcon.style_key }}</span>
              <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
              <span v-else>{{ initial }}</span>
            </div>
          </div>
          <div class="min-w-0">
            <p class="text-white font-bold text-lg truncate">{{ name || 'Tu nombre' }}</p>
            <p v-if="equippedTitle" class="text-sm font-semibold" :class="rarity(equippedTitle.rarity).text">{{ equippedTitle.name }}</p>
            <p v-else class="text-sm text-slate-400">Sin título</p>
          </div>
        </div>
      </div>

      <!-- Bordes -->
      <h3 class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2.5">Bordes</h3>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        <button
          v-for="f in frames" :key="f.code"
          :disabled="!f.owned || busy === f.code" @click="equip(f)"
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
          <span v-if="!f.owned" class="text-[9px] text-slate-500">{{ f.unlock_level > 100 ? 'Pase' : 'Nivel ' + f.unlock_level }}</span>
          <span v-else-if="f.equipped" class="text-[9px] text-emerald-400 font-bold">Equipado</span>
        </button>
      </div>

      <!-- Íconos -->
      <h3 class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2.5">Íconos</h3>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        <button
          v-for="i in icons" :key="i.code"
          :disabled="!i.owned || busy === i.code" @click="equip(i)"
          class="relative rounded-xl border p-3 flex flex-col items-center gap-2 transition-all"
          :class="[
            i.equipped ? 'border-emerald-400/50 bg-emerald-500/[0.07]' : rarity(i.rarity).border + ' bg-white/[0.02]',
            i.owned ? 'hover:bg-white/5 cursor-pointer' : 'opacity-50 cursor-not-allowed',
          ]"
        >
          <div class="size-10 rounded-lg bg-slate-800 grid place-items-center text-2xl">{{ i.style_key || '—' }}</div>
          <span class="text-[11px] font-medium text-white truncate w-full text-center">{{ i.name }}</span>
          <span v-if="i.premium_only" class="absolute top-1.5 right-1.5 text-[8px] font-bold text-amber-300">PRO</span>
          <span v-if="!i.owned" class="text-[9px] text-slate-500">Nivel {{ i.unlock_level }}</span>
          <span v-else-if="i.equipped" class="text-[9px] text-emerald-400 font-bold">Equipado</span>
        </button>
      </div>

      <!-- Banners -->
      <h3 class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2.5">Banners</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <button
          v-for="b in banners" :key="b.code"
          :disabled="!b.owned || busy === b.code" @click="equip(b)"
          class="relative rounded-xl border overflow-hidden transition-all"
          :class="[
            b.equipped ? 'border-emerald-400/60' : b.owned ? 'border-white/10 hover:border-white/25 cursor-pointer' : 'border-white/10 opacity-50 cursor-not-allowed',
          ]"
        >
          <div class="h-12" :class="bannerStyle(b.style_key)"></div>
          <div class="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/80">
            <span class="text-[11px] font-medium text-white truncate">{{ b.name }}</span>
            <span v-if="b.premium_only" class="text-[8px] font-bold text-amber-300">PRO</span>
            <span v-else-if="!b.owned" class="text-[9px] text-slate-500">Nivel {{ b.unlock_level }}</span>
            <span v-else-if="b.equipped" class="text-[9px] text-emerald-400 font-bold">✓</span>
          </div>
        </button>
      </div>

      <!-- Títulos -->
      <div class="flex items-center justify-between mb-2.5">
        <h3 class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Títulos</h3>
        <button v-if="equippedTitle" @click="unequipTitle" class="text-[11px] text-slate-500 hover:text-slate-300 transition">Quitar título</button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <button
          v-for="t in titles" :key="t.code"
          :disabled="!t.owned || busy === t.code" @click="equip(t)"
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
