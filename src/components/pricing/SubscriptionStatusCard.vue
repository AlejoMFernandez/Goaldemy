<script setup>
import { ref } from 'vue'
import { cancelSubscription } from '../../services/checkout'
import { pushSuccessToast, pushErrorToast } from '../../stores/notifications'
import { planStyle } from '../../services/plans-ui'

const props = defineProps({
  userPlan: { type: Object, required: true },
})
const emit = defineEmits(['cancelled'])

const confirming = ref(false)
const cancelling = ref(false)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function confirmCancel() {
  cancelling.value = true
  try {
    await cancelSubscription()
    pushSuccessToast('Suscripción cancelada. Mantenés tu plan hasta el final del período pagado.')
    confirming.value = false
    emit('cancelled')
  } catch (e) {
    pushErrorToast(e.message || 'No se pudo cancelar la suscripción')
  }
  cancelling.value = false
}
</script>

<template>
  <div v-if="userPlan.plan !== 'free'" class="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" :class="planStyle(userPlan.plan).border">
    <div>
      <div class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold mb-2" :class="planStyle(userPlan.plan).badge">
        <span class="w-2 h-2 rounded-full" :class="planStyle(userPlan.plan).dot"></span>
        Plan {{ userPlan.planName }}
      </div>
      <p class="text-sm text-slate-300">
        <template v-if="userPlan.autoRenew">
          Se renueva automáticamente el <strong class="text-white">{{ formatDate(userPlan.periodEnd) }}</strong>.
        </template>
        <template v-else>
          Vence el <strong class="text-white">{{ formatDate(userPlan.periodEnd) }}</strong> — no se renueva automáticamente.
        </template>
      </p>
    </div>

    <div v-if="userPlan.autoRenew" class="flex-shrink-0">
      <button
        v-if="!confirming"
        @click="confirming = true"
        class="text-sm font-semibold text-slate-400 hover:text-red-400 transition underline underline-offset-2"
      >
        Cancelar suscripción
      </button>
      <div v-else class="flex items-center gap-2">
        <span class="text-xs text-slate-400">¿Seguro?</span>
        <button
          @click="confirmCancel"
          :disabled="cancelling"
          class="text-sm font-bold text-red-400 hover:text-red-300 transition disabled:opacity-50"
        >
          {{ cancelling ? 'Cancelando…' : 'Sí, cancelar' }}
        </button>
        <button @click="confirming = false" :disabled="cancelling" class="text-sm text-slate-400 hover:text-white transition disabled:opacity-50">
          No
        </button>
      </div>
    </div>
  </div>
</template>
