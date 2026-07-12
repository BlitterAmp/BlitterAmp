fn should_force_shm(
    is_wayland: bool,
    is_nvidia: bool,
    has_override: bool,
    force_enable: bool,
) -> bool {
    is_wayland && is_nvidia && !has_override && !force_enable
}

#[cfg(target_os = "linux")]
pub fn configure_display_environment() {
    let is_wayland = std::env::var_os("WAYLAND_DISPLAY").is_some()
        && !std::env::var("GDK_BACKEND").is_ok_and(|backend| backend.eq_ignore_ascii_case("x11"));
    let is_nvidia = [
        "LIBVA_DRIVER_NAME",
        "GBM_BACKEND",
        "__GLX_VENDOR_LIBRARY_NAME",
    ]
    .iter()
    .filter_map(std::env::var_os)
    .any(|value| {
        value
            .to_string_lossy()
            .to_ascii_lowercase()
            .contains("nvidia")
    }) || std::path::Path::new("/proc/driver/nvidia/version").exists();
    let has_override = std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_some()
        || std::env::var_os("WEBKIT_DMABUF_RENDERER_FORCE_SHM").is_some();
    let force_enable = std::env::var("BLITTERAMP_FORCE_DMABUF_RENDERER")
        .is_ok_and(|value| value == "1" || value.eq_ignore_ascii_case("true"));

    if should_force_shm(is_wayland, is_nvidia, has_override, force_enable) {
        std::env::set_var("WEBKIT_DMABUF_RENDERER_FORCE_SHM", "1");
    }
}

#[cfg(not(target_os = "linux"))]
pub fn configure_display_environment() {}

#[cfg(test)]
mod tests {
    use super::should_force_shm;

    #[test]
    fn forces_shm_for_nvidia_wayland() {
        assert!(should_force_shm(true, true, false, false));
    }

    #[test]
    fn preserves_an_explicit_override() {
        assert!(!should_force_shm(true, true, true, false));
        assert!(!should_force_shm(true, true, false, true));
    }

    #[test]
    fn leaves_other_sessions_and_drivers_unchanged() {
        assert!(!should_force_shm(false, true, false, false));
        assert!(!should_force_shm(true, false, false, false));
    }
}
