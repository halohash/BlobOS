
(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const getClass = name => document.getElementsByClassName(name);

    window.$ = $;
    window.getClass = getClass;

    window.errorMessage = function () {
        if (window.holoDialog) {
            window.holoDialog({
                title: "Oops!",
                message: "Oops! That didn't work. Give it another shot in a moment.",
                positiveText: "OK"
            });
        } else {
            alert("Oops! That didn't work. Give it another shot in a moment.");
        }
    };

    const desktop = $("desktop");
    const tray = $("appTray");
    const appWindow = $("appWindow");
    const appContent = $("appContent");
    const appGrid = $("appGrid");
    const homeScreen = $("homeScreen");
    const homeShortcuts = $("homeShortcuts");
    const recentPanel = $("recentPanel");

    const loadedServices = new Set();

    let apps = {};
    let wallpapers = [];
    let games = [];
    let currentApp = null;
    let recentApps = [];
    let toastTimer;
    let appLaunchToken = 0;
    let appClosePromise = null;
    let config = {};

    const DEFAULT_CONFIG = {
        defaultLauncher: "EGOHome",
        defaultWallpaper: "",
        navbarIcons: {
            back: "/icons/back.png",
            home: "/icons/home.png",
            recent: "/icons/recent.png"
        },
        hideNavbar: false,
        managementDomain: "",
        dataCarrier: "Gantile",
        disableEGOHome: false,
        kiosk: false,
        kioskApp: "",
        OEM: "BlobOS",
        searchEngine: "https://www.google.com/search?q={query}",
        gamesFile: "./games.json"
    };

    // --------------------------------------------------
    // LAUNCHER REGISTRATION
    // --------------------------------------------------

    if (!window.BlobOSLauncher) {
        console.error("BlobOS: launcher-engine.js is missing.");
    } else {
        BlobOSLauncher.register({
            id: "egohome",
            name: "EGOHome",
            version: "1.0.0",
            description: "The default BlobOS launcher",

            element: homeScreen,

            init() {
                homeScreen.classList.remove("home-hidden");
                homeScreen.hidden = false;

                renderEGOHome();
            },

            onShow() {
                homeScreen.classList.remove("home-hidden");
                homeScreen.hidden = false;
            },

            onHide() {
                homeScreen.classList.add("home-hidden");
                homeScreen.hidden = true;
            }
        });
    }

    // --------------------------------------------------
    // BUILT-IN APPS
    // --------------------------------------------------

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
            name: "Browser",
            icon: "/icons/browser.png",
            iframe: "/browser"
        },

        "com.blobos.games": {
            name: "Gantile Games",
            icon: "/icons/play-games-kitkat.png",
            builtin: "games",
            headerColor: "#00b300"
        },

        "com.blobos.music": {
            name: "Gantile Music",
            icon: "/icons/play-music-kitkat.png",
            builtin: "music",
            headerColor: "#ff7b00"
        },

        "com.blobos.gantile": {
            name: "Gantile",
            icon: "/icons/google-search-kitkat.png",
            builtin: "gantile",
            headerColor: "#4285f4"
        }
    };

    // --------------------------------------------------
    // UTILITIES
    // --------------------------------------------------

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

    function makeMaterialIcon(name) {
        const span = document.createElement("span");
        span.className = "material-icons";
        span.textContent = name;
        return span;
    }

    function makeButton(label, callback) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", callback);

        return button;
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

        return makeMaterialIcon("apps");
    }

    // --------------------------------------------------
    // JSON LOADING
    // --------------------------------------------------

    async function loadJSON(path, fallback) {
        try {
            const response = await fetch(path, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            return await response.json();

        } catch (error) {
            console.warn(
                "BlobOS: Could not load " + path,
                error
            );

            return fallback;
        }
    }

    // --------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------

    async function loadConfig() {
        const loaded = await loadJSON("./config.json", {});

        config = Object.assign(
            {},
            DEFAULT_CONFIG,
            loaded
        );

        config.navbarIcons = Object.assign(
            {},
            DEFAULT_CONFIG.navbarIcons,
            loaded.navbarIcons || {}
        );

        window.blobosConfig = config;

        document.documentElement.dataset.oem =
            config.OEM || "BlobOS";

        document.title = config.OEM || "BlobOS";

        document.documentElement.classList.toggle(
            "navbar-hidden",
            Boolean(config.hideNavbar)
        );

        document.documentElement.classList.toggle(
            "kiosk-mode",
            Boolean(config.kiosk)
        );

        document.documentElement.classList.toggle(
            "ego-home-disabled",
            Boolean(config.disableEGOHome)
        );

        if (config.managementDomain) {
            window.blobosManagementDomain =
                config.managementDomain;
        }

        window.blobosDataCarrier = config.dataCarrier;

        applyNavbarIcons();

        console.log(
            "BlobOS: Configuration loaded",
            config
        );
    }

    function applyNavbarIcons() {
        const icons = config.navbarIcons || {};

        if (
            window.BlobOSLauncher &&
            typeof BlobOSLauncher.setNavbarIcons === "function"
        ) {
            BlobOSLauncher.setNavbarIcons(icons);
            return;
        }

        const buttons = {
            back: $("backButton"),
            home: $("homeButton"),
            recent: $("recentButton")
        };

        Object.entries(buttons).forEach(([name, button]) => {
            if (!button) return;

            const path = icons[name];

            if (path) {
                button.style.backgroundImage =
                    'url("' + path.replace(/["\\]/g, "") + '")';

                button.style.backgroundPosition = "center";
                button.style.backgroundSize = "100% 100%";
                button.style.backgroundRepeat = "no-repeat";
            }
        });
    }

    // --------------------------------------------------
    // NAVIGATION
    // --------------------------------------------------

    function closeTray() {
        if (!tray) return;

        tray.classList.remove("open");
        tray.setAttribute("aria-hidden", "true");
    }

    function openTray() {
        if (config.kiosk || !tray) return;

        if (recentPanel) {
            recentPanel.classList.remove("open");
        }

        tray.classList.add("open");
        tray.setAttribute("aria-hidden", "false");

        if ($("appSearch")) {
            $("appSearch").value = "";
        }

        renderApps();
    }

    function animationsEnabled() {
        return (
            localStorage.getItem("blobos_animations") !== "false" &&
            !document.documentElement.classList.contains("no-animations") &&
            !window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        );
    }

    // --------------------------------------------------
    // APP CLOSING
    // --------------------------------------------------

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

        if (
            !animationsEnabled() ||
            !appWindow.animate
        ) {
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
        if (config.kiosk) return;

        closeApp();
        closeTray();

        if (recentPanel) {
            recentPanel.classList.remove("open");
        }
    }

    // --------------------------------------------------
    // RECENT APPS
    // --------------------------------------------------

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
        if (!list) return;

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

            item.addEventListener("click", () => {
                launchApp(id);
            });

            list.append(item);
        });
    }

    // --------------------------------------------------
    // EGOHOME SEARCH
    // --------------------------------------------------

    function performGantileSearch(query) {
        const template =
            config.searchEngine ||
            "https://www.google.com/search?q={query}";

        const url = template.replace(
            /\{query\}/g,
            encodeURIComponent(query)
        );

        window.open(url, "_blank", "noopener");
    }

    function createEGOSearch() {
        const search = document.createElement("form");

        search.className = "ego-search";

        search.style.cssText = [
            "position:absolute",
            "top:22px",
            "right:24px",
            "display:flex",
            "align-items:center",
            "height:42px",
            "width:min(340px,45vw)",
            "background:rgba(15,27,37,.82)",
            "border:1px solid rgba(160,190,210,.4)",
            "border-radius:3px",
            "overflow:hidden",
            "z-index:5"
        ].join(";");

        const input = document.createElement("input");

        input.type = "search";
        input.placeholder = "Search Gantile";
        input.autocomplete = "off";

        input.style.cssText =
            "flex:1;min-width:0;height:100%;padding:0 12px;background:transparent;color:white;border:0;outline:none;font:14px Roboto,Arial;";

        const mic = document.createElement("button");

        mic.type = "button";
        mic.title = "Voice search";

        mic.style.cssText =
            "width:42px;height:100%;border:0;background:transparent;display:grid;place-items:center;cursor:pointer;";

        const micImage = document.createElement("img");

        micImage.src = "/icons/mic.png";
        micImage.alt = "Microphone";
        micImage.style.cssText =
            "width:23px;height:23px;object-fit:contain;";

        mic.append(micImage);

        const submit = document.createElement("button");

        submit.type = "submit";
        submit.title = "Search";

        submit.style.cssText =
            "width:42px;height:100%;border:0;background:transparent;display:grid;place-items:center;cursor:pointer;";

        const searchImage = document.createElement("img");

        searchImage.src = "/icons/holo_search.png";
        searchImage.alt = "Search";
        searchImage.style.cssText =
            "width:24px;height:24px;object-fit:contain;";

        submit.append(searchImage);

        search.append(input, mic, submit);

        search.addEventListener("submit", event => {
            event.preventDefault();

            const query = input.value.trim();

            if (query) {
                performGantileSearch(query);
            }
        });

        mic.addEventListener("click", () => {
            if (
                !("webkitSpeechRecognition" in window) &&
                !("SpeechRecognition" in window)
            ) {
                showToast("Voice search is not supported");
                return;
            }

            const Recognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition;

            const recognition = new Recognition();

            recognition.lang = navigator.language || "en-US";

            recognition.onresult = event => {
                input.value =
                    event.results[0][0].transcript;

                search.requestSubmit();
            };

            recognition.onerror = () => {
                showToast("Voice search failed");
            };

            recognition.start();
        });

        return search;
    }

    // --------------------------------------------------
    // EGOHOME
    // --------------------------------------------------

    function renderEGOHome() {
        if (!homeShortcuts) return;

        homeShortcuts.replaceChildren();

        const existing = $("egoSearch");

        if (existing) {
            existing.remove();
        }

        if (config.disableEGOHome) return;

        const search = createEGOSearch();

        search.id = "egoSearch";

        if (homeScreen) {
            homeScreen.append(search);
        }

        [
            "com.blobos.settings",
            "com.blobos.gallery",
            "com.blobos.games",
            "com.blobos.music",
            "com.blobos.gantile"
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

            button.addEventListener("click", () => {
                launchApp(id);
            });

            homeShortcuts.append(button);
        });
    }

    function renderShortcuts() {
        renderEGOHome();
    }

    // --------------------------------------------------
    // APP DRAWER
    // --------------------------------------------------

    function renderApps(filter = "") {
        if (!appGrid) return;

        appGrid.replaceChildren();

        const query = filter.toLowerCase();

        Object.entries(apps).forEach(([id, app]) => {
            if (app.script) return;

            if (
                query &&
                !(
                    safeText(app.name || id)
                        .toLowerCase()
                        .includes(query) ||
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

            tile.addEventListener("click", () => {
                launchApp(id);
            });

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

    // --------------------------------------------------
    // APP REPOSITORIES
    // --------------------------------------------------

    function getRepositories() {
        try {
            const repos = JSON.parse(
                localStorage.getItem("blobos_repositories") || "[]"
            );

            return Array.isArray(repos) ? repos : [];

        } catch (error) {
            return [];
        }
    }

    function loadServices() {
        Object.entries(apps).forEach(([id, service]) => {
            if (!service.script || loadedServices.has(id)) return;

            const script = document.createElement("script");

            script.src = service.script;
            script.dataset.service = id;
            script.async = true;

            script.onload = () => {
                loadedServices.add(id);

                console.log(
                    "BlobOS: Service started:",
                    id
                );
            };

            script.onerror = () => {
                console.error(
                    "BlobOS: Failed to load service:",
                    id
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

                console.log(
                    "BlobOS: Loaded repository",
                    url
                );

            } catch (error) {
                console.warn(
                    "BlobOS: Repository failed:",
                    url,
                    error
                );
            }
        }
    }

    async function refreshAppRepositories() {
        const localApps = await loadJSON("./apps.json", {});

        apps = Object.assign({}, localApps);

        await loadRepositoryApps();

        apps = Object.assign({}, apps, builtins);

        renderApps();
        renderShortcuts();
        renderRecent();

        loadServices();
    }

    // --------------------------------------------------
    // APP LAUNCHER
    // --------------------------------------------------

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

        if (recentPanel) {
            recentPanel.classList.remove("open");
        }

        currentApp = id;

        addRecent(id);

        $("appTitle").textContent = app.name || id;

        appContent.replaceChildren();

        appWindow.classList.add("open");
        appWindow.setAttribute("aria-hidden", "false");

        if (animationsEnabled() && appWindow.animate) {
            appWindow.animate(
                [
                    {
                        opacity: 0,
                        transform: "scale(0.9)"
                    },
                    {
                        opacity: 1,
                        transform: "scale(1)"
                    }
                ],
                {
                    duration: 250,
                    easing: "cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                }
            );
        }

        if (app.builtin === "settings") {
            renderSettings();
            return;
        }

        if (app.builtin === "gallery") {
            renderGallery();
            return;
        }

        if (app.builtin === "games") {
            renderGames();
            return;
        }

        if (app.builtin === "music") {
            renderMusic();
            return;
        }

        if (app.builtin === "gantile") {
            renderGantile();
            return;
        }

        if (app.html != null) {
            const wrapper = document.createElement("div");

            wrapper.className = "app-html";
            wrapper.innerHTML = String(app.html);

            appContent.append(wrapper);
            return;
        }

        if (app.htmlurl || app.iframe) {
            const frame = document.createElement("iframe");

            frame.src = app.htmlurl || app.iframe;
            frame.title = app.name || id;

            frame.setAttribute(
                "allow",
                "fullscreen; autoplay; clipboard-read; clipboard-write"
            );

            appContent.append(frame);
            return;
        }

        appContent.textContent =
            "This app does not have an HTML source.";
    }

    // --------------------------------------------------
    // GANTILE HEADER
    // --------------------------------------------------

    function createServiceHeader(title, color) {
        const header = document.createElement("div");

        header.className = "gantile-header";

        header.style.cssText =
            "height:64px;min-height:64px;background:" +
            color +
            ";color:white;display:flex;align-items:center;padding:0 22px;font-size:21px;font-weight:400;box-sizing:border-box;";

        header.textContent = title;

        return header;
    }

    // --------------------------------------------------
    // GANTILE SEARCH
    // --------------------------------------------------

    function renderGantile() {
        const shell = document.createElement("div");

        shell.className = "gantile-app";

        shell.append(
            createServiceHeader("Gantile", "#4285f4")
        );

        const body = document.createElement("div");

        body.style.cssText =
            "padding:30px 20px;text-align:center;color:#26343e;";

        const logo = document.createElement("img");

        logo.src = "/icons/google-search-kitkat.png";
        logo.alt = "Gantile";

        logo.style.cssText =
            "width:90px;height:90px;object-fit:contain;margin:20px auto;";

        const heading = document.createElement("h2");

        heading.textContent = "Gantile";
        heading.style.fontWeight = "300";

        const form = document.createElement("form");

        form.style.cssText =
            "display:flex;max-width:600px;margin:25px auto;gap:8px;";

        const input = document.createElement("input");

        input.type = "search";
        input.placeholder = "Search the web";
        input.autocomplete = "off";

        input.style.cssText =
            "flex:1;min-width:0;padding:13px;border:1px solid #bdcbd3;font-size:16px;";

        const button = document.createElement("button");

        button.type = "submit";
        button.textContent = "Search";

        button.style.cssText =
            "background:#4285f4;color:white;border:0;padding:0 22px;cursor:pointer;";

        form.append(input, button);

        form.addEventListener("submit", event => {
            event.preventDefault();

            const query = input.value.trim();

            if (query) {
                performGantileSearch(query);
            }
        });

        body.append(logo, heading, form);
        shell.append(body);

        appContent.append(shell);
    }

    // --------------------------------------------------
    // GANTILE GAMES
    // --------------------------------------------------

    async function renderGames() {
        const shell = document.createElement("div");

        shell.className = "games-app";

        shell.append(
            createServiceHeader("Gantile Games", "#00b300")
        );

        const body = document.createElement("div");

        body.style.cssText =
            "padding:20px;color:#26343e;";

        const heading = document.createElement("h2");

        heading.textContent = "Games";
        heading.style.fontWeight = "300";

        const grid = document.createElement("div");

        grid.style.cssText =
            "display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:16px;";

        body.append(heading, grid);
        shell.append(body);

        appContent.append(shell);

        const loading = document.createElement("p");

        loading.textContent = "Loading games...";

        body.append(loading);

        const data = await loadJSON(
            config.gamesFile || "./games.json",
            []
        );

        if (!Array.isArray(data)) {
            loading.textContent = "Invalid games.json format.";
            return;
        }

        games = data;

        loading.remove();

        if (!games.length) {
            const empty = document.createElement("p");

            empty.textContent = "No games available.";

            body.append(empty);
            return;
        }

        games.forEach(game => {
            const card = document.createElement("button");

            card.type = "button";

            card.style.cssText =
                "border:1px solid #dce2e6;background:white;padding:0;cursor:pointer;text-align:left;color:#26343e;overflow:hidden;";

            const image = document.createElement("img");

            image.src =
                game.icon ||
                game.image ||
                "/icons/play-games-kitkat.png";

            image.alt = "";

            image.style.cssText =
                "width:100%;height:125px;object-fit:cover;background:#e9f0e9;";

            image.onerror = () => {
                image.src = "/icons/play-games-kitkat.png";
                image.onerror = null;
            };

            const name = document.createElement("div");

            name.textContent =
                game.name || game.title || "Untitled game";

            name.style.cssText =
                "padding:12px;font-size:15px;font-weight:500;";

            card.append(image, name);

            card.addEventListener("click", () => {
                openGame(game);
            });

            grid.append(card);
        });
    }

    function openGame(game) {
        if (!game.url && !game.htmlurl && !game.iframe) {
            showToast("This game has no playable URL");
            return;
        }

        const frame = document.createElement("iframe");

        frame.src = game.url || game.htmlurl || game.iframe;
        frame.title = game.name || game.title || "Game";
        frame.allow = "fullscreen; autoplay";

        frame.style.cssText =
            "position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;";

        const back = document.createElement("button");

        back.textContent = "← Games";

        back.style.cssText =
            "position:absolute;top:10px;left:10px;z-index:5;background:#00b300;color:white;border:0;padding:9px 15px;cursor:pointer;";

        back.addEventListener("click", renderGames);

        appContent.replaceChildren(frame, back);
    }

    // --------------------------------------------------
    // GANTILE MUSIC
    // --------------------------------------------------

    const MUSIC_DB = "BlobOSMusic";
    const MUSIC_STORE = "tracks";

    function openMusicDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB unavailable"));
                return;
            }

            const request = indexedDB.open(MUSIC_DB, 1);

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(MUSIC_STORE)) {
                    db.createObjectStore(MUSIC_STORE, {
                        keyPath: "id",
                        autoIncrement: true
                    });
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async function saveMusicFiles(files) {
        const db = await openMusicDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                MUSIC_STORE,
                "readwrite"
            );

            const store = transaction.objectStore(MUSIC_STORE);

            Array.from(files).forEach(file => {
                if (!file.type.startsWith("audio/")) return;

                store.add({
                    name: file.name,
                    type: file.type,
                    blob: file,
                    added: Date.now()
                });
            });

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    }

    async function getMusicFiles() {
        const db = await openMusicDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                MUSIC_STORE,
                "readonly"
            );

            const request = transaction
                .objectStore(MUSIC_STORE)
                .getAll();

            request.onsuccess = () => {
                const result = request.result || [];

                db.close();
                resolve(result);
            };

            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    }

    async function deleteMusicFile(id) {
        const db = await openMusicDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                MUSIC_STORE,
                "readwrite"
            );

            transaction.objectStore(MUSIC_STORE).delete(id);

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    }

    async function renderMusic() {
        const shell = document.createElement("div");

        shell.className = "music-app";

        shell.style.cssText =
            "height:100%;display:flex;flex-direction:column;background:#fff;color:#26343e;";

        shell.append(
            createServiceHeader("Gantile Music", "#ff7b00")
        );

        const body = document.createElement("div");

        body.style.cssText =
            "padding:20px;overflow:auto;flex:1;";

        const heading = document.createElement("h2");

        heading.textContent = "My music";
        heading.style.fontWeight = "300";

        const description = document.createElement("p");

        description.textContent =
            "Play music stored on your device.";

        description.style.color = "#687985";

        const picker = document.createElement("input");

        picker.type = "file";
        picker.accept = "audio/*";
        picker.multiple = true;

        picker.style.cssText =
            "display:block;margin:20px 0;max-width:100%;";

        const importButton = makeButton(
            "Add music",
            () => picker.click()
        );

        importButton.style.cssText =
            "background:#ff7b00;color:white;border:0;padding:12px 20px;cursor:pointer;";

        const list = document.createElement("div");

        list.style.marginTop = "25px";

        const audio = document.createElement("audio");

        audio.controls = true;

        audio.style.cssText =
            "width:100%;margin-top:20px;";

        let currentObjectURL = null;

        picker.addEventListener("change", async () => {
            if (!picker.files.length) return;

            try {
                await saveMusicFiles(picker.files);

                showToast("Music added");

                picker.value = "";

                renderTrackList();

            } catch (error) {
                console.error(error);
                showToast("Could not save music");
            }
        });

        async function renderTrackList() {
            list.replaceChildren();

            try {
                const tracks = await getMusicFiles();

                if (!tracks.length) {
                    const empty = document.createElement("p");

                    empty.textContent =
                        "Your music library is empty.";

                    empty.style.color = "#8999a2";

                    list.append(empty);
                    return;
                }

                tracks.forEach(track => {
                    const row = document.createElement("div");

                    row.style.cssText =
                        "display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #e4e8eb;";

                    const title = document.createElement("div");

                    title.textContent = track.name;

                    title.style.cssText =
                        "flex:1;min-width:0;overflow-wrap:anywhere;";

                    const play = makeButton("Play", () => {
                        if (currentObjectURL) {
                            URL.revokeObjectURL(currentObjectURL);
                        }

                        currentObjectURL =
                            URL.createObjectURL(track.blob);

                        audio.src = currentObjectURL;

                        audio.play().catch(() => {
                            showToast("Unable to play this file");
                        });
                    });

                    const remove = makeButton(
                        "Delete",
                        async () => {
                            await deleteMusicFile(track.id);

                            renderTrackList();

                            showToast("Track deleted");
                        }
                    );

                    row.append(title, play, remove);

                    list.append(row);
                });

            } catch (error) {
                const empty = document.createElement("p");

                empty.textContent =
                    "Music storage is unavailable.";

                list.append(empty);
            }
        }

        body.append(
            heading,
            description,
            importButton,
            picker,
            list,
            audio
        );

        shell.append(body);

        appContent.append(shell);

        renderTrackList();
    }

    // --------------------------------------------------
    // SETTINGS HELPERS
    // --------------------------------------------------

    function settingState() {
        return {
            wallpaper:
                localStorage.getItem("blobos_wallpaper") ||
                config.defaultWallpaper ||
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

            button.className =
                key === active ? "active" : "";

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

        row.append(copy, control);

        return row;
    }

    function makeToggle(key, initial, callback) {
        const input = document.createElement("input");

        input.type = "checkbox";
        input.checked = initial;

        input.addEventListener("change", () => {
            localStorage.setItem(
                key,
                String(input.checked)
            );

            if (callback) {
                callback(input.checked);
            }
        });

        return input;
    }

    // --------------------------------------------------
    // SETTINGS
    // --------------------------------------------------

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
                localStorage.setItem(
                    "blobos_clock24",
                    clock.value
                );

                updateClock();
            });

            content.append(
                settingRow(
                    "Time format",
                    "Choose how the clock is displayed",
                    clock
                )
            );
        }

        else if (section === "wallpaper") {
            const title = document.createElement("h3");

            title.textContent = "Static wallpapers";

            content.append(title);

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
                    localStorage.setItem(
                        "blobos_wallpaper",
                        path
                    );

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

            const liveWallpapers =
                window.blobosGetLiveWallpapers
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

                    name.textContent =
                        wallpaper.name || wallpaper.id;

                    const description = document.createElement("small");

                    description.textContent =
                        "Live wallpaper · " + wallpaper.type;

                    const info = document.createElement("div");

                    info.append(name, description);
                    button.append(info);

                    button.addEventListener("click", () => {
                        if (window.blobosSetLiveWallpaper) {
                            window.blobosSetLiveWallpaper(
                                wallpaper.id
                            );

                            showToast("Live wallpaper applied");
                        }
                    });

                    content.append(button);
                });
            } else {
                const empty = document.createElement("div");

                empty.className = "settings-about";
                empty.textContent = "No live wallpapers found.";

                content.append(empty);
            }

            content.append(
                makeButton("Use static wallpaper", () => {
                    if (window.blobosClearLiveWallpaper) {
                        window.blobosClearLiveWallpaper();
                    }

                    showToast("Static wallpaper enabled");
                })
            );
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

            const carrier = document.createElement("div");

            carrier.className = "settings-about";

            carrier.textContent =
                "Data carrier: " +
                (config.dataCarrier || "Unknown");

            content.append(carrier);
        }

        else if (section === "repositories") {
            const title = document.createElement("h3");

            title.textContent = "App repositories";

            content.append(title);

            const description = document.createElement("div");

            description.className = "settings-about";

            description.textContent =
                "Add repositories containing apps.json files. Apps from these repositories will appear in the app drawer. Only add repositories you trust.";

            content.append(description);

            const input = document.createElement("input");

            input.type = "url";
            input.placeholder = "https://example.com/apps.json";

            input.style.cssText =
                "width:100%;padding:12px;margin:16px 0;background:#17232d;color:#fff;border:1px solid #405566;";

            const addButton = makeButton(
                "Add repository",
                async () => {
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
                }
            );

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

                const remove = makeButton(
                    "Remove",
                    async () => {
                        const updated = getRepositories();

                        updated.splice(index, 1);

                        localStorage.setItem(
                            "blobos_repositories",
                            JSON.stringify(updated)
                        );

                        await refreshAppRepositories();

                        showToast("Repository removed");

                        renderSettings("repositories");
                    }
                );

                row.append(label, remove);

                content.append(row);
            });

            content.append(
                makeButton(
                    "Refresh repositories",
                    async () => {
                        await refreshAppRepositories();

                        showToast("Repositories refreshed");

                        renderSettings("repositories");
                    }
                )
            );
        }

        else if (section === "system") {
            const title = document.createElement("h3");

            title.textContent =
                "About " + (config.OEM || "BlobOS");

            content.append(title);

            const about = document.createElement("div");

            about.className = "settings-about";

            about.textContent =
                (config.OEM || "BlobOS") +
                " · HTML5 desktop environment · Open Source on github.com/halohash/BlobOS";

            content.append(about);

            const management = document.createElement("div");

            management.className = "settings-about";

            management.textContent =
                "Management domain: " +
                (config.managementDomain || "Not configured");

            content.append(management);

            const launcherTitle = document.createElement("h3");

            launcherTitle.textContent = "Launcher";
            launcherTitle.style.marginTop = "28px";

            content.append(launcherTitle);

            if (window.BlobOSLauncher) {
                const launcherSelect = document.createElement("select");

                BlobOSLauncher.getLaunchers().forEach(launcher => {
                    const option = document.createElement("option");

                    option.value = launcher.id;
                    option.textContent = launcher.name;

                    launcherSelect.append(option);
                });

                launcherSelect.value =
                    BlobOSLauncher.getActiveLauncherId() || "egohome";

                launcherSelect.addEventListener("change", async () => {
                    const success = await BlobOSLauncher.activate(
                        launcherSelect.value
                    );

                    if (success) {
                        showToast("Launcher changed");
                    } else {
                        showToast("Could not change launcher");
                    }
                });

                content.append(
                    settingRow(
                        "Default launcher",
                        "Choose your home screen",
                        launcherSelect
                    )
                );
            }

            const saverTitle = document.createElement("h3");

            saverTitle.textContent = "Screensavers";
            saverTitle.style.marginTop = "28px";

            content.append(saverTitle);

            const screensavers =
                window.blobosGetScreensavers
                    ? window.blobosGetScreensavers()
                    : [];

            const selectedSaver =
                localStorage.getItem("blobos_screensaver_id") || "";

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

                    description.textContent =
                        "Screensaver · " + saver.type;

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
                empty.textContent = "No screensavers found.";

                content.append(empty);
            }

            content.append(
                makeButton(
                    "Preview selected screensaver",
                    () => {
                        if (window.blobosStartDaydream) {
                            window.blobosStartDaydream();
                        } else {
                            showToast("Screensavers are not ready yet");
                        }
                    }
                )
            );

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

            timeoutSelect.value =
                localStorage.getItem("blobos_screensaver_delay") ||
                "120000";

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

            content.append(
                settingRow(
                    "Automatic screensavers",
                    "Start a screensaver when BlobOS is idle.",
                    makeToggle(
                        "blobos_screensaver_enabled",
                        localStorage.getItem(
                            "blobos_screensaver_enabled"
                        ) !== "false",
                        enabled => {
                            if (window.blobosSetScreensaverEnabled) {
                                window.blobosSetScreensaverEnabled(
                                    enabled
                                );
                            }
                        }
                    )
                )
            );

            content.append(
                makeButton("Factory Reset", () => {
                    if (window.factoryReset) {
                        window.factoryReset();
                    } else {
                        window.errorMessage();
                    }
                })
            );
        }

        main.append(content);
        shell.append(main);

        appContent.replaceChildren(shell);
    }

    // --------------------------------------------------
    // WALLPAPER
    // --------------------------------------------------

    function applyWallpaper(path) {
        if (!path || !desktop) return;

        desktop.style.backgroundImage =
            'url("' + path.replace(/["\\]/g, "") + '")';
    }

    function renderGallery() {
        const wrap = document.createElement("div");

        wrap.style.cssText =
            "padding:22px;color:#26343e";

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
                localStorage.setItem(
                    "blobos_wallpaper",
                    path
                );

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

    // --------------------------------------------------
    // CLOCK
    // --------------------------------------------------

    function updateClock() {
        const now = new Date();

        const use24 =
            localStorage.getItem("blobos_clock24") === "true";

        const time = now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: !use24
        });

        if ($("clock")) {
            $("clock").textContent = time;
        }

        if ($("welcomeTime")) {
            $("welcomeTime").textContent = time;
        }

        if ($("date")) {
            $("date").textContent = now.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric"
            });
        }

        if ($("welcomeDate")) {
            $("welcomeDate").textContent = now.toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric"
            });
        }

        if ($("shadeDate")) {
            $("shadeDate").textContent = now.toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric"
            });
        }
    }

    // --------------------------------------------------
    // EVENT LISTENERS
    // --------------------------------------------------

    if ($("trayButton")) {
        $("trayButton").addEventListener("click", openTray);
    }

    document.querySelectorAll("[data-close-tray]").forEach(el => {
        el.addEventListener("click", closeTray);
    });

    if ($("appSearch")) {
        $("appSearch").addEventListener("input", event => {
            renderApps(event.target.value);
        });
    }

    if ($("appBack")) {
        $("appBack").addEventListener("click", home);
    }

    if ($("backButton")) {
        $("backButton").addEventListener("click", () => {
            if (config.kiosk) return;

            if (tray.classList.contains("open")) {
                closeTray();
            } else if (appWindow.classList.contains("open")) {
                home();
            } else if (recentPanel) {
                recentPanel.classList.remove("open");
            }
        });
    }

    if ($("homeButton")) {
        $("homeButton").addEventListener("click", home);
    }

    if ($("recentButton")) {
        $("recentButton").addEventListener("click", () => {
            if (config.kiosk) return;

            closeTray();

            recentPanel.classList.toggle("open");

            renderRecent();
        });
    }

    if ($("appMenu")) {
        $("appMenu").addEventListener("click", () => {
            showToast(
                currentApp
                    ? "App: " + (
                        apps[currentApp].name || currentApp
                    )
                    : config.OEM || "BlobOS"
            );
        });
    }

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" ||
            (
                event.key === "Backspace" &&
                event.target.tagName !== "INPUT" &&
                event.target.tagName !== "TEXTAREA"
            )
        ) {
            if (config.kiosk) return;

            if (appWindow.classList.contains("open")) {
                home();
            } else {
                closeTray();
            }
        }
    });

    // --------------------------------------------------
    // STARTUP
    // --------------------------------------------------

    async function start() {
        await loadConfig();

        const loaded = await loadJSON("./apps.json", {});

        apps = Object.assign({}, loaded);

        await loadRepositoryApps();

        apps = Object.assign({}, apps, builtins);

        wallpapers = await loadJSON(
            "./wallpapers.json",
            ["1.png", "2.png", "3.png"]
        );

        if (!Array.isArray(wallpapers)) {
            wallpapers = ["1.png", "2.png", "3.png"];
        }

        renderApps();
        renderShortcuts();
        renderRecent();

        loadServices();

        const defaultWallpaper =
            localStorage.getItem("blobos_wallpaper") ||
            config.defaultWallpaper ||
            wallpapers[0];

        if (
            !localStorage.getItem("blobos_wallpaper") &&
            config.defaultWallpaper
        ) {
            localStorage.setItem(
                "blobos_wallpaper",
                config.defaultWallpaper
            );
        }

        applyWallpaper(defaultWallpaper);

        document.documentElement.classList.toggle(
            "no-animations",
            localStorage.getItem("blobos_animations") === "false"
        );

        updateClock();

        setInterval(updateClock, 15000);

        // Start the launcher engine.

        if (config.disableEGOHome) {
            homeScreen.classList.add("home-hidden");
            homeScreen.hidden = true;

            if (!config.kiosk) {
                openTray();
            }
        } else if (window.BlobOSLauncher) {
            const launcherId = safeText(
                config.defaultLauncher || "EGOHome"
            ).toLowerCase();

            const success = await BlobOSLauncher.start({
                defaultLauncher: launcherId
            });

            if (!success) {
                console.error(
                    "BlobOS: Could not start the default launcher."
                );

                homeScreen.classList.remove("home-hidden");
                homeScreen.hidden = false;
            }
        } else {
            homeScreen.hidden = false;
            renderEGOHome();
        }

        if (config.kiosk && config.kioskApp) {
            launchApp(config.kioskApp);
        }

        setTimeout(() => {
            if ($("boot")) {
                $("boot").classList.add("done");
            }
        }, 2450);

        setTimeout(() => {
            if ($("boot")) {
                $("boot").remove();
            }
        }, 3000);

        console.log(
            "BlobOS: " +
            (config.OEM || "BlobOS") +
            " started"
        );
    }

    start().catch(error => {
        console.error("BlobOS startup failed:", error);
        showToast("BlobOS could not start correctly");
    });

})();
