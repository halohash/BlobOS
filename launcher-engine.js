
(() => {
    "use strict";

    const STORAGE_KEY = "blobos_default_launcher";

    const launchers = new Map();

    let activeLauncher = null;
    let activeLauncherId = null;
    let initialized = false;
    let switching = false;

    const events = new EventTarget();

    function emit(name, detail = {}) {
        events.dispatchEvent(
            new CustomEvent(name, { detail })
        );
    }

    function getLauncher(id) {
        return launchers.get(id) || null;
    }

    function getActiveLauncher() {
        return activeLauncher;
    }

    function getActiveLauncherId() {
        return activeLauncherId;
    }

    function getLaunchers() {
        return Array.from(launchers.values()).map(launcher => ({
            id: launcher.id,
            name: launcher.name,
            version: launcher.version || "1.0.0",
            description: launcher.description || "",
            active: launcher.id === activeLauncherId
        }));
    }

    function register(launcher) {
        if (!launcher || typeof launcher !== "object") {
            throw new TypeError("A launcher object is required.");
        }

        if (!launcher.id || typeof launcher.id !== "string") {
            throw new Error("Launcher ID is required.");
        }

        if (launchers.has(launcher.id)) {
            throw new Error(
                "Launcher already registered: " + launcher.id
            );
        }

        const entry = {
            id: launcher.id,
            name: launcher.name || launcher.id,
            version: launcher.version || "1.0.0",
            description: launcher.description || "",
            init: launcher.init || (() => {}),
            onShow: launcher.onShow || (() => {}),
            onHide: launcher.onHide || (() => {}),
            destroy: launcher.destroy || (() => {}),
            element: launcher.element || null,
            ...launcher
        };

        launchers.set(entry.id, entry);

        emit("launcherregistered", {
            launcher: entry
        });

        return entry;
    }

    function unregister(id) {
        if (id === activeLauncherId) {
            throw new Error(
                "Cannot unregister the active launcher."
            );
        }

        const launcher = launchers.get(id);

        if (!launcher) return false;

        if (typeof launcher.destroy === "function") {
            launcher.destroy();
        }

        launchers.delete(id);

        emit("launcherunregistered", {
            launcherId: id
        });

        return true;
    }

    async function activate(id, options = {}) {
        if (switching) return false;

        const next = getLauncher(id);

        if (!next) {
            console.error(
                "[BlobOS Launcher] Launcher not found:",
                id
            );
            return false;
        }

        if (activeLauncherId === id) {
            if (typeof next.onShow === "function") {
                await next.onShow();
            }
            return true;
        }

        switching = true;

        const previous = activeLauncher;

        try {
            if (previous) {
                await previous.onHide();
            }

            if (previous && previous.element) {
                previous.element.hidden = true;
                previous.element.classList.remove(
                    "launcher-active"
                );
            }

            if (typeof next.init === "function") {
                await next.init({
                    previousLauncher: previous,
                    options
                });
            }

            if (next.element) {
                next.element.hidden = false;
                next.element.classList.add(
                    "launcher-active"
                );
            }

            activeLauncher = next;
            activeLauncherId = next.id;

            await next.onShow({
                previousLauncher: previous,
                options
            });

            if (options.save !== false) {
                localStorage.setItem(
                    STORAGE_KEY,
                    next.id
                );
            }

            document.documentElement.dataset.launcher =
                next.id;

            emit("launcherswitched", {
                launcher: next,
                previousLauncher: previous
            });

            return true;
        } catch (error) {
            console.error(
                "[BlobOS Launcher] Failed to activate launcher:",
                error
            );

            if (next.element) {
                next.element.hidden = true;
                next.element.classList.remove(
                    "launcher-active"
                );
            }

            if (previous) {
                try {
                    if (previous.element) {
                        previous.element.hidden = false;
                        previous.element.classList.add(
                            "launcher-active"
                        );
                    }

                    await previous.onShow();
                } catch (restoreError) {
                    console.error(
                        "[BlobOS Launcher] Failed to restore previous launcher:",
                        restoreError
                    );
                }
            }

            return false;
        } finally {
            switching = false;
        }
    }

    async function start(options = {}) {
        if (initialized) return true;

        initialized = true;

        const configured =
            options.defaultLauncher ||
            localStorage.getItem(STORAGE_KEY);

        const preferred =
            getLauncher(configured) ||
            getLauncher("egohome") ||
            launchers.values().next().value;

        if (!preferred) {
            initialized = false;
            console.error(
                "[BlobOS Launcher] No launchers registered."
            );
            return false;
        }

        const success = await activate(preferred.id, {
            save: false,
            boot: true
        });

        if (!success) {
            const fallback = getLauncher("egohome");

            if (fallback && fallback.id !== preferred.id) {
                return activate(fallback.id, {
                    save: false,
                    fallback: true
                });
            }

            initialized = false;
        }

        return success;
    }

    function on(name, callback) {
        events.addEventListener(name, event => {
            callback(event.detail);
        });
    }

    function getDefaultLauncher() {
        return localStorage.getItem(STORAGE_KEY);
    }

    function setDefaultLauncher(id) {
        if (!getLauncher(id)) {
            throw new Error(
                "Cannot set an unregistered launcher as default."
            );
        }

        localStorage.setItem(STORAGE_KEY, id);
        return true;
    }
function setNavbarIcons(icons = {}) {
    const buttons = {
        back: document.getElementById("backButton"),
        home: document.getElementById("homeButton"),
        recent: document.getElementById("recentButton")
    };

    Object.entries(buttons).forEach(([name, button]) => {
        if (!button) return;

        const icon = icons[name];

        if (icon) {
            button.style.backgroundImage = `url("${icon}")`;
            button.style.backgroundPosition = "center";
            button.style.backgroundSize = "100% 100%";
            button.style.backgroundRepeat = "no-repeat";
        } else {
            button.style.removeProperty("background-image");
            button.style.removeProperty("background-position");
            button.style.removeProperty("background-size");
            button.style.removeProperty("background-repeat");
        }
    });
}
    function createElement(id, options = {}) {
        const element = document.createElement(
            options.tag || "div"
        );

        element.id = id;
        element.className = options.className || "launcher";

        if (options.hidden !== false) {
            element.hidden = true;
        }

        if (options.parent) {
            options.parent.appendChild(element);
        }

        return element;
    }

    window.BlobOSLauncher = {
        register,
        unregister,
        activate,
        start,
        on,
        getLauncher,
        getLaunchers,
        getActiveLauncher,
        getActiveLauncherId,
        setNavbarIcons,
        getDefaultLauncher,
        setDefaultLauncher,
        createElement
    };

})();
