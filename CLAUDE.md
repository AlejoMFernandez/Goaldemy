## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## SQL pendientes (supabase/pendientes/)

Al empezar cualquier tarea, revisá `supabase/pendientes/`. Si hay archivos `.sql`:
1. Leelos y chequeá que no choquen con el esquema real (tablas, columnas, códigos existentes, logros activos).
2. Corrélos en Supabase en orden de nombre (vienen con fecha adelante).
3. Si uno falla, no sigas con los demás: avisá el error y dejalo en la carpeta.
4. Los que corrieron bien, movelos a `supabase/` (mismo nombre) y mencionalos en el resumen final.
Estos archivos los escribe Claude (Cowork) desde el proyecto FULVO para que se apliquen sin pasos manuales.
