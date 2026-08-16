# Local Vector Magic runtime

Place a licensed Vector Magic Desktop runtime at `vendor/vector-magic/` when
you want the local Vite bridge to use a repository-adjacent copy. That directory
is intentionally ignored by Git because Vector Magic's bundled EULA does not
grant redistribution rights.

Executable discovery order is:

1. `VECTOR_MAGIC_EXE`
2. `vendor/vector-magic/vmde.exe`
3. the standard Program Files locations

The Vite build does not copy this directory into `dist/`.
