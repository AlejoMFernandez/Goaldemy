# Script para actualizar todas las páginas de ligas con las mejoras

$pages = @(
    @{File="PremierLeague.vue"; League="PREMIER_LEAGUE"},
    @{File="LaLiga.vue"; League="LA_LIGA"},
    @{File="SerieA.vue"; League="SERIE_A"},
    @{File="Bundesliga.vue"; League="BUNDESLIGA"},
    @{File="Ligue1.vue"; League="LIGUE_1"}
)

foreach ($page in $pages) {
    $filePath = "src\pages\$($page.File)"
    Write-Host "Actualizando $($page.File)..." -ForegroundColor Cyan
    
    # Leer el contenido
    $content = Get-Content $filePath -Raw
    
    # 1. Actualizar columna +/- en thead
    $content = $content -replace 'tracking-wider w-12">P</th>\s+<th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">\+/-</th>', 'tracking-wider w-12">P</th>
                  <th class="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-20">+/-</th>'
    
    # 2. Actualizar columna Form en thead  
    $content = $content -replace 'tracking-wider w-16">PTS</th>\s+<th class="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Form</th>', 'tracking-wider w-16">PTS</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Form</th>'
    
    # 3. Actualizar celda +/- en tbody
    $content = $content -replace 'text-sm">{{ team\.losses }}</td>\s+<td class="text-center py-4 px-2 text-slate-300 text-sm">{{ team\.scoresStr }}</td>', 'text-sm">{{ team.losses }}</td>
                    <td class="text-center py-4 px-3 text-slate-300 text-sm">{{ team.scoresStr }}</td>'
    
    # 4. Actualizar celda Form en tbody
    $content = $content -replace 'text-base">{{ team\.pts }}</td>\s+<td class="text-center py-4 px-2">\s+<div class="flex gap-1 justify-center">', 'text-base">{{ team.pts }}</td>
                    <td class="text-center py-4 px-4">
                      <div class="flex gap-1 justify-center">'
    
    # 5. Actualizar header Tabla de Posiciones
    $content = $content -replace '<div class="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-b border-white/10 px-6 py-4">\s+<div class="flex items-center justify-between">\s+<h2 class="text-xl font-bold text-white flex items-center gap-2">\s+<i class="bi bi-trophy-fill text-purple-400"></i>\s+Tabla de Posiciones', '<div class="bg-slate-800/50 border-b border-white/10 px-6 py-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <i class="bi bi-trophy-fill text-slate-400"></i>
                Tabla de Posiciones'
    
    # Guardar cambios
    $content | Set-Content $filePath -NoNewline
    
    Write-Host "✓ $($page.File) actualizado" -ForegroundColor Green
}

Write-Host "`n¡Todas las páginas actualizadas exitosamente!" -ForegroundColor Green
