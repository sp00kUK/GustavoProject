# Bundled Vector Magic Desktop Runtime

This directory contains the verified Vector Magic Desktop Edition 1.15 runtime
at `vendor/vector-magic/` so that Gustavo has the complete vectorization engine
available out-of-the-box on Windows without needing a separate installation.

Executable discovery order in the Vite bridge is:

1. `VECTOR_MAGIC_EXE` (environment variable override)
2. `vendor/vector-magic/vmde.exe` (repo-bundled runtime)
3. Standard Program Files locations (`C:\Program Files (x86)\Vector Magic\vmde.exe`)

The Vite client build does not copy this native directory into `dist/`.

