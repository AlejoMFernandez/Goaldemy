import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { invalidatePlanCache } from './premium'

export async function startCheckout(planSlug, provider = 'mercadopago') {
  const { id } = getAuthUser() || {}
  if (!id) throw new Error('No autenticado')

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { plan_slug: planSlug, provider },
  })

  if (error) throw new Error(error.message || 'Error al crear checkout')
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('No se recibió URL de checkout')

  window.location.href = data.url
}

export async function handleReturnFromCheckout() {
  const params = new URLSearchParams(window.location.search)
  const result = params.get('result')

  if (!result) return null

  if (result === 'cancelled') {
    return { status: 'cancelled' }
  }

  invalidatePlanCache()

  if (result === 'stripe') {
    return { status: 'success', provider: 'stripe' }
  }
  if (result === 'mp') {
    return { status: 'success', provider: 'mercadopago' }
  }

  return null
}
