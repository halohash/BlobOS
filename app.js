(() => {
    "use strict";
window.errorMessage = function(){holoDialog({
  title: 'Oops!',
  message: 'Oops! That didn\'t work. Give it another shot in a moment.',
  positiveText: 'OK'
});}

    

    const $ = id => document.getElementById(id);

    const desktop = $("desktop");
    const tray = $("appTray");
    const appWindow = $("appWindow");
    const appContent = $("appContent");
    const appGrid = $("appGrid");
    const homeShortcuts = $("homeShortcuts");
    const recentPanel = $("recentPanel");
    const loadedServices = new Set();

    let apps = {};
    let wallpapers = [];
    let currentApp = null;
    let recentApps = [];
    let toastTimer;
    let appLaunchToken = 0;
    let appClosePromise = null;

    const builtins = {
        "com.blobos.settings": {
            name: "Settings",
            icon: "/icons/dial.png",
            builtin: "settings"
        },
        "com.blobos.gallery": {
            name: "Gallery",
            icon: "/icons/gallery.png",
            builtin: "gallery"
        },
        "com.blobos.browser": {
        "icon": "/icons/browser.png",
        "name": "Browser",
        "iframe": "/browser"
        }
    };

    function safeText(value) {
        return String(value == null ? "" : value);
    }

    function showToast(message) {
        const el = $("toast");
        if (!el) return;

        el.textContent = message;
        el.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            el.classList.remove("show");
        }, 2200);
    }

    window.toast = showToast;

    function closeTray() {
        tray.classList.remove("open");
        tray.setAttribute("aria-hidden", "true");
    }

    function openTray() {
        recentPanel.classList.remove("open");

        tray.classList.add("open");
        tray.setAttribute("aria-hidden", "false");

        $("appSearch").value = "";
        renderApps();
    }



function animationsEnabled() {
    return (
        localStorage.getItem("blobos_animations") !== "false" &&
        !document.documentElement.classList.contains("no-animations") &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

function closeApp() {
    if (appClosePromise) {
        return appClosePromise;
    }

    if (!appWindow.classList.contains("open")) {
        appWindow.setAttribute("aria-hidden", "true");
        appContent.replaceChildren();
        currentApp = null;
        return Promise.resolve();
    }

    if (!animationsEnabled() || !appWindow.animate) {
        appWindow.classList.remove("open");
        appWindow.setAttribute("aria-hidden", "true");
        appContent.replaceChildren();
        currentApp = null;
        return Promise.resolve();
    }

    appClosePromise = new Promise(resolve => {
        const animation = appWindow.animate(
            [
                {
                    opacity: 1,
                    transform: "scale(1)"
                },
                {
                    opacity: 0,
                    transform: "scale(0.9)"
                }
            ],
            {
                duration: 250,
                easing: "cubic-bezier(0.755, 0.05, 0.855, 0.06)",
                fill: "forwards"
            }
        );

        animation.onfinish = () => {
            appWindow.classList.remove("open");
            appWindow.setAttribute("aria-hidden", "true");

            animation.cancel();

            appContent.replaceChildren();
            currentApp = null;

            appClosePromise = null;
            resolve();
        };

        animation.oncancel = () => {
            appClosePromise = null;
            resolve();
        };
    });

    return appClosePromise;
}



    function home() {
        closeApp();
        closeTray();
        recentPanel.classList.remove("open");
    }

    function addRecent(id) {
        if (!apps[id] || apps[id].script) return;
        recentApps = [
            id,
            ...recentApps.filter(x => x !== id)
        ].slice(0, 8);

        renderRecent();
    }

    function renderRecent() {
        const list = $("recentList");
        list.replaceChildren();

        if (!recentApps.length) {
            const empty = document.createElement("div");
            empty.className = "recent-item";
            empty.textContent = "No recent apps";
            list.append(empty);
            return;
        }

        recentApps.forEach(id => {
            const app = apps[id];
            if (!app) return;

            const item = document.createElement("div");
            item.className = "recent-item";
            item.textContent = app.name || id;

            item.addEventListener("click", () => launchApp(id));

            list.append(item);
        });
    }

    function appIcon(app) {
        if (app.icon) {
            const img = document.createElement("img");

            img.src = app.icon;
            img.alt = "";

            img.onerror = () => {
                img.replaceWith(makeMaterialIcon("apps"));
            };

            return img;
        }

        return makeMaterialIcon(
            app.builtin === "settings"
                ? "settings"
                : app.builtin === "gallery"
                    ? "photo_library"
                    : "apps"
        );
    }

    function makeMaterialIcon(name) {
        const span = document.createElement("span");
        span.className = "material-icons";
        span.textContent = name;
        return span;
    }

    function renderApps(filter = "") {
        appGrid.replaceChildren();

        const query = filter.toLowerCase();

        Object.entries(apps).forEach(([id, app]) => {
          if (app.script) return;
            if (
                query &&
                !(
                    safeText(app.name || id).toLowerCase().includes(query) ||
                    id.toLowerCase().includes(query)
                )
            ) {
                return;
            }

            const tile = document.createElement("button");
            tile.className = "app-tile";
            tile.type = "button";

            tile.append(appIcon(app));

            const label = document.createElement("span");
            label.textContent = app.name || id;

            tile.append(label);

            tile.addEventListener("click", () => launchApp(id));

            appGrid.append(tile);
        });

        if (!appGrid.children.length) {
            const empty = document.createElement("div");

            empty.style.cssText =
                "grid-column:1/-1;text-align:center;color:#9eb0bc;padding:30px";

            empty.textContent = "No apps found";

            appGrid.append(empty);
        }
    }

    function renderShortcuts() {
        homeShortcuts.replaceChildren();

        [
            "com.blobos.settings",
            "com.blobos.gallery"
        ].forEach(id => {
            const app = apps[id];
            if (!app || app.script) return;

            const button = document.createElement("button");
            button.className = "shortcut";
            button.type = "button";

            button.append(appIcon(app));

            const label = document.createElement("span");
            label.textContent = app.name;

            button.append(label);

            button.addEventListener("click", () => launchApp(id));

            homeShortcuts.append(button);
        });
    }

    async function loadJSON(path, fallback) {
        try {
            const response = await fetch(path, {
                cache: "no-store"
            });

            if (!response.ok) throw new Error("Failed to load " + path);

            return await response.json();
        } catch (e) {
            console.warn("BlobOS: Could not load " + path, e);
            return fallback;
        }
    }

function getRepositories() {
    try {
        const repos = JSON.parse(
            localStorage.getItem("blobos_repositories") || "[]"
        );
        return Array.isArray(repos) ? repos : [];
    } catch (e) {
        return [];
    }
}

function loadServices() {
    Object.entries(apps).forEach(([id, service]) => {
        if (!service.script) return;
        if (loadedServices.has(id)) return;

        const script = document.createElement("script");

        script.src = service.script;
        script.dataset.service = id;
        script.async = true;

        script.onload = () => {
            loadedServices.add(id);
            console.log("BlobOS: Service started:", id);
        };

        script.onerror = () => {
            console.error(
                "BlobOS: Failed to load service:",
                id,
                service.script
            );
        };

        document.head.appendChild(script);
    });
}
async function loadRepositoryApps() {
    const repositories = getRepositories();

    for (const url of repositories) {
        try {
            const response = await fetch(url, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const repositoryApps = await response.json();

            if (
                !repositoryApps ||
                typeof repositoryApps !== "object" ||
                Array.isArray(repositoryApps)
            ) {
                throw new Error("Invalid apps.json format");
            }

            Object.entries(repositoryApps).forEach(([id, app]) => {
                
                if (!apps[id] && app && typeof app === "object") {
                    apps[id] = app;
                }
            });

            console.log("BlobOS: Loaded repository", url);
        } catch (error) {
            console.warn(
                "BlobOS: Repository failed to load:",
                url,
                error
            );
        }
    }
}

async function refreshAppRepositories() {
    const localApps = await loadJSON("./apps.json", {});

    apps = { ...localApps };

    await loadRepositoryApps();

    apps = {
        ...apps,
        ...builtins
    };

    renderApps();
    renderShortcuts();
    renderRecent();
    loadServices();
}

async function launchApp(id) {
    const app = apps[id];
    if (!app) return;

    const launchToken = ++appLaunchToken;

    if (
        appWindow.classList.contains("open") ||
        appClosePromise
    ) {
        await closeApp();
    }

    if (launchToken !== appLaunchToken) return;

    closeTray();
    recentPanel.classList.remove("open");

    currentApp = id;
    addRecent(id);

    $("appTitle").textContent = app.name || id;

    appContent.replaceChildren();

    appWindow.classList.add("open");
    appWindow.setAttribute("aria-hidden", "false");

    if (app.builtin === "settings") {
        renderSettings();
        return;
    }

    if (app.builtin === "gallery") {
        renderGallery();
        return;
    }

    if (app.html != null) {
        const wrapper = document.createElement("div");

        wrapper.className = "app-html";
        wrapper.innerHTML = String(app.html);

        appContent.append(wrapper);
        return;
    }

    if (app.htmlurl) {
        const frame = document.createElement("iframe");

        frame.src = app.htmlurl;
        frame.title = app.name || id;

        frame.setAttribute(
            "allow",
            "fullscreen; autoplay; clipboard-read; clipboard-write"
        );

        appContent.append(frame);
        return;
    }

    if (app.iframe) {
        const frame = document.createElement("iframe");

        frame.src = app.iframe;
        frame.title = app.name || id;

        frame.setAttribute("allow", "fullscreen; autoplay");

        appContent.append(frame);
        return;
    }

    appContent.textContent = "This app does not have an HTML source.";
}

    function settingState() {
        return {
            wallpaper:
                localStorage.getItem("blobos_wallpaper") ||
                wallpapers[0] ||
                "",

            animations:
                localStorage.getItem("blobos_animations") !== "false",

            clock24:
                localStorage.getItem("blobos_clock24") === "true"
        };
    }

    function settingsNav(active) {
        const nav = document.createElement("div");
        nav.className = "settings-sidebar";

        const brand = document.createElement("div");
        brand.className = "settings-brand";
        brand.textContent = "Settings";

        nav.append(brand);

        const menu = document.createElement("div");
        menu.className = "settings-nav";

        [
    ["network", "wifi", "Wireless & networks"],
    ["display", "display_settings", "Display"],
    ["wallpaper", "wallpaper", "Wallpaper"],
    ["repositories", "cloud_download", "App repositories"],
    ["system", "info", "System"]
].forEach(([key, icon, label]) => {
            const button = document.createElement("button");

            button.className = key === active ? "active" : "";

            button.append(makeMaterialIcon(icon));

            const text = document.createElement("span");
            text.textContent = label;

            button.append(text);

            button.addEventListener("click", () => {
                renderSettings(key);
            });

            menu.append(button);
        });

        nav.append(menu);

        return nav;
    }

    function settingRow(title, description, control) {
        const row = document.createElement("div");
        row.className = "setting-row";

        const copy = document.createElement("div");

        const strong = document.createElement("strong");
        strong.textContent = title;

        copy.append(strong);

        if (description) {
            const small = document.createElement("small");
            small.textContent = description;
            copy.append(small);
        }

        row.append(copy);
        row.append(control);

        return row;
    }

    function makeToggle(key, initial, callback) {
        const input = document.createElement("input");

        input.type = "checkbox";
        input.checked = initial;

        input.addEventListener("change", () => {
            localStorage.setItem(key, String(input.checked));

            if (callback) callback(input.checked);
        });

        return input;
    }

    function makeButton(label, callback) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", callback);

        return button;
    }

    function renderSettings(section = "display") {
        const shell = document.createElement("div");
        shell.className = "settings-app";

        shell.append(settingsNav(section));

        const main = document.createElement("div");
        main.className = "settings-main";

        const heading = document.createElement("div");
        heading.className = "settings-heading";

        heading.textContent = ({
    network: "Wireless & networks",
    display: "Display",
    wallpaper: "Wallpaper",
    repositories: "App repositories",
    system: "System"
})[section] || "Settings";

        main.append(heading);

        const content = document.createElement("div");
        content.className = "settings-section";

        const state = settingState();

        
        if (section === "display") {
            const title = document.createElement("h3");
            title.textContent = "Display settings";

            content.append(title);

            content.append(
                settingRow(
                    "Show animations",
                    "Enable interface transitions",
                    makeToggle(
                        "blobos_animations",
                        state.animations,
                        enabled => {
                            document.documentElement.classList.toggle(
                                "no-animations",
                                !enabled
                            );
                        }
                    )
                )
            );

            const clock = document.createElement("select");

            clock.innerHTML =
                '<option value="false">12-hour</option>' +
                '<option value="true">24-hour</option>';

            clock.value = String(state.clock24);

            clock.addEventListener("change", () => {
                localStorage.setItem("blobos_clock24", clock.value);
                updateClock();
            });

            content.append(
                settingRow(
                    "Time format",
                    "Choose how the clock is displayed",
                    clock
                )
            );

            const theme = document.createElement("div");
            theme.className = "settings-about";
            theme.style.marginTop = "20px";

            theme.textContent =
                "BlobOS uses a blue Android 3.0-inspired interface with Holo Dark styling in Settings.";

            content.append(theme);
        }

        
        else if (section === "wallpaper") {
            const title = document.createElement("h3");
            title.textContent = "Home screen wallpaper";

            content.append(title);

            const desc = document.createElement("div");
            desc.className = "settings-about";
            desc.textContent =
                "Choose a static or animated wallpaper.";

            content.append(desc);

            
            const staticTitle = document.createElement("h3");
            staticTitle.textContent = "Static wallpapers";

            content.append(staticTitle);

            const options = document.createElement("div");
            options.className = "wallpaper-options";

            wallpapers.forEach(path => {
                const button = document.createElement("button");

                button.className =
                    "wallpaper-choice" +
                    (path === state.wallpaper ? " selected" : "");

                button.title = path;

                const img = document.createElement("img");
                img.src = path;
                img.alt = path;

                button.append(img);

                button.addEventListener("click", () => {
                    localStorage.setItem("blobos_wallpaper", path);

                    applyWallpaper(path);

                    if (window.blobosClearLiveWallpaper) {
                        window.blobosClearLiveWallpaper();
                    }

                    renderSettings("wallpaper");
                    showToast("Wallpaper updated");
                });

                options.append(button);
            });

            content.append(options);

            
            const liveTitle = document.createElement("h3");
            liveTitle.textContent = "Live wallpapers";
            liveTitle.style.marginTop = "28px";

            content.append(liveTitle);

            const liveDescription = document.createElement("div");
            liveDescription.className = "settings-about";
            liveDescription.textContent =
                "Animated wallpapers for your home screen.";

            content.append(liveDescription);

            const liveWallpapers = window.blobosGetLiveWallpapers
                ? window.blobosGetLiveWallpapers()
                : [];

            if (liveWallpapers.length) {
                liveWallpapers.forEach(wallpaper => {
                    const button = document.createElement("button");

                    button.type = "button";
                    button.className = "setting-row";

                    button.style.cssText =
                        "width:100%;text-align:left;color:inherit;cursor:pointer;background:transparent;border:0;border-bottom:1px solid #263746;padding:16px;";

                    const name = document.createElement("strong");
                    name.textContent = wallpaper.name || wallpaper.id;

                    const description = document.createElement("small");
                    description.textContent =
                        "Live wallpaper · " + wallpaper.type;

                    const info = document.createElement("div");
                    info.append(name, description);

                    button.append(info);

                    button.addEventListener("click", () => {
                        if (window.blobosSetLiveWallpaper) {
                            window.blobosSetLiveWallpaper(wallpaper.id);
                            showToast("Live wallpaper applied");
                        } else {
                            showToast("Live wallpapers are not ready yet");
                        }
                    });

                    content.append(button);
                });
            } else {
                const empty = document.createElement("div");

                empty.className = "settings-about";
                empty.textContent =
                    "No live wallpapers found. Check livewallpapers.json.";

                content.append(empty);
            }

            const clearLive = makeButton(
                "Use static wallpaper",
                () => {
                    if (window.blobosClearLiveWallpaper) {
                        window.blobosClearLiveWallpaper();
                    }

                    showToast("Static wallpaper enabled");
                }
            );

            clearLive.style.marginTop = "16px";
            content.append(clearLive);
        }

        
        else if (section === "network") {
            const title = document.createElement("h3");
            title.textContent = "Network";

            content.append(title);

            content.append(
                settingRow(
                    "Wi-Fi",
                    "Connected to the local network",
                    makeToggle(
                        "blobos_wifi",
                        localStorage.getItem("blobos_wifi") !== "false"
                    )
                )
            );

            content.append(
                settingRow(
                    "Airplane mode",
                    "Turn off wireless connections",
                    makeToggle(
                        "blobos_airplane",
                        localStorage.getItem("blobos_airplane") === "true"
                    )
                )
            );
        }

        
        else if (section === "repositories") {
            const title = document.createElement("h3");
            title.textContent = "App repositories";
            content.append(title);

            const description = document.createElement("div");
            description.className = "settings-about";
            description.textContent =
                "Add repositories containing apps.json files. Apps from these repositories will appear in the app drawer. Beware of apps that are harmful.";
            content.append(description);

            const input = document.createElement("input");
            input.type = "url";
            input.placeholder = "https://example.com/apps.json";
            input.style.cssText =
                "width:100%;padding:12px;margin:16px 0;background:#17232d;color:#fff;border:1px solid #405566;";

            const addButton = makeButton("Add repository", async () => {
                const url = input.value.trim();

                if (!url) {
                    showToast("Enter a repository URL");
                    return;
                }

                try {
                    const parsed = new URL(url);

                    if (
                        parsed.protocol !== "https:" &&
                        parsed.protocol !== "http:"
                    ) {
                        throw new Error("Invalid protocol");
                    }

                    const response = await fetch(url, {
                        cache: "no-store"
                    });

                    if (!response.ok) {
                        throw new Error("HTTP " + response.status);
                    }

                    const data = await response.json();

                    if (
                        !data ||
                        typeof data !== "object" ||
                        Array.isArray(data)
                    ) {
                        throw new Error("Invalid repository format");
                    }

                    const repositories = getRepositories();

                    if (repositories.includes(url)) {
                        showToast("Repository already added");
                        return;
                    }

                    repositories.push(url);

                    localStorage.setItem(
                        "blobos_repositories",
                        JSON.stringify(repositories)
                    );

                    await refreshAppRepositories();

                    showToast("Repository added");
                    renderSettings("repositories");
                } catch (error) {
                    console.error(error);
                    showToast("Could not add repository");
                }
            });

            content.append(input, addButton);

            const listTitle = document.createElement("h3");
            listTitle.textContent = "Installed repositories";
            listTitle.style.marginTop = "28px";
            content.append(listTitle);

            const repositories = getRepositories();

            if (!repositories.length) {
                const empty = document.createElement("div");
                empty.className = "settings-about";
                empty.textContent = "No repositories added.";
                content.append(empty);
            }

            repositories.forEach((url, index) => {
                const row = document.createElement("div");
                row.className = "setting-row";
                row.style.cssText =
                    "display:flex;align-items:center;gap:12px;";

                const label = document.createElement("div");
                label.style.cssText =
                    "flex:1;min-width:0;overflow-wrap:anywhere;";
                label.textContent = url;

                const remove = makeButton("Remove", async () => {
                    const updated = getRepositories();
                    updated.splice(index, 1);

                    localStorage.setItem(
                        "blobos_repositories",
                        JSON.stringify(updated)
                    );

                    await refreshAppRepositories();

                    showToast("Repository removed");
                    renderSettings("repositories");
                });

                row.append(label, remove);
                content.append(row);
            });

            const refreshButton = makeButton(
                "Refresh repositories",
                async () => {
                    await refreshAppRepositories();
                    showToast("Repositories refreshed");
                    renderSettings("repositories");
                }
            );

            refreshButton.style.marginTop = "20px";
            content.append(refreshButton);
        }

        
        else {
            const title = document.createElement("h3");
            title.textContent = "About BlobOS";

            content.append(title);

            const about = document.createElement("div");
            about.className = "settings-about";

            about.innerHTML =
                "BlobOS<br>" +
                "HTML5 desktop environment<br>" +
                "Open Source on github.com/halohash/BlobOS<br><br>" +
                "Apps, icons and wallpapers are owned by their original creators. Roboto and Material Icons are owned by Google.";

            content.append(about);

            
            const saverTitle = document.createElement("h3");
            saverTitle.textContent = "Screensavers";
            saverTitle.style.marginTop = "28px";

            content.append(saverTitle);

            const saverDescription = document.createElement("div");
            saverDescription.className = "settings-about";
            saverDescription.textContent =
                "Choose and preview a screensaver.";

            content.append(saverDescription);

            
const screensavers = window.blobosGetScreensavers
    ? window.blobosGetScreensavers()
    : [];

const selectedSaver = localStorage.getItem("blobos_screensaver_id") || "";

if (screensavers.length) {
    screensavers.forEach(saver => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "setting-row";
        button.style.cssText =
            "width:100%;text-align:left;color:inherit;cursor:pointer;background:transparent;border:0;border-bottom:1px solid #263746;padding:16px;";

        const name = document.createElement("strong");
        name.textContent =
            (saver.name || saver.id) +
            (saver.id === selectedSaver ? " ✓" : "");

        const description = document.createElement("small");
        description.textContent = "Screensaver · " + saver.type;

        const info = document.createElement("div");
        info.append(name, description);
        button.append(info);

        button.addEventListener("click", () => {
            if (window.blobosStartDaydream) {
                window.blobosStartDaydream(saver.id);
            } else {
                showToast("Screensavers are not ready yet");
            }
        });

        content.append(button);
    });
} else {
    const empty = document.createElement("div");
    empty.className = "settings-about";
    empty.textContent =
        "No screensavers found. Check screensavers.json.";
    content.append(empty);
}

const previewButton = makeButton(
    "Preview selected screensaver",
    () => {
        if (window.blobosStartDaydream) {
            window.blobosStartDaydream();
        } else {
            showToast("Screensavers are not ready yet");
        }
    }
);

previewButton.style.cssText =
    "margin-top:18px;padding:12px 20px;background:#33b5e5;color:#fff;border:0;cursor:pointer;";

content.append(previewButton);
const factoryBtn = makeButton(
    "Factory Reset",
    () => {
        if (window.factoryReset) {
            window.factoryReset();
        } else {
errorMessage();
        }
    }
);
content.append(factoryBtn);
            
            const timeoutTitle = document.createElement("h3");
            timeoutTitle.textContent = "Screensaver timeout";
            timeoutTitle.style.marginTop = "28px";

            content.append(timeoutTitle);

            const timeoutSelect = document.createElement("select");

            [
                ["30000", "30 seconds"],
                ["60000", "1 minute"],
                ["120000", "2 minutes"],
                ["300000", "5 minutes"],
                ["600000", "10 minutes"],
                ["900000", "15 minutes"],
                ["0", "Never"]
            ].forEach(([value, label]) => {
                const option = document.createElement("option");

                option.value = value;
                option.textContent = label;

                timeoutSelect.append(option);
            });

            const savedTimeout =
                localStorage.getItem("blobos_screensaver_delay") || "120000";

            timeoutSelect.value = savedTimeout;

            timeoutSelect.addEventListener("change", () => {
                const value = Number(timeoutSelect.value);

                if (window.blobosSetScreensaverDelay) {
                    window.blobosSetScreensaverDelay(value);
                } else {
                    localStorage.setItem(
                        "blobos_screensaver_delay",
                        String(value)
                    );
                }

                showToast(
                    value === 0
                        ? "Screensaver disabled"
                        : "Screensaver timeout updated"
                );
            });

            content.append(
                settingRow(
                    "Start after",
                    "Choose how long BlobOS waits before starting a screensaver.",
                    timeoutSelect
                )
            );

            const enabledToggle = makeToggle(
                "blobos_screensaver_enabled",
                localStorage.getItem("blobos_screensaver_enabled") !== "false",
                enabled => {
                    if (window.blobosSetScreensaverEnabled) {
                        window.blobosSetScreensaverEnabled(enabled);
                    }
                }
            );

            content.append(
                settingRow(
                    "Automatic screensavers",
                    "Start a screensaver when BlobOS is idle.",
                    enabledToggle
                )
            );
        }

        main.append(content);
        shell.append(main);

        appContent.replaceChildren(shell);
    }

    function applyWallpaper(path) {
        if (path) {
            desktop.style.backgroundImage =
                `url("${path.replace(/["\\]/g, "")}")`;
        }
    }

    function renderGallery() {
        const wrap = document.createElement("div");

        wrap.style.cssText = "padding:22px;color:#26343e";

        const heading = document.createElement("h2");

        heading.style.cssText =
            "font-weight:300;margin:0 0 8px";

        heading.textContent = "Wallpaper";

        wrap.append(heading);

        const description = document.createElement("p");

        description.style.cssText =
            "color:#687985;font-size:13px";

        description.textContent =
            "Select an image to set it as your home screen wallpaper.";

        wrap.append(description);

        const grid = document.createElement("div");

        grid.style.cssText =
            "display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px";

        wallpapers.forEach(path => {
            const button = document.createElement("button");

            button.style.cssText =
                "padding:0;border:3px solid " +
                (path === settingState().wallpaper
                    ? "#33b5e5"
                    : "#c5d0d7") +
                ";background:#fff;cursor:pointer;height:110px;overflow:hidden";

            const img = document.createElement("img");

            img.src = path;
            img.alt = path;

            img.style.cssText =
                "width:100%;height:100%;object-fit:cover";

            button.append(img);

            button.addEventListener("click", () => {
                localStorage.setItem("blobos_wallpaper", path);

                applyWallpaper(path);

                if (window.blobosClearLiveWallpaper) {
                    window.blobosClearLiveWallpaper();
                }

                renderGallery();
                showToast("Wallpaper updated");
            });

            grid.append(button);
        });

        wrap.append(grid);
        appContent.replaceChildren(wrap);
    }

    function updateClock() {
        const now = new Date();

        const use24 =
            localStorage.getItem("blobos_clock24") === "true";

        const time = now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: !use24
        });

        $("clock").textContent = time;
        $("welcomeTime").textContent = time;

        $("date").textContent = now.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric"
        });

        $("welcomeDate").textContent = now.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric"
        });
    }

    
    $("trayButton").addEventListener("click", openTray);

    document.querySelectorAll("[data-close-tray]").forEach(el => {
        el.addEventListener("click", closeTray);
    });

    $("appSearch").addEventListener("input", e => {
        renderApps(e.target.value);
    });

    $("appBack").addEventListener("click", home);

    $("backButton").addEventListener("click", () => {
        if (tray.classList.contains("open")) {
            closeTray();
        } else if (appWindow.classList.contains("open")) {
            home();
        } else {
            recentPanel.classList.remove("open");
        }
    });

    $("homeButton").addEventListener("click", home);

    $("recentButton").addEventListener("click", () => {
        closeTray();

        recentPanel.classList.toggle("open");

        renderRecent();
    });

    $("appMenu").addEventListener("click", () => {
        showToast(
            currentApp
                ? "App: " + (apps[currentApp].name || currentApp)
                : "BlobOS"
        );
    });

    document.addEventListener("keydown", e => {
        if (
            e.key === "Escape" ||
            (e.key === "Backspace" && e.target.tagName !== "INPUT")
        ) {
            if (appWindow.classList.contains("open")) {
                home();
            } else {
                closeTray();
            }
        }
    });

    
    async function start() {
        const loaded = await loadJSON("./apps.json", {});
apps = { ...loaded };

await loadRepositoryApps();

apps = {
    ...apps,
    ...builtins
};

        wallpapers = await loadJSON(
            "./wallpapers.json",
            ["1.png", "2.png", "3.png"]
        );

        renderApps();
        renderShortcuts();
        renderRecent();
        loadServices();
        applyWallpaper(
            settingState().wallpaper || wallpapers[0]
        );

        
        document.documentElement.classList.toggle(
            "no-animations",
            localStorage.getItem("blobos_animations") === "false"
        );

        updateClock();

        setInterval(updateClock, 15000);

        setTimeout(() => {
            $("boot").classList.add("done");
        }, 2450);

        setTimeout(() => {
            $("boot").remove();
        }, 3000);
    }

    start();

})();
