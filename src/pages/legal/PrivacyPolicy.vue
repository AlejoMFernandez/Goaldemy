<script setup>
import FulvoLogo from '../../components/FulvoLogo.vue'
</script>

<template>
  <section class="relative min-h-screen overflow-hidden">
    <div aria-hidden="true" class="aurora-root">
      <div class="accent"></div>
    </div>

    <div class="relative z-10 max-w-3xl mx-auto px-6 pb-16">
      <div class="mb-8 flex flex-col items-center text-center">
        <FulvoLogo variant="icon" size="lg" class="mb-4" />
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-2">Política de Privacidad</h1>
        <p class="text-slate-400 text-sm">Última actualización: 1 de septiembre de 2026</p>
      </div>

      <div class="space-y-6 text-slate-300 leading-relaxed">
        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <p>
            Esta Política de Privacidad explica qué datos recolecta <strong class="text-white">FULVO</strong>
            (en adelante, "la app", "el servicio") cuando usás la plataforma, para qué los usamos y cómo podés
            ejercer tus derechos sobre ellos. FULVO es desarrollada y operada por Alejo Martín Fernández, de
            forma independiente, desde Argentina.
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">1. Qué datos recolectamos</h2>
          <ul class="space-y-3 list-disc list-inside">
            <li><span class="text-white font-semibold">Datos de cuenta:</span> email y contraseña (la contraseña nunca la vemos en texto plano; la gestiona de forma cifrada nuestro proveedor de autenticación, Supabase).</li>
            <li><span class="text-white font-semibold">Si te registrás con Google:</span> tu email, nombre y foto de perfil públicos de tu cuenta de Google, según lo que autorices en ese momento.</li>
            <li><span class="text-white font-semibold">Datos de perfil (opcionales):</span> nombre para mostrar, nacionalidad, equipo y jugador favorito, avatar.</li>
            <li><span class="text-white font-semibold">Datos de juego:</span> XP, nivel, rachas, logros desbloqueados, resultados de partidas y estadísticas de uso dentro de la app.</li>
            <li><span class="text-white font-semibold">Datos de pago (solo si contratás PRO):</span> los procesa Mercado Pago; nosotros no almacenamos números de tarjeta ni datos financieros, solo el estado de tu suscripción.</li>
            <li><span class="text-white font-semibold">Datos técnicos básicos:</span> los propios de cualquier acceso web (dirección IP, tipo de navegador) que procesa nuestra infraestructura (Supabase, Vercel) para poder funcionar.</li>
          </ul>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">2. Para qué usamos tus datos</h2>
          <ul class="space-y-2 list-disc list-inside">
            <li>Crear y mantener tu cuenta, y permitirte iniciar sesión.</li>
            <li>Guardar tu progreso, XP, logros y estadísticas de juego.</li>
            <li>Mostrar tu nombre, avatar y datos de perfil en rankings, amigos y funciones sociales que vos elijas usar.</li>
            <li>Gestionar tu suscripción PRO, si la contratás.</li>
            <li>Comunicarte novedades importantes del servicio (por ejemplo, confirmación de cuenta o cambios de contraseña).</li>
            <li>Mejorar el funcionamiento y la seguridad de la app.</li>
          </ul>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">3. Con quién compartimos tus datos</h2>
          <p class="mb-3">No vendemos tus datos a terceros. Los compartimos únicamente con los proveedores que necesitamos para operar el servicio:</p>
          <ul class="space-y-2 list-disc list-inside">
            <li><span class="text-white font-semibold">Supabase</span> (base de datos, autenticación y almacenamiento).</li>
            <li><span class="text-white font-semibold">Google</span> (si elegís iniciar sesión con tu cuenta de Google).</li>
            <li><span class="text-white font-semibold">Mercado Pago</span> (si contratás una suscripción PRO).</li>
            <li><span class="text-white font-semibold">Vercel</span> (hosting de la aplicación).</li>
          </ul>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">4. Cookies y almacenamiento local</h2>
          <p>
            Usamos almacenamiento local del navegador (localStorage/sessionStorage) para mantener tu sesión iniciada
            y recordar algunas preferencias (por ejemplo, progreso de juegos sin login). No usamos cookies de
            publicidad ni de rastreo de terceros.
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">5. Cuánto tiempo conservamos tus datos</h2>
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Si pedís la eliminación de tu cuenta, borramos o
            anonimizamos tus datos personales en un plazo razonable, salvo que debamos conservar cierta información
            por obligaciones legales o de facturación.
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">6. Tus derechos</h2>
          <p>
            Podés pedirnos en cualquier momento acceder, corregir o eliminar tus datos personales, o descargar una
            copia de tu información. Para ejercer cualquiera de estos derechos, escribinos a
            <a href="mailto:fernandezmalejo@gmail.com" class="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">fernandezmalejo@gmail.com</a>.
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">7. Menores de edad</h2>
          <p>
            FULVO no está dirigida a menores de 13 años. Si sos padre, madre o tutor y creés que un menor de esa
            edad nos proporcionó datos personales, contactanos para eliminarlos.
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-sm p-6 md:p-8">
          <h2 class="text-xl font-bold text-white mb-3">8. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta política a medida que la app evolucione. Si hacemos cambios importantes, te lo
            vamos a avisar dentro de la aplicación. La fecha de la última actualización figura al inicio de esta página.
          </p>
        </div>

        <div class="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm p-6 md:p-8 text-center">
          <p class="text-slate-300">¿Preguntas sobre tus datos?</p>
          <a href="mailto:fernandezmalejo@gmail.com" class="inline-flex mt-2 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-2.5 font-semibold text-white transition hover:shadow-lg hover:shadow-emerald-500/50 hover:scale-105">
            fernandezmalejo@gmail.com
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
