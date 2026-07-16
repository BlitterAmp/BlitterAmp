#!/usr/bin/env bash
set -euo pipefail

tag="${1:?usage: name-release-assets.sh <tag>}"
repo="${GITHUB_REPOSITORY:-BlitterAmp/BlitterAmp}"
version="${tag#v}"
release_api="repos/$repo/releases/tags/$tag"
workdir="$(mktemp -d)"
manifest="$workdir/latest.json"
trap 'rm -rf "$workdir"' EXIT

gh release download "$tag" --repo "$repo" --pattern latest.json --dir "$workdir"

asset_id() {
  local name="$1"
  gh api "$release_api" | jq -r --arg name "$name" '.assets[] | select(.name == $name) | .id'
}

rename_asset() {
  local old_name="$1"
  local new_name="$2"
  local id
  id="$(asset_id "$old_name")"

  if [ -n "$id" ]; then
    gh api --method PATCH "repos/$repo/releases/assets/$id" -f name="$new_name" >/dev/null
  elif [ -z "$(asset_id "$new_name")" ]; then
    echo "Release asset not found: $old_name" >&2
    exit 1
  fi

  jq --arg old "$old_name" --arg new "$new_name" \
    'walk(if type == "string" then split($old) | join($new) else . end)' \
    "$manifest" >"$manifest.tmp"
  mv "$manifest.tmp" "$manifest"
}

rename_asset "BlitterAmp_${version}_amd64.AppImage" "BlitterAmp_${version}_linux_x86_64.AppImage"
rename_asset "BlitterAmp_${version}_amd64.AppImage.sig" "BlitterAmp_${version}_linux_x86_64.AppImage.sig"
rename_asset "BlitterAmp_${version}_amd64.deb" "BlitterAmp_${version}_linux_x86_64.deb"
rename_asset "BlitterAmp_${version}_amd64.deb.sig" "BlitterAmp_${version}_linux_x86_64.deb.sig"
rename_asset "BlitterAmp-${version}-1.x86_64.rpm" "BlitterAmp_${version}_linux_x86_64.rpm"
rename_asset "BlitterAmp-${version}-1.x86_64.rpm.sig" "BlitterAmp_${version}_linux_x86_64.rpm.sig"

rename_asset "BlitterAmp_${version}_aarch64.dmg" "BlitterAmp_${version}_macos_aarch64.dmg"
rename_asset "BlitterAmp_aarch64.app.tar.gz" "BlitterAmp_${version}_macos_aarch64.app.tar.gz"
rename_asset "BlitterAmp_aarch64.app.tar.gz.sig" "BlitterAmp_${version}_macos_aarch64.app.tar.gz.sig"

rename_asset "BlitterAmp_${version}_x64-setup.exe" "BlitterAmp_${version}_windows_x86_64-setup.exe"
rename_asset "BlitterAmp_${version}_x64-setup.exe.sig" "BlitterAmp_${version}_windows_x86_64-setup.exe.sig"
rename_asset "BlitterAmp_${version}_x64_en-US.msi" "BlitterAmp_${version}_windows_x86_64_en-US.msi"
rename_asset "BlitterAmp_${version}_x64_en-US.msi.sig" "BlitterAmp_${version}_windows_x86_64_en-US.msi.sig"

gh release upload "$tag" "$manifest" --repo "$repo" --clobber
