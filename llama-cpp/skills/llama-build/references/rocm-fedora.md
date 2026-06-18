# ROCm Setup on Fedora for llama.cpp

## Table of contents

1. [Compatibility matrix](#compatibility-matrix)
2. [Check GPU compatibility](#check-gpu-compatibility)
3. [Install ROCm](#install-rocm)
4. [Kernel driver setup](#kernel-driver-setup)
5. [Verify installation](#verify-installation)
6. [GPU architecture targets](#gpu-architecture-targets)
7. [Environment variables](#environment-variables)
8. [Common issues](#common-issues)

## Compatibility matrix

Use this to decide whether Fedora's native ROCm packages will work, or if you need AMD's repo.

**Fedora native ROCm versions:**

| Fedora | ROCm | Kernel |
|--------|-------|--------|
| 42 | 6.3.1 | 6.11 |
| 43 | 6.4.2 | 6.13 |
| 44 | 7.1.1 | 7.0.x |
| Rawhide (45) | 7.2.1 | 6.15+ |

**GPU → minimum ROCm → minimum Fedora:**

| GPU | Arch | Min ROCm | Min kernel | Fedora native? | If not compatible |
|-----|------|----------|-----------|----------------|-------------------|
| RX 6600–6900 XT | RDNA2 gfx1030 | 5.0 | 5.x | F42+ — yes | — |
| RX 7600–7900 XTX | RDNA3 gfx1100 | 5.5 | 5.x | F42+ — yes | — |
| RX 9070 XT/9070 | RDNA4 gfx1200 | 6.4.1 | 6.12 | F42 — **no**; F43+ — yes | Use AMD repo, or upgrade to F43+ |
| RX 9060 XT/9060 | RDNA4 gfx1201 | 7.0.2 | 6.12 | F42/F43 — **no**; F44+ — yes | Use AMD repo, or upgrade to F44+ |

**When to use AMD's `amdgpu-install` repo instead of native packages:**
- Your GPU needs a newer ROCm than your Fedora version ships
- You're on RHEL, CentOS, or Rocky Linux (no native ROCm packages)
- You're on Fedora Atomic (Silverblue/Kinoite) — use a Toolbox container
- You need a specific ROCm version for compatibility with other tools (e.g., PyTorch)

## Check GPU compatibility

```bash
lspci | grep -iE 'vga|3d|display'
```

ROCm officially supports these AMD GPU families:
- RDNA4: RX 9070 XT/9070, RX 9060 XT/9060 (ROCm 7.0.2+)
- RDNA3: RX 7900 XTX/XT/GRE, RX 7800 XT, RX 7700 XT, RX 7600
- RDNA2: RX 6900 XT, RX 6800 XT/6800, RX 6700 XT, RX 6600 XT
- CDNA3/2: Instinct MI300/MI250/MI210

Unofficial GPUs (older RDNA, APUs) can often work with `HSA_OVERRIDE_GFX_VERSION`.

## Install ROCm

### Fedora (preferred — native packages)

Fedora ships ROCm in its official repositories. No third-party AMD repos needed.

| Fedora | ROCm version |
|--------|-------------|
| 42 | 6.3.1 |
| 43 | 6.4.2 |
| 44 | 7.1.1 |
| Rawhide (45) | 7.2.1 |

```bash
# Install ROCm HIP, tools, and build dependencies
sudo dnf install rocm-hip-devel hipcc rocminfo rocm-smi cmake gcc-c++ openssl-devel

# For RDNA3+ flash attention performance
sudo dnf install rocwmma-devel

# Add user to GPU groups
sudo usermod -aG render,video $USER
```

Log out and back in (or reboot) for group changes to take effect.

### RHEL / older distros (AMD repo fallback)

If your distro doesn't ship ROCm natively, use AMD's `amdgpu-install` meta-installer
(https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/quick-start.html):

```bash
# Install the amdgpu-install package (adjust version/OS as needed)
# Check https://repo.radeon.com/amdgpu-install/ for the latest version
sudo dnf install https://repo.radeon.com/amdgpu-install/7.2.1/rhel/9.7/amdgpu-install-7.2.1.70201-1.el9.noarch.rpm
sudo dnf clean all

# Install EPEL (needed for some dependencies)
wget https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
sudo rpm -ivh epel-release-latest-9.noarch.rpm

# Install kernel headers, driver, and ROCm
sudo dnf install "kernel-headers-$(uname -r)" "kernel-devel-$(uname -r)"
sudo dnf install amdgpu-dkms
sudo dnf install rocm

# Build dependencies for llama.cpp
sudo dnf install cmake gcc-c++ openssl-devel

# Add user to GPU groups and reboot
sudo usermod -aG render,video $USER
```

### rocWMMA from source (optional)

If rocWMMA is not available via your package manager, build from source
(https://github.com/ROCm/rocWMMA):

```bash
git clone https://github.com/ROCm/rocWMMA.git
cd rocWMMA && git checkout rocm-7.2.1
# Headers are in library/include/ — pass to cmake via:
# -DCMAKE_CXX_FLAGS="-I$(pwd)/library/include/"
```

rocWMMA supports RDNA3 (gfx1100-1102), RDNA3.5 (gfx1150-1151), RDNA4 (gfx1200-1201), and CDNA (gfx9xx).
See https://github.com/ROCm/rocWMMA for details.

### Fedora Atomic (Silverblue/Kinoite)

Atomic desktops cannot install ROCm packages directly on the host. Options:
1. Use a Fedora Toolbox container (`toolbox create && toolbox enter`)
2. Use Podman/Docker with a ROCm-enabled image
3. Layer packages with `rpm-ostree` (not recommended for ROCm)

## Kernel driver setup

The AMDGPU kernel driver is included in the Fedora kernel by default for most GPUs. Verify:

```bash
lsmod | grep amdgpu
dmesg | grep -i amdgpu
```

If the driver isn't loaded, you may need the DKMS package:
```bash
sudo dnf install amdgpu-dkms
```

## Verify installation

```bash
# Check ROCm is working
rocminfo | head -30

# Check HIP compiler
hipcc --version

# Check GPU is visible
rocm-smi

# Get GPU architecture string
rocminfo | grep gfx | head -1 | awk '{print $2}'
```

## GPU architecture targets

When building llama.cpp, `GPU_TARGETS` specifies the GPU microarchitecture. Common mappings:

| GPU | Architecture | GPU_TARGETS | ROCm version |
|-----|-------------|-------------|--------------|
| RX 9070 XT/9070 | RDNA4 | gfx1200 | 7.0+ |
| RX 9060 XT/9060 | RDNA4 | gfx1201 | 7.0.2+ |
| RX 7900 XTX/XT/GRE | RDNA3 | gfx1100 | 5.5+ |
| RX 7800 XT / 7700 XT | RDNA3 | gfx1101 | 5.5+ |
| RX 7600 | RDNA3 | gfx1102 | 5.5+ |
| RX 6900 XT / 6800 XT | RDNA2 | gfx1030 | 5.0+ |
| RX 6700 XT | RDNA2 | gfx1031 | 5.0+ |
| RX 6600 XT | RDNA2 | gfx1032 | 5.0+ |
| Steam Deck (APU) | RDNA2 | gfx1035 | unofficial |

If omitted, cmake will auto-detect GPUs present in the system.

To find yours: `rocminfo | grep gfx | head -1 | awk '{print $2}'`

Note: map to the most significant version. E.g., `gfx1035` maps to target `gfx1030`.

Note: On ROCm 7.1, the RX 9060 XT may be reported as `gfx1200` rather than `gfx1201`, and cmake auto-detects `gfx1200`. Leave `GPU_TARGETS` unset to use the auto-detected target.

## Environment variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `HIP_VISIBLE_DEVICES` | Select which GPU(s) to use | `0` or `0,1` |
| `HSA_OVERRIDE_GFX_VERSION` | Override GPU arch for unsupported GPUs | `10.3.0` (RDNA2), `11.0.0` (RDNA3), `12.0.0` (RDNA4) |
| `GGML_CUDA_ENABLE_UNIFIED_MEMORY` | Use UMA for integrated GPUs | `1` |
| `GPU_MAX_HW_QUEUES` | Tune queue depth | `8` |

## Common issues

### "cannot find ROCm device library"

```bash
# Find the device library
find $(hipconfig -R) -name "oclc_abi_version_400.bc" 2>/dev/null

# Set the path and rebuild
HIP_DEVICE_LIB_PATH=/path/found HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -R)" \
    cmake -S . -B build -DGGML_HIP=ON -DCMAKE_BUILD_TYPE=Release
```

### Permission denied on /dev/kfd

```bash
sudo usermod -aG render,video $USER
# Then log out and back in
```

### GPU not detected by rocminfo

1. Check kernel driver: `lsmod | grep amdgpu`
2. Check firmware: `dmesg | grep -i amdgpu | grep firmware`
3. Make sure IOMMU is enabled in BIOS
4. Try updating kernel and firmware: `sudo dnf update`
