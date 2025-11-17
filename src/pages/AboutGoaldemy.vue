<template>
  <section class="py-4 md:py-6">
    <div class="mb-6">
      <h1 class="text-2xl md:text-4xl font-bold text-white flex items-center gap-3">
        <span>¿Qué es Goaldemy?</span>
        <span class="text-2xl md:text-3xl" aria-hidden>⚽️</span>
      </h1>
      <div class="h-1 mt-3 w-24 rounded-full" style="background: linear-gradient(90deg, #22d3ee, #6366f1);"></div>
    </div>

    <div class="prose prose-invert max-w-3xl">
      <p>
        Goaldemy es una plataforma de micro‑juegos para entrenar tu conocimiento futbolero. Cada juego está diseñado para
        ser ágil, desafiante y medible: jugás una ronda, sumás XP, y ves tu progreso.
      </p>

      <h3>¿Cómo funciona?</h3>
      <ul>
        <li>🗓️ Desafíos diarios con intentos limitados para poner a prueba tu memoria y tu ojo clínico.</li>
        <li>🆓 Modo libre para practicar sin presión y mejorar de a poco.</li>
        <li>🆙 XP, niveles, rachas y logros para que tu avance se sienta tangible.</li>
        <li>🏆 Tablas de posiciones para competir con amigos y la comunidad.</li>
      </ul>

      <h3>🎯 Nuestro objetivo</h3>
      <p>
        Que aprendas y te diviertas. Queremos que cada partida sea corta, clara y con feedback inmediato, para que
        siempre sepas en qué estás mejorando: reconocimiento de jugadores, clubes, nacionalidades, posiciones, valores y más.
      </p>

      <h3>Qué vas a encontrar</h3>
      <ul>
        <li>🧩 Juegos de reconocimiento visual (¿Quién es?, Nacionalidad, Posición, Camiseta, etc.).</li>
        <li>📊 Ordenamiento por edad, altura o valor de mercado, para entrenar contexto y estimación.</li>
        <li>🔥 Progresión diaria con registro de aciertos, errores y neutrales.</li>
      </ul>

      <div class="grid gap-4 md:grid-cols-3 mt-6">
        <div class="card p-4">
          <div class="text-lg font-semibold">Desafíos diarios</div>
          <p class="text-slate-300 text-sm mt-1">Probá tu nivel cada día y sumá XP con límites claros.</p>
        </div>
        <div class="card p-4">
          <div class="text-lg font-semibold">Modo libre</div>
          <p class="text-slate-300 text-sm mt-1">Entrená sin presión, ideal para afinar el ojo.</p>
        </div>
        <div class="card p-4">
          <div class="text-lg font-semibold">Progresión</div>
          <p class="text-slate-300 text-sm mt-1">Niveles, rachas y logros para que avances con propósito.</p>
        </div>
      </div>

      <p class="mt-6">
        ¿Listo para jugar? Probá los desafíos diarios en
        <a href="/play/points" class="text-sky-300 hover:text-sky-200">PlayPoints</a>, o entrená sin límites en
        <a href="/play/free" class="text-sky-300 hover:text-sky-200">PlayFree</a>. Mirá cómo vas en
        <a href="/leaderboards" class="text-sky-300 hover:text-sky-200">Leaderboards</a>.
      </p>
    </div>
  </section>
</template>
