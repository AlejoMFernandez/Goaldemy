<template>
  <div class="min-h-screen bg-transparent text-white">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p class="text-slate-400">Cargando datos del equipo...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen px-4">
      <div class="text-center">
        <i class="bi bi-exclamation-triangle text-5xl text-red-500 mb-4"></i>
        <h2 class="text-2xl font-bold mb-2">Error al cargar el equipo</h2>
        <p class="text-slate-400">{{ error }}</p>
      </div>
    </div>

    <!-- Team Content -->
    <div v-else-if="teamData" class="container mx-auto px-4 py-8 max-w-7xl">
      <!-- Team Header -->
      <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-6">
        <div class="flex items-center gap-6">
          <!-- Team Logo -->
          <div class="flex-shrink-0">
            <img 
              v-if="teamData.logo" 
              :src="teamData.logo" 
              :alt="teamData.name"
              class="w-24 h-24 object-contain"
            />
            <div v-else class="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center">
              <i class="bi bi-shield text-4xl text-slate-400"></i>
            </div>
          </div>

          <!-- Team Info -->
          <div class="flex-1">
            <h1 class="text-4xl font-bold mb-2">{{ teamData.name || 'Equipo' }}</h1>
            <div class="flex items-center gap-4 text-sm text-slate-400">
              <span v-if="teamData.stadium?.name" class="flex items-center gap-1">
                <i class="bi bi-geo-alt"></i>
                {{ teamData.stadium.name }}
              </span>
              <span v-if="teamData.stadium?.city" class="flex items-center gap-1">
                <i class="bi bi-building"></i>
                {{ teamData.stadium.city }}
              </span>
              <span v-if="teamData.country" class="flex items-center gap-1">
                <i class="bi bi-flag"></i>
                {{ teamData.country }}
              </span>
            </div>
          </div>

          <!-- Quick Stats -->
          <div class="hidden md:flex gap-6">
            <div class="text-center">
              <div class="text-3xl font-bold text-green-500">{{ teamStats.wins || 0 }}</div>
              <div class="text-xs text-slate-400">Victorias</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-gray-400">{{ teamStats.draws || 0 }}</div>
              <div class="text-xs text-slate-400">Empates</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-red-500">{{ teamStats.losses || 0 }}</div>
              <div class="text-xs text-slate-400">Derrotas</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 mb-6 overflow-hidden">
        <div class="flex overflow-x-auto scrollbar-hide">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="px-6 py-4 text-sm font-semibold transition-all flex-shrink-0"
            :class="activeTab === tab.id 
              ? 'bg-cyan-600/90 text-white' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'"
          >
            <i :class="tab.icon" class="mr-2"></i>
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="transition-all duration-300">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="space-y-6">
          <!-- Next Match -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
              <i class="bi bi-calendar-event text-blue-500"></i>
              Próximo Partido
            </h2>
            <div v-if="nextMatch" class="bg-slate-700/50 rounded-xl p-4">
              <div class="text-xs text-slate-400 text-center mb-3">{{ nextMatch.competition }}</div>
              <div class="flex items-center justify-between">
                <router-link :to="`/team/${nextMatch.home.id}`" class="text-center flex-1 hover:opacity-80 transition-opacity">
                  <img :src="nextMatch.home.logo" class="w-12 h-12 mx-auto mb-2" />
                  <div class="font-semibold text-sm">{{ nextMatch.home.name }}</div>
                </router-link>
                <div class="text-center px-6">
                  <div class="text-sm text-slate-400">{{ nextMatch.date }}</div>
                  <div class="text-2xl font-bold my-2">VS</div>
                  <div class="text-sm text-slate-400">{{ nextMatch.time }}</div>
                </div>
                <router-link :to="`/team/${nextMatch.away.id}`" class="text-center flex-1 hover:opacity-80 transition-opacity">
                  <img :src="nextMatch.away.logo" class="w-12 h-12 mx-auto mb-2" />
                  <div class="font-semibold text-sm">{{ nextMatch.away.name }}</div>
                </router-link>
              </div>
            </div>
            <div v-else class="text-center text-slate-400 py-8">
              No hay próximo partido programado
            </div>
          </div>

          <!-- Recent Form (Last 5 matches) -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
              <i class="bi bi-graph-up text-green-500"></i>
              Últimos 5 Partidos
            </h2>
            <div v-if="recentMatches.length > 0" class="space-y-3">
              <div
                v-for="match in recentMatches" 
                :key="match.id"
                class="bg-slate-700/50 rounded-xl p-4 hover:bg-slate-700 transition-colors"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1">
                    <div class="text-xs text-slate-400 w-20">{{ match.date }}</div>
                    <div class="flex items-center gap-2 flex-1">
                      <img :src="match.homeLogo" :alt="match.home" class="w-5 h-5 object-contain" />
                      <span class="font-semibold truncate">{{ match.home }}</span>
                      <span class="text-slate-400">vs</span>
                      <span class="font-semibold truncate">{{ match.away }}</span>
                      <img :src="match.awayLogo" :alt="match.away" class="w-5 h-5 object-contain" />
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="text-xs text-slate-500 w-40 text-right">{{ match.competition }}</div>
                    <span class="font-bold text-sm min-w-[35px] text-center">{{ match.score }}</span>
                    <span 
                      class="px-2 py-1 rounded text-xs font-bold min-w-[28px] text-center"
                      :class="{
                        'bg-green-500/20 text-green-500': match.result === 'W',
                        'bg-gray-500/20 text-gray-400': match.result === 'D',
                        'bg-red-500/20 text-red-500': match.result === 'L'
                      }"
                    >
                      {{ match.result }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-slate-400 py-8">
              No hay partidos recientes
            </div>
          </div>

          <!-- Quick Stats Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- League Position -->
            <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i class="bi bi-trophy text-yellow-500"></i>
                Posición en la Liga
              </h3>
              <div v-if="tablePosition" class="text-center py-6">
                <div class="text-5xl font-bold text-cyan-400 mb-2">{{ tablePosition.idx }}</div>
                <div class="text-slate-400 mb-4">{{ tablePosition.pts }} puntos</div>
                <div class="flex justify-center gap-6 text-sm">
                  <div>
                    <div class="font-bold text-green-400">{{ tablePosition.wins }}</div>
                    <div class="text-xs text-slate-500">V</div>
                  </div>
                  <div>
                    <div class="font-bold text-gray-400">{{ tablePosition.draws }}</div>
                    <div class="text-xs text-slate-500">E</div>
                  </div>
                  <div>
                    <div class="font-bold text-red-400">{{ tablePosition.losses }}</div>
                    <div class="text-xs text-slate-500">D</div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-6 text-slate-400">
                No disponible
              </div>
            </div>

            <!-- Stadium Info -->
            <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i class="bi bi-building text-cyan-400"></i>
                Estadio
              </h3>
              <div class="py-4">
                <div class="text-xl font-semibold mb-2">{{ teamData.stadium?.name || 'N/A' }}</div>
                <div class="space-y-1 text-sm">
                  <div class="text-slate-400" v-if="teamData.stadium?.city">
                    <i class="bi bi-geo-alt text-slate-500 mr-1"></i>
                    {{ teamData.stadium.city }}
                  </div>
                  <div class="text-slate-400" v-if="teamData.stadium?.capacity">
                    <i class="bi bi-people text-slate-500 mr-1"></i>
                    Capacidad: {{ teamData.stadium.capacity.toLocaleString() }} espectadores
                  </div>
                  <div class="text-slate-400" v-if="teamData.stadium?.opened">
                    <i class="bi bi-calendar text-slate-500 mr-1"></i>
                    Inaugurado en {{ teamData.stadium.opened }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Lineup Tab -->
        <div v-if="activeTab === 'lineup'" class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-4 md:p-6">
          <div v-if="lastLineup">
            <!-- Header -->
            <div class="text-center mb-5">
              <h2 class="text-xl font-bold text-white">Último 11 Titular</h2>
              <span class="text-sm text-slate-400">Formación: <span class="text-cyan-400 font-bold">{{ lastLineup.formation }}</span></span>
            </div>

            <!-- Tactical Pitch (no photos, clean position circles) -->
            <div class="relative w-full max-w-[340px] mx-auto aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border border-white/10" style="background:oklch(0.27 0.07 155)">
              <!-- Field markings -->
              <div class="absolute inset-2 border border-white/12 rounded"></div>
              <div class="absolute top-1/2 left-2 right-2 h-px bg-white/12"></div>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/12 rounded-full"></div>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/25 rounded-full"></div>
              <div class="absolute top-2 left-[22%] right-[22%] h-[18%] border border-white/12"></div>
              <div class="absolute bottom-2 left-[22%] right-[22%] h-[18%] border border-white/12"></div>

              <!-- Player circles -->
              <div
                v-for="player in lastLineup.starters"
                :key="player.id"
                class="absolute"
                :style="{
                  left: `${player.verticalLayout.x * 100}%`,
                  top: `${player.verticalLayout.y * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }"
              >
                <div class="flex flex-col items-center gap-0.5">
                  <!-- Position-colored circle with shirt number -->
                  <div
                    class="relative w-9 h-9 rounded-full flex items-center justify-center border-2 border-white/25 shadow-lg"
                    :class="playerPosColor(player)"
                  >
                    <span class="text-xs font-black text-white leading-none">{{ player.shirtNumber }}</span>
                    <!-- Rating badge -->
                    <div
                      v-if="player.performance?.rating"
                      class="absolute -top-1.5 -right-1.5 min-w-[20px] bg-slate-950 rounded px-0.5 text-[8px] font-bold text-amber-400 text-center border border-amber-400/20 shadow leading-tight"
                    >{{ player.performance.rating.toFixed(1) }}</div>
                  </div>
                  <!-- Last name chip -->
                  <div class="bg-slate-950/80 px-1 py-px rounded text-white text-[8px] font-bold max-w-[54px] text-center truncate shadow leading-tight">
                    {{ player.lastName || (player.name || '').split(' ').slice(-1)[0] }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Legend -->
            <div class="flex justify-center flex-wrap gap-3 mt-4 text-[10px] text-slate-400">
              <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-amber-500/80"></div>GK</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-blue-500/80"></div>DEF</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-violet-500/80"></div>MED</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-rose-500/80"></div>DEL</div>
            </div>
          </div>
          <div v-else class="text-center text-slate-400 py-12">
            <i class="bi bi-diagram-3 text-5xl mb-4 block"></i>
            <p>No hay información del último 11 disponible</p>
          </div>
        </div>

        <!-- Squad Tab -->
        <div v-if="activeTab === 'squad'">
          <div v-if="teamData?.squad?.squad">
            <!-- Compact squad table like Transfermarkt -->
            <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <template v-for="group in teamData.squad.squad" :key="group.title">
                <!-- Position group header -->
                <div class="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
                  <span class="w-0.5 h-4 rounded-full bg-emerald-500 flex-shrink-0"></span>
                  <h3 class="text-xs font-bold uppercase tracking-widest text-slate-200">
                    {{ group.title === 'coach' ? 'CUERPO TÉCNICO' :
                       group.title === 'keepers' ? 'ARQUEROS' :
                       group.title === 'defenders' ? 'DEFENSORES' :
                       group.title === 'midfielders' ? 'MEDIOCAMPISTAS' :
                       group.title === 'attackers' ? 'DELANTEROS' : group.title.toUpperCase() }}
                  </h3>
                </div>
                <!-- Player rows -->
                <div v-for="player in group.members" :key="player.id"
                     class="flex items-center gap-3 px-4 py-2 border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0">
                  <!-- Shirt # -->
                  <span class="text-xs font-bold text-slate-500 w-5 text-center flex-shrink-0">{{ player.shirtNumber || '—' }}</span>
                  <!-- Photo -->
                  <img
                    :src="getPlayerImage(player.id)"
                    @error="handlePlayerImageError"
                    :alt="player.name"
                    class="w-8 h-8 rounded-full object-cover bg-slate-700 flex-shrink-0 ring-1 ring-white/10"
                  />
                  <!-- Name -->
                  <span class="flex-1 text-sm font-medium text-white truncate">{{ player.name }}</span>
                  <!-- Flag -->
                  <img v-if="player.ccode"
                       :src="`https://flagcdn.com/w20/${getFlagCode(player.ccode)}.png`"
                       class="w-5 h-3.5 rounded-sm object-cover flex-shrink-0"
                       :alt="player.cname" />
                  <!-- Age -->
                  <span class="text-xs text-slate-500 w-8 text-right flex-shrink-0">{{ player.age }}a</span>
                  <!-- Stats -->
                  <div class="flex items-center gap-1.5 w-14 justify-end flex-shrink-0">
                    <span v-if="player.goals > 0" class="text-[11px] text-emerald-400 font-semibold">⚽{{ player.goals }}</span>
                    <span v-if="player.assists > 0" class="text-[11px] text-blue-400 font-semibold">🅰️{{ player.assists }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div v-else class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div class="text-center text-slate-400 py-12">
              <i class="bi bi-people text-5xl mb-4 block"></i>
              <p>No hay información de la plantilla disponible</p>
            </div>
          </div>
        </div>

        <!-- Stats Tab -->
        <div v-if="activeTab === 'stats'" class="space-y-3">
          <!-- Top Scorers -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div class="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <span class="w-0.5 h-4 rounded-full bg-yellow-400 flex-shrink-0"></span>
              <h3 class="text-xs font-bold uppercase tracking-widest text-slate-200">Goleadores del Equipo</h3>
            </div>
            <template v-if="topScorers.length > 0">
              <div v-for="(player, idx) in topScorers" :key="player.id"
                   class="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0">
                <span class="text-xs font-bold text-slate-500 w-5 text-center flex-shrink-0">{{ idx + 1 }}</span>
                <img v-if="player.ccode" :src="`https://flagcdn.com/w20/${getFlagCode(player.ccode)}.png`" class="w-5 h-3.5 rounded-sm object-cover flex-shrink-0" :alt="player.ccode" />
                <span class="flex-1 text-sm font-medium text-white truncate">{{ player.name }}</span>
                <span class="text-sm font-bold text-yellow-400 tabular-nums">{{ player.value }}</span>
                <span class="text-xs text-slate-500 w-8">goles</span>
              </div>
            </template>
            <div v-else class="px-4 py-8 text-center text-slate-400 text-sm">No hay datos disponibles</div>
          </div>

          <!-- Top Assists -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div class="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <span class="w-0.5 h-4 rounded-full bg-blue-400 flex-shrink-0"></span>
              <h3 class="text-xs font-bold uppercase tracking-widest text-slate-200">Máximos Asistidores</h3>
            </div>
            <template v-if="topAssists.length > 0">
              <div v-for="(player, idx) in topAssists" :key="player.id"
                   class="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0">
                <span class="text-xs font-bold text-slate-500 w-5 text-center flex-shrink-0">{{ idx + 1 }}</span>
                <img v-if="player.ccode" :src="`https://flagcdn.com/w20/${getFlagCode(player.ccode)}.png`" class="w-5 h-3.5 rounded-sm object-cover flex-shrink-0" :alt="player.ccode" />
                <span class="flex-1 text-sm font-medium text-white truncate">{{ player.name }}</span>
                <span class="text-sm font-bold text-blue-400 tabular-nums">{{ player.value }}</span>
                <span class="text-xs text-slate-500 w-8">asis.</span>
              </div>
            </template>
            <div v-else class="px-4 py-8 text-center text-slate-400 text-sm">No hay datos disponibles</div>
          </div>

          <!-- Top Rated -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div class="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <span class="w-0.5 h-4 rounded-full bg-orange-400 flex-shrink-0"></span>
              <h3 class="text-xs font-bold uppercase tracking-widest text-slate-200">Mejor Valorados</h3>
            </div>
            <template v-if="topRated.length > 0">
              <div v-for="(player, idx) in topRated" :key="player.id"
                   class="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0">
                <span class="text-xs font-bold text-slate-500 w-5 text-center flex-shrink-0">{{ idx + 1 }}</span>
                <img v-if="player.ccode" :src="`https://flagcdn.com/w20/${getFlagCode(player.ccode)}.png`" class="w-5 h-3.5 rounded-sm object-cover flex-shrink-0" :alt="player.ccode" />
                <span class="flex-1 text-sm font-medium text-white truncate">{{ player.name }}</span>
                <span class="text-sm font-bold text-orange-400 tabular-nums">{{ player.value.toFixed(2) }}</span>
                <span class="text-xs text-slate-500 w-10">rating</span>
              </div>
            </template>
            <div v-else class="px-4 py-8 text-center text-slate-400 text-sm">No hay datos disponibles</div>
          </div>
        </div>

        <!-- Fixtures Tab -->
        <div v-if="activeTab === 'fixtures'" class="space-y-6">
          <!-- Partidos en Vivo -->
          <div v-if="visibleFixtures.live.length > 0" class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-red-500/30 p-4 md:p-6">
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
              <span class="flex items-center gap-2">
                <span class="animate-pulse w-3 h-3 bg-red-500 rounded-full"></span>
                EN VIVO
              </span>
            </h2>
            <div class="space-y-2">
              <div v-for="match in visibleFixtures.live" :key="match.id" class="bg-slate-700/50 rounded-xl p-3 hover:bg-slate-700 transition-colors">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1">
                    <router-link :to="`/team/${match.home.id}`" class="flex items-center gap-2 hover:opacity-80">
                      <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.home.id}.png`" class="w-6 h-6" />
                      <span class="font-semibold text-sm">{{ match.home.name }}</span>
                    </router-link>
                    <span class="text-xl font-bold text-red-500">{{ match.status.scoreStr }}</span>
                    <router-link :to="`/team/${match.away.id}`" class="flex items-center gap-2 hover:opacity-80">
                      <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.away.id}.png`" class="w-6 h-6" />
                      <span class="font-semibold text-sm">{{ match.away.name }}</span>
                    </router-link>
                  </div>
                  <div class="text-xs text-slate-400">{{ match.tournament?.name }}</div>
                </div>
              </div>
            </div>
            <div v-if="hasMoreLive" class="mt-3 text-center">
              <button @click="fixturesLimit.live += 5" class="rounded-lg border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 uppercase tracking-wider">
                CARGAR MÁS
              </button>
            </div>
          </div>

          <!-- Próximos Partidos -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-4 md:p-6">
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
              <i class="bi bi-calendar-event text-blue-500"></i>
              Próximos Partidos
            </h2>
            <div v-if="visibleFixtures.upcoming.length > 0" class="space-y-2">
            <div v-for="match in visibleFixtures.upcoming" :key="match.id" class="bg-slate-700/50 rounded-xl p-3 hover:bg-slate-700 transition-colors min-h-[60px] flex items-center">
                <div class="flex items-center gap-2 w-full">
                  <div class="text-xs text-slate-400 w-28 flex-shrink-0 leading-tight">
                    <div>{{ formatFixtureDate(match.status.utcTime) }}</div>
                    <div class="text-slate-500">{{ formatFixtureTime(match.status.utcTime) }}</div>
                  </div>
                  <div class="flex-1 grid grid-cols-[1fr_48px_1fr] items-center gap-1">
                    <router-link :to="`/team/${match.home.id}`" class="flex items-center justify-end gap-1.5 hover:opacity-80 min-w-0">
                      <span class="font-semibold text-sm text-right truncate">{{ match.home.name }}</span>
                      <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.home.id}.png`" class="w-6 h-6 flex-shrink-0" />
                    </router-link>
                    <div class="text-center text-slate-200 font-bold text-sm">VS</div>
                    <router-link :to="`/team/${match.away.id}`" class="flex items-center justify-start gap-1.5 hover:opacity-80 min-w-0">
                      <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.away.id}.png`" class="w-6 h-6 flex-shrink-0" />
                      <span class="font-semibold text-sm truncate">{{ match.away.name }}</span>
                    </router-link>
                  </div>
                  <div class="text-xs text-slate-500 w-36 text-right flex-shrink-0 hidden md:block truncate">{{ match.tournament?.name }}</div>
                </div>
              </div>
            </div>
            <div v-if="hasMoreUpcoming" class="mt-3 text-center">
              <button @click="fixturesLimit.upcoming += 5" class="rounded-lg border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 uppercase tracking-wider">
                CARGAR MÁS
              </button>
            </div>
            <div v-else class="text-center text-slate-400 py-8">
              No hay próximos partidos
            </div>
          </div>

          <!-- Partidos Finalizados -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-4 md:p-6">
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
              <i class="bi bi-check-circle text-green-500"></i>
              Partidos Finalizados
            </h2>
            <div v-if="visibleFixtures.finished.length > 0" class="space-y-2">
            <div v-for="match in visibleFixtures.finished" :key="match.id" class="bg-slate-700/50 rounded-xl p-3 hover:bg-slate-700 transition-colors min-h-[60px] flex items-center">
                <div class="flex items-center gap-2 w-full">
                  <div class="text-xs text-slate-400 w-24 flex-shrink-0">{{ formatFixtureDate(match.status.utcTime) }}</div>
                  <div class="flex-1 grid grid-cols-[1fr_64px_1fr] items-center gap-1">
                    <router-link :to="`/team/${match.home.id}`" class="flex items-center justify-end gap-1.5 hover:opacity-80 min-w-0">
                      <span class="font-semibold text-sm text-right truncate">{{ match.home.name }}</span>
                      <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.home.id}.png`" class="w-6 h-6 flex-shrink-0" />
                    </router-link>
                    <div class="text-center font-bold text-base text-white">{{ match.status.scoreStr }}</div>
                    <router-link :to="`/team/${match.away.id}`" class="flex items-center justify-start gap-1.5 hover:opacity-80 min-w-0">
                      <img :src="`https://images.fotmob.com/image_resources/logo/teamlogo/${match.away.id}.png`" class="w-6 h-6 flex-shrink-0" />
                      <span class="font-semibold text-sm truncate">{{ match.away.name }}</span>
                    </router-link>
                  </div>
                  <div class="text-xs text-slate-500 w-36 text-right flex-shrink-0 hidden md:block truncate">{{ match.tournament?.name }}</div>
                </div>
              </div>
            </div>
            <div v-if="hasMoreFinished" class="mt-3 text-center">
              <button @click="fixturesLimit.finished += 5" class="rounded-lg border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 uppercase tracking-wider">
                CARGAR MÁS
              </button>
            </div>
            <div v-else class="text-center text-slate-400 py-8">
              No hay partidos finalizados
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute } from 'vue-router';
import { getTeamDetails } from '../services/fotmob';

// Mapeo de códigos de FotMob a códigos ISO de países
const countryCodeMap = {
  'ENG': 'gb-eng',
  'SCO': 'gb-sct',
  'WAL': 'gb-wls',
  'NIR': 'gb-nir',
  'ARG': 'ar',
  'BRA': 'br',
  'URU': 'uy',
  'CHI': 'cl',
  'COL': 'co',
  'PER': 'pe',
  'ECU': 'ec',
  'VEN': 've',
  'PAR': 'py',
  'BOL': 'bo',
  'ESP': 'es',
  'ITA': 'it',
  'GER': 'de',
  'FRA': 'fr',
  'POR': 'pt',
  'NED': 'nl',
  'BEL': 'be',
  'SUI': 'ch',
  'AUT': 'at',
  'CRO': 'hr',
  'SRB': 'rs',
  'DEN': 'dk',
  'SWE': 'se',
  'NOR': 'no',
  'POL': 'pl',
  'CZE': 'cz',
  'SVK': 'sk',
  'HUN': 'hu',
  'ROU': 'ro',
  'GRE': 'gr',
  'TUR': 'tr',
  'UKR': 'ua',
  'RUS': 'ru',
  'MEX': 'mx',
  'USA': 'us',
  'CAN': 'ca',
  'CRC': 'cr',
  'JAM': 'jm',
  'ALG': 'dz',
  'EGY': 'eg',
  'MAR': 'ma',
  'NGA': 'ng',
  'SEN': 'sn',
  'GHA': 'gh',
  'CIV': 'ci',
  'CMR': 'cm',
  'TUN': 'tn',
  'MLI': 'ml',
  'BFA': 'bf',
  'GAB': 'ga',
  'GUI': 'gn',
  'KEN': 'ke',
  'RSA': 'za',
  'JPN': 'jp',
  'KOR': 'kr',
  'AUS': 'au',
  'IRN': 'ir',
  'KSA': 'sa',
  'QAT': 'qa',
  'UAE': 'ae',
  'IRQ': 'iq',
  'CHN': 'cn',
  'NZL': 'nz',
  'ISL': 'is',
  'FIN': 'fi',
  'IRL': 'ie',
  'ALB': 'al',
  'MKD': 'mk',
  'BIH': 'ba',
  'SVN': 'si',
  'LUX': 'lu',
  'CYP': 'cy',
  'MLT': 'mt',
  'ISR': 'il',
  'GEO': 'ge',
  'ARM': 'am',
  'AZE': 'az'
};

const route = useRoute();
const loading = ref(true);
const error = ref(null);
const teamData = ref(null);
const activeTab = ref('overview');
const fixturesLimit = ref({ live: 5, upcoming: 5, finished: 5 });

// Tabs configuration
const tabs = [
  { id: 'overview', label: 'Resumen', icon: 'bi bi-house' },
  { id: 'fixtures', label: 'Partidos', icon: 'bi bi-calendar3' },
  { id: 'lineup', label: 'Último 11', icon: 'bi bi-diagram-3' },
  { id: 'squad', label: 'Plantilla', icon: 'bi bi-people' },
  { id: 'stats', label: 'Estadísticas', icon: 'bi bi-graph-up' }
];

// Último 11 titular
const lastLineup = computed(() => {
  if (!teamData.value?.overview?.lastLineupStats) return null;
  return teamData.value.overview.lastLineupStats;
});

// Próximo partido
const nextMatch = computed(() => {
  if (!teamData.value?.fixtures?.allFixtures?.fixtures) return null;
  
  const upcoming = teamData.value.fixtures.allFixtures.fixtures.find(f => !f.status?.finished);
  if (!upcoming) return null;
  
  return {
    id: upcoming.id,
    date: new Date(upcoming.status?.utcTime).toLocaleDateString('es-AR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    }),
    time: new Date(upcoming.status?.utcTime).toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    home: {
      id: upcoming.home?.id,
      name: upcoming.home?.name,
      logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${upcoming.home?.id}.png`
    },
    away: {
      id: upcoming.away?.id,
      name: upcoming.away?.name,
      logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${upcoming.away?.id}.png`
    },
    competition: upcoming.tournament?.leagueName || ''
  };
});

// Últimos 5 partidos
const recentMatches = computed(() => {
  if (!teamData.value?.fixtures?.allFixtures?.fixtures) return [];
  
  const teamId = parseInt(route.params.teamId);
  const finished = teamData.value.fixtures.allFixtures.fixtures
    .filter(f => f.status?.finished)
    .sort((a, b) => new Date(b.status?.utcTime) - new Date(a.status?.utcTime))
    .slice(0, 5)
    .map(match => {
      const isHome = match.home?.id === teamId;
      const teamScore = isHome ? match.home?.score : match.away?.score;
      const opponentScore = isHome ? match.away?.score : match.home?.score;
      
      let result = 'D';
      if (teamScore > opponentScore) result = 'W';
      if (teamScore < opponentScore) result = 'L';
      
      return {
        id: match.id,
        date: new Date(match.status?.utcTime).toLocaleDateString('es-AR', { 
          day: 'numeric', 
          month: 'short' 
        }),
        homeId: match.home?.id,
        home: match.home?.name,
        homeLogo: `https://images.fotmob.com/image_resources/logo/teamlogo/${match.home?.id}.png`,
        awayId: match.away?.id,
        away: match.away?.name,
        awayLogo: `https://images.fotmob.com/image_resources/logo/teamlogo/${match.away?.id}.png`,
        score: `${match.home?.score}-${match.away?.score}`,
        result: result,
        competition: match.tournament?.name || ''
      };
    });
  
  return finished;
});

// Estadísticas del equipo (W-D-L)
const teamStats = computed(() => {
  const stats = { wins: 0, draws: 0, losses: 0 };
  recentMatches.value.forEach(match => {
    if (match.result === 'W') stats.wins++;
    if (match.result === 'D') stats.draws++;
    if (match.result === 'L') stats.losses++;
  });
  return stats;
});

// Posición en la tabla
const tablePosition = computed(() => {
  const teamId = parseInt(route.params.teamId);
  const tables = teamData.value?.table?.data?.tables
    || teamData.value?.table?.[0]?.data?.tables
    || [];

  for (const table of tables) {
    const allTeams = table?.table?.all;
    if (!Array.isArray(allTeams)) continue;
    const found = allTeams.find(t => t.id === teamId);
    if (found) return found;
  }

  return null;
});

// Todos los partidos (fixtures)
const allFixtures = computed(() => {
  if (!teamData.value?.fixtures?.allFixtures?.fixtures) return [];
  return teamData.value.fixtures.allFixtures.fixtures;
});

// Partidos agrupados por estado
const fixturesGrouped = computed(() => {
  const upcoming = allFixtures.value.filter(f => !f.status?.started && !f.status?.finished);
  const finished = allFixtures.value.filter(f => f.status?.finished);
  const live = allFixtures.value.filter(f => f.status?.started && !f.status?.finished);
  
  return { upcoming, finished, live };
});

const visibleFixtures = computed(() => ({
  live: fixturesGrouped.value.live.slice(0, fixturesLimit.value.live),
  upcoming: fixturesGrouped.value.upcoming.slice(0, fixturesLimit.value.upcoming),
  finished: fixturesGrouped.value.finished.slice(0, fixturesLimit.value.finished)
}));

const hasMoreLive = computed(() => fixturesGrouped.value.live.length > visibleFixtures.value.live.length);
const hasMoreUpcoming = computed(() => fixturesGrouped.value.upcoming.length > visibleFixtures.value.upcoming.length);
const hasMoreFinished = computed(() => fixturesGrouped.value.finished.length > visibleFixtures.value.finished.length);

// Top players del equipo
const topScorers = computed(() => {
  if (!teamData.value?.overview?.topPlayers?.byGoals?.players) return [];
  return teamData.value.overview.topPlayers.byGoals.players.slice(0, 10);
});

const topAssists = computed(() => {
  if (!teamData.value?.overview?.topPlayers?.byAssists?.players) return [];
  return teamData.value.overview.topPlayers.byAssists.players.slice(0, 10);
});

const topRated = computed(() => {
  if (!teamData.value?.overview?.topPlayers?.byRating?.players) return [];
  return teamData.value.overview.topPlayers.byRating.players.slice(0, 10);
});

// Formatear fecha de partido
const formatFixtureDate = (utcTime) => {
  const date = new Date(utcTime);
  return date.toLocaleDateString('es-AR', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
};

const formatFixtureTime = (utcTime) => {
  const date = new Date(utcTime);
  return date.toLocaleTimeString('es-AR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// Imagen de jugador con fallback
const getPlayerImage = (playerId) => {
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`;
};

// Color de círculo según posición (inferida por coordenada Y del campo)
const playerPosColor = (player) => {
  const y = player?.verticalLayout?.y ?? 0.5
  if (y > 0.82) return 'bg-amber-500/80'  // GK
  if (y > 0.57) return 'bg-blue-500/80'   // DEF
  if (y > 0.33) return 'bg-violet-500/80' // MF
  return 'bg-rose-500/80'                 // FW
};

const handlePlayerImageError = (event) => {
  event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect fill="%23334155" width="80" height="80"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-size="24" font-family="Arial"%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E';
};

// Convierte códigos de FotMob a códigos ISO para banderas
const getFlagCode = (fotmobCode) => {
  if (!fotmobCode) return '';
  const upperCode = fotmobCode.toUpperCase();
  return countryCodeMap[upperCode] || fotmobCode.toLowerCase();
};

// Cargar datos del equipo
const loadTeamData = async ({ silent = false } = {}) => {
  if (!silent || !teamData.value) loading.value = true;
  error.value = null;
  
  try {
    const teamId = route.params.teamId || route.query.id;
    
    if (!teamId) {
      error.value = 'No se proporcionó un ID de equipo';
      return;
    }

    // Obtener datos del equipo desde la API
    const data = await getTeamDetails(teamId);
    
    if (data) {
      teamData.value = data;
    } else {
      error.value = 'No se pudieron cargar los datos del equipo';
    }
  } catch (err) {
    console.error('Error loading team data:', err);
    error.value = err.message || 'Error al cargar los datos del equipo';
  } finally {
    loading.value = false;
  }
};

// Auto-refresh cada 30 segundos
let refreshInterval = null;

onMounted(() => {
  loadTeamData();
  
  // Configurar auto-refresh
  refreshInterval = setInterval(() => {
    loadTeamData({ silent: true });
  }, 30000); // 30 segundos
});

onBeforeUnmount(() => {
  // Limpiar interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
