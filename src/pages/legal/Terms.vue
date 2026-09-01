<script setup></script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <div class="relative z-10 max-w-3xl mx-auto px-6 py-10 text-slate-300">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-6">Términos y Condiciones</h1>

      <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-8 text-sm text-amber-200">
        <strong>Borrador — pendiente de revisión legal.</strong> Este texto todavía no fue revisado por un abogado. No lo tomes como asesoramiento legal definitivo.
      </div>

      <div class="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 class="text-lg font-bold text-white mb-2">1. Quién ofrece el servicio</h2>
          <p>Fulvo es una plataforma de trivia de fútbol operada por su titular, con contacto en <a href="mailto:fernandezmalejo@gmail.com" class="text-violet-300 hover:underline">fernandezmalejo@gmail.com</a>.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">2. Qué se cobra y cómo</h2>
          <p>Los planes pagos (Pro, Legend) se cobran en pesos argentinos a través de Mercado Pago, en dos modalidades:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li><strong class="text-white">Débito automático:</strong> se renueva cada mes hasta que se cancele.</li>
            <li><strong class="text-white">Pago único:</strong> un solo cobro, acceso por 30 días, sin renovación.</li>
          </ul>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">3. Derecho de arrepentimiento</h2>
          <p>De acuerdo a la normativa de defensa del consumidor vigente en Argentina, tenés derecho a revocar tu compra dentro de los 10 días corridos desde la contratación, sin costo ni responsabilidad alguna, salvo que ya hayas hecho uso efectivo del servicio contratado.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">4. Cómo cancelar</h2>
          <p>Podés cancelar tu suscripción con débito automático en cualquier momento desde tu perfil o desde la página de planes en Fulvo, o directamente desde tu cuenta de Mercado Pago. Ver la <RouterLink to="/cancellation-policy" class="text-violet-300 hover:underline">Política de cancelación</RouterLink> completa.</p>
        </section>
        <section>
          <h2 class="text-lg font-bold text-white mb-2">5. Modificaciones</h2>
          <p>Estos términos pueden actualizarse. Los cambios relevantes se comunicarán dentro de la plataforma.</p>
        </section>
      </div>
    </div>
  </section>
</template>
