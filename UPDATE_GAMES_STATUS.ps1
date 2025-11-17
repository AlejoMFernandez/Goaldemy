# Script para actualizar TODOS los juegos con el nuevo sistema de celebraciones

Write-Host "🎮 Actualizando todos los juegos con el sistema de GamePreviewModal y GameSummaryPopup..." -ForegroundColor Cyan

# Los archivos ya están actualizados:
# - NationalityGame.vue ✅ (ya tiene el sistema completo)
# - PlayerPosition.vue ✅ (recién actualizado)

# ShirtNumber.vue, ValueOrder.vue, AgeOrder.vue, HeightOrder.vue necesitan actualización

Write-Host "✅ Sistema implementado exitosamente en:" -ForegroundColor Green
Write-Host "  - NationalityGame.vue (TIMED - 30s/10 aciertos)"
Write-Host "  - PlayerPosition.vue (TIMED - 30s/10 aciertos)"

Write-Host ""
Write-Host "⏳ Pendientes de implementación manual:" -ForegroundColor Yellow
Write-Host "  - ShirtNumber.vue (TIMED - 30s/10 aciertos)"
Write-Host "  - ValueOrder.vue (ORDERING - 5/5 correctos)"
Write-Host "  - AgeOrder.vue (ORDERING - 5/5 correctos)"
Write-Host "  - HeightOrder.vue (ORDERING - 5/5 correctos)"
Write-Host "  - WhoIs.vue (LIVES - ya tiene sonidos)"
Write-Host "  - GuessPlayer.vue (LIVES - ya tiene sonidos)"

Write-Host ""
Write-Host "📋 Los juegos TIMED siguen el patrón de NationalityGame/PlayerPosition:"
Write-Host "  1. Import celebrateCorrect, checkEarlyWin, celebrateGameWin, announceGameLoss, celebrateGameLevelUp"
Write-Host "  2. Import getGameMetadata, GamePreviewModal, GameSummaryPopup"
Write-Host "  3. Computed property: gameMetadata() { return getGameMetadata('game-slug') }"
Write-Host "  4. Data properties: earlyWin: false"
Write-Host "  5. En pick/choose: celebrateCorrect() cuando correcto, checkEarlyWin() para victoria anticipada"
Write-Host "  6. En timer: celebrateGameWin() o announceGameLoss() según resultado"
Write-Host "  7. finishChallenge(result) method para manejar fin del juego"
Write-Host "  8. Template: GamePreviewModal al inicio, GameSummaryPopup al final"

Write-Host ""
Write-Host "📋 Los juegos ORDERING (ValueOrder, AgeOrder, HeightOrder):"
Write-Host "  1. NO tienen timer (sin límite de tiempo)"
Write-Host "  2. Mechanic: 'Ordená los 5 jugadores correctamente para ganar'"
Write-Host "  3. winThreshold: 5 (todos correctos)"
Write-Host "  4. En check(): celebrateGameWin() si corrects===5, announceGameLoss() si no"
Write-Host "  5. Agregar GamePreviewModal antes del card"
Write-Host "  6. Reemplazar popup actual con GameSummaryPopup (winThreshold=5)"

Write-Host ""
Write-Host "📋 Los juegos LIVES (WhoIs, GuessPlayer):"
Write-Host "  1. Ya tienen celebrateCorrect() y sonidos implementados"
Write-Host "  2. Agregar GamePreviewModal"
Write-Host "  3. Mechanic: 'Adiviná jugadores sin perder todas las vidas'"
Write-Host "  4. GameSummaryPopup adaptado (sin winThreshold específico, mostrar vidas restantes)"

Write-Host ""
Write-Host "🎯 ¡El sistema está listo! Ahora podemos aplicarlo a los juegos restantes." -ForegroundColor Green
