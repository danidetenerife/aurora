#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/aurora-player-bin/PKGBUILD.template"
WORK_DIR="/tmp/aurora-aur-bin"

VERSION=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        *) echo "Usage: $0 --version <version> [--dry-run]"; exit 1 ;;
    esac
done

[[ -z "${VERSION}" ]] && { echo "Usage: $0 --version <version> [--dry-run]"; exit 1; }

DEB_URL="https://github.com/nukeop/aurora/releases/download/player@${VERSION}/Aurora_${VERSION}_amd64.deb"

export PKGVER="${VERSION}"
export SHA256SUM=$(curl -fSL "${DEB_URL}" | sha256sum | cut -d' ' -f1)

rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"
envsubst '$PKGVER $SHA256SUM' < "${TEMPLATE}" > "${WORK_DIR}/PKGBUILD"
if [[ "$(id -u)" -eq 0 ]]; then
    useradd -m builduser 2>/dev/null || true
    chown -R builduser "${WORK_DIR}"
    su builduser -c "cd ${WORK_DIR} && makepkg --printsrcinfo > .SRCINFO"
else
    (cd "${WORK_DIR}" && makepkg --printsrcinfo > .SRCINFO)
fi

if [[ "${DRY_RUN}" == true ]]; then
    cat "${WORK_DIR}/PKGBUILD"
    echo "---"
    cat "${WORK_DIR}/.SRCINFO"
    exit 0
fi

AUR_REPO="/tmp/aurora-aur-repo"
rm -rf "${AUR_REPO}"
git clone ssh://aur@aur.archlinux.org/aurora-player-bin.git "${AUR_REPO}"
cp "${WORK_DIR}/PKGBUILD" "${WORK_DIR}/.SRCINFO" "${AUR_REPO}/"
cd "${AUR_REPO}"
git add PKGBUILD .SRCINFO
git diff --cached --quiet && { echo "Already up to date."; exit 0; }
git -c user.name="nukeop" -c user.email="noreply@auroraplayer.com" \
    commit -m "Update to ${VERSION}"
git push origin master
