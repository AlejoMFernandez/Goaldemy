# Script para aplicar diseño compacto a SerieA, Bundesliga, Ligue1

$files = @(
    'c:\xampp\htdocs\Golademy\Goaldemy\src\pages\SerieA.vue',
    'c:\xampp\htdocs\Golademy\Goaldemy\src\pages\Bundesliga.vue',
    'c:\xampp\htdocs\Golademy\Goaldemy\src\pages\Ligue1.vue'
)

foreach ($file in $files) {
    Write-Host "Procesando $file..." -ForegroundColor Cyan
    
    $content = Get-Content $file -Raw
    
    # 1. Botones navegación
    $content = $content -replace 'w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white transition-colors disabled:opacity-30','w-7 h-7 rounded-md flex items-center justify-center bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-20'
    $content = $content -replace '<span class="text-base">◀</span>','<i class="bi bi-chevron-left text-sm"></i>'
    $content = $content -replace '<span class="text-base">▶</span>','<i class="bi bi-chevron-right text-sm"></i>'
    $content = $content -replace 'text-base font-bold text-white min-w-\[100px\]','text-sm font-bold text-white min-w-[90px]'
    $content = $content -replace 'px-5 py-3\.5">\s+<div class="flex items-center justify-center gap-3">','px-5 py-3">' + "`n" + '              <div class="flex items-center justify-center gap-2">'
    
    # 2. Header fechas partidos
    $content = $content -replace 'px-5 py-2\.5 bg-slate-800/50','px-4 py-1.5 bg-slate-800/50'
    $content = $content -replace 'text-xs font-bold text-slate-300 uppercase','text-[10px] font-bold text-slate-400 uppercase'
    
    # 3. Rows partidos
    $content = $content -replace 'py-3\.5">\s+<div class="px-5 flex','py-2">' + "`n" + '                <div class="px-4 flex'
    $content = $content -replace 'gap-3">\s+<div class="flex items-center gap-2\.5 flex-1 justify-end">','gap-2">' + "`n" + '                  <div class="flex items-center gap-2 flex-1 justify-end min-w-0">'
    $content = $content -replace 'text-sm text-right">','text-xs text-right truncate">'
    $content = $content -replace 'w-7 h-7 object-contain flex-shrink-0"','w-5 h-5 object-contain flex-shrink-0"'
    $content = $content -replace 'min-w-\[60px\]">\s+<div v-if="match\.status\.finished" class="text-xs','min-w-[50px]">' + "`n" + '                    <div v-if="match.status.finished" class="text-[10px]'
    $content = $content -replace 'text-xs text-slate-400 font-semibold">','text-[10px] text-slate-400 font-semibold">'
    $content = $content -replace 'gap-2\.5 flex-1">\s+<img','gap-2 flex-1 min-w-0">' + "`n" + '                    <img'
    $content = $content -replace 'text-sm">','text-xs truncate">'
    
    # 4. Tabla equipos
    $content = $content -replace 'py-4 px-4">\s+<div\s+class="w-1 h-8','py-2.5 px-4">' + "`n" + '                      <div ' + "`n" + '                        class="w-1 h-6'
    $content = $content -replace 'py-4 px-2 text-slate-300 font-semibold">','py-2.5 px-2 text-slate-300 font-semibold text-sm">'
    $content = $content -replace 'py-4 px-4">\s+<div class="flex items-center gap-3">','py-2.5 px-4">' + "`n" + '                      <div class="flex items-center gap-2.5">'
    $content = $content -replace 'w-7 h-7 object-contain"\s+@error','w-6 h-6 object-contain flex-shrink-0"' + "`n" + '                          @error'
    $content = $content -replace 'font-medium text-white group-hover','font-medium text-white text-sm truncate max-w-[180px] group-hover'
    $content = $content -replace 'py-4 px-2 text-slate-400 text-sm">','py-2.5 px-2 text-slate-400 text-xs">'
    $content = $content -replace 'py-4 px-2 text-slate-300 text-sm">','py-2.5 px-2 text-slate-300 text-xs">'
    $content = $content -replace 'py-4 px-3 text-slate-300 text-sm">','py-2.5 px-3 text-slate-300 text-xs">'
    $content = $content -replace 'py-4 px-2 text-sm font-semibold">','py-2.5 px-2 text-xs font-semibold">'
    $content = $content -replace 'py-4 px-2 text-white font-bold text-base">','py-2.5 px-2 text-white font-bold text-sm">'
    $content = $content -replace 'py-4 px-4">\s+<div class="flex gap-1','py-2.5 px-4">' + "`n" + '                      <div class="flex gap-0.5'
    
    # 5. Form badges
    $content = $content -replace 'w-5 h-5 rounded flex items-center justify-center text-\[10px\]','w-4 h-4 rounded flex items-center justify-center text-[9px]'
    
    Set-Content $file $content -NoNewline
    Write-Host "✓ Completado: $file" -ForegroundColor Green
}

Write-Host "`n✅ Todos los archivos actualizados!" -ForegroundColor Green
