#!/usr/bin/env python3
"""Read-only inspection of an EXE supplied by the user; does not execute it.
Usage: python3 scripts/inspect-exe.py path/to/AutoJubenLauncher.exe
"""
import re,sys,pathlib
if len(sys.argv)!=2:
 print(__doc__);sys.exit(2)
b=pathlib.Path(sys.argv[1]).read_bytes()
methods=sorted({x.decode('ascii') for x in re.findall(rb'window\.go\.app\.Service\.([A-Za-z][A-Za-z0-9_]*)',b)})
print(f'File: {sys.argv[1]} ({len(b):,} bytes)')
print(f'Wails front-end Service call names: {len(methods)}')
for name in methods: print('  '+name)
print('This is static method-name extraction only; no Windows binary is executed.')
