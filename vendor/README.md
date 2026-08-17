# Vendor policy

The project no longer bundles a proprietary vectorizer or native executable.
Raster-to-vector conversion uses the official `@visioncortex/vtracer` package,
an open-source MIT/Apache-2.0 WebAssembly build installed through npm.

This directory is reserved for assets whose licences explicitly permit
redistribution. Keep generated binaries and locally licensed applications out
of source control.
