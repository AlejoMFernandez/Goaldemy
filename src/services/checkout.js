import { supabase } from './supabase'
import { getAuthUser } from './auth'
import { invalidatePlanCache } from './premium'

export async function startCheckout(planSlug, provider = 'mercadopago', billingEmail = null, billingType = 'recurring') {
  const { id } = getAuthUser() || {}
  if (!id) throw new Error('No autenticado')

  const body = { plan_slug: planSlug, provider, billing_type: billingType }
  if (billingEmail) body.billing_email = billingEmail

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body,
  })

  if (error) throw new Error(error.message || 'Error al crear checkout')
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('No se recibió URL de checkout')

  window.location.href = data.url
}

export async function cancelSubscription() {
  const { id } = getAuthUser() || {}
  if (!id) throw new Error('No autenticado')

  const { data, error } = await supabase.functions.invoke('cancel-subscription', { body: {} })

  if (error) throw new Error(error.message || 'Error al cancelar la suscripción')
  if (data?.error) throw new Error(data.error)

  invalidatePlanCache()
}

export async function handleReturnFromCheckout() {
  const params = new URLSearchParams(window.location.search)
  const result = params.get('result')

  if (!result) return null

  if (result === 'cancelled' || result === 'mp_fail') {
    return { status: 'cancelled' }
  }
  if (result === 'mp_pending') {
    return { status: 'pending', provider: 'mercadopago' }
  }

  invalidatePlanCache()

  if (result === 'stripe') {
    return { status: 'success', provider: 'stripe' }
  }
  if (result === 'mp' || result === 'mp_ok') {
    return { status: 'success', provider: 'mercadopago' }
  }

  return null
}
