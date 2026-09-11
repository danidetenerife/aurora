---
description: Download and install Aurora on your platform
---

# Installation

Download the latest release from [GitHub Releases](https://github.com/danidetenerife/aurora/releases). Pick the file that matches your platform.

{% tabs %}

{% tab title="Windows" %}

| File | What it is |
| ---- | ---------- |
| `Aurora_x.y.z_x64-setup.exe` | Interactive installer. Installs per-user, no admin required. Recommended for most users. |
| `Aurora_x.y.z_x64_en-US.msi` | MSI installer. For system-wide or managed deployments (e.g. via Group Policy). |

Run the installer and follow the prompts. Aurora will be available from the Start menu after installation.

{% endtab %}

{% tab title="macOS" %}

| File | What it is |
| ---- | ---------- |
| `Aurora_x.y.z_aarch64.dmg` | Disk image for Apple Silicon Macs (M1, M2, M3, M4). |
| `Aurora_x.y.z_x64.dmg` | Disk image for Intel Macs. |

Open the `.dmg` and drag Aurora to your Applications folder.

### Gatekeeper warning

Aurora is not signed with an Apple Developer certificate. macOS will block it from opening the first time. To allow it:

1. Right-click the app in your Applications folder and select **Open**
2. Click **Open** in the dialog that appears

If that doesn't work, run this in Terminal:

```bash
sudo xattr -r -d com.apple.quarantine /Applications/Aurora.app
```

You only need to do this once.

{% endtab %}

{% tab title="Linux" %}

| File | What it is |
| ---- | ---------- |
| `Aurora_x.y.z_amd64.AppImage` | Portable binary. No installation needed, just make it executable and run it. Works on most distributions. |
| `Aurora_x.y.z_amd64.deb` | Debian package for Ubuntu, Debian, Pop!_OS, and other Debian-based distributions. |
| `Aurora-x.y.z-1.x86_64.rpm` | RPM package for Fedora, openSUSE, and other RPM-based distributions. |

### Flatpak

Aurora is available on [Flathub](https://flathub.org/en/apps/com.auroraplayer.Aurora). This is the recommended way to install on Linux if your distribution supports Flatpak, since Flathub handles updates automatically.

```bash
flatpak install flathub com.auroraplayer.Aurora
```

Note that the Flatpak sandbox may prevent some features from working. If you run into issues, try the `.deb`, `.rpm`, or AppImage instead.

### Snap

Aurora is published to the [Snap Store](https://snapcraft.io) on the stable channel. If your distribution supports Snap:

```bash
sudo snap install aurora
```

### Arch Linux

Aurora is available in the AUR:

- [aurora-player-bin](https://aur.archlinux.org/packages/aurora-player-bin) - prebuilt binary
- [aurora-player-git](https://aur.archlinux.org/packages/aurora-player-git) - built from source

Install with your AUR helper of choice, e.g.:

```bash
yay -S aurora-player-bin
```

{% endtab %}

{% endtabs %}

## Auto-updates

Aurora checks for updates on startup and can install them automatically. You can toggle this in Settings under **General > Updates**.
