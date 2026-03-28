#!/bin/bash
# Rebuild llama.cpp with HIP/ROCm + rocWMMA flash attention

set -e

cd "$(dirname "$0")"

JOBS="${1:-4}"

HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -R)" \
    cmake -S . -B build \
    -DGGML_HIP=ON \
    -DGGML_HIP_ROCWMMA_FATTN=ON \
    -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release -j "$JOBS"

echo ""
./build/bin/llama-cli --version
