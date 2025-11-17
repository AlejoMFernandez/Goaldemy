# 🚀 Script de actualización masiva de juegos

$gamesPath = "c:\xampp\htdocs\Goaldemy\src\pages\games"

Write-Host "🎮 ACTUALIZANDO TODOS LOS JUEGOS CON EL NUEVO SISTEMA" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Listar todos los juegos
$games = @(
    "NationalityGame.vue",
    "PlayerPosition.vue",
    "ShirtNumber.vue",
    "ValueOrder.vue",
    "AgeOrder.vue",
    "HeightOrder.vue",
    "WhoIs.vue",
    "GuessPlayer.vue"
)

Write-Host "📋 Juegos en el proyecto:" -ForegroundColor Yellow
foreach ($game in $games) {
    $path = Join-Path $gamesPath $game
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Write-Host "  ✓ $game ($([math]::Round($size/1KB, 1)) KB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $game (NO ENCONTRADO)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ COMPLETADOS CON NUEVO SISTEMA:" -ForegroundColor Green
Write-Host "  • NationalityGame.vue (TIMED - 30s/10 aciertos)"
Write-Host "  • PlayerPosition.vue (TIMED - 30s/10 aciertos)"

Write-Host ""
Write-Host "⏳ PENDIENTES:" -ForegroundColor Yellow
Write-Host "  • ShirtNumber.vue (TIMED)"
Write-Host "  • ValueOrder.vue (ORDERING)"
Write-Host "  • AgeOrder.vue (ORDERING)"
Write-Host "  • HeightOrder.vue (ORDERING)"
Write-Host "  • WhoIs.vue (LIVES)"
Write-Host "  • GuessPlayer.vue (LIVES)"

Write-Host ""
Write-Host "📚 Consultar GAME_IMPLEMENTATION_GUIDE.md para instrucciones detalladas" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 El sistema está estandarizado y listo para replicar!" -ForegroundColor Green
