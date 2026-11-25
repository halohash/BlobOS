
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const shade = $("notificationShade");
  const lock = $("lockScreen");
  const daydream = $("daydream");
  const wallpaper = $("liveWallpaper");

  if (!shade || !lock || !daydream || !wallpaper) {
    console.error("BlobOS system: Required HTML elements are missing.");
    return;
  }

  let notifications = [];
  let wallpaperConfig = [];
  let screensaverConfig = [];
  let currentWallpaper = null;

  let idleTimer = null;
  let wallpaperFrame = null;
  let bubbleFrame = null;
  let daydreamTimer = null;

  let locked = false;
  let screensaverActive = false;
  let pin = localStorage.getItem("blobos_pin") || "";

  let touchStartY = 0;
  let mouseStartY = 0;

  const DEFAULT_SCREENSAVER_DELAY = 120000;

  const defaults = [
    { id: "bubbles", name: "Bubbles", type: "bubbles" }
  ];

  const defaultScreensavers = [
    { id: "clock", name: "Digital Clock", type: "clock" },
    { id: "bubbles", name: "Bubbles", type: "bubbles" }
  ];

  function showToast(message) {
    if (typeof window.toast === "function") {
      window.toast(message);
    }
  }

  function setting(key, fallback) {
    const value = localStorage.getItem("blobos_" + key);
    return value === null ? fallback : value;
  }
function setHomeScreen(enabled) {
    enabled = enabled === true || enabled === "true";

    localStorage.setItem("homeEnabled", String(enabled));

    const homeScreen = $("homeScreen");

    if (homeScreen) {
        homeScreen.classList.toggle("home-hidden", !enabled);
    }

    document.documentElement.classList.toggle(
        "home-disabled",
        !enabled
    );

    return enabled;
}

window.blobosSetHomeScreen = setHomeScreen;

window.blobosIsHomeScreenEnabled = () => {
    return localStorage.getItem("homeEnabled") !== "false";
};
  function animationsEnabled() {
    return setting("animations", "true") !== "false";
  }

  function applyAnimationState() {
    document.documentElement.classList.toggle(
      "no-animations",
      !animationsEnabled()
    );
  }

  async function loadJSON(path, fallback) {
    try {
      const response = await fetch(path, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load " + path);
      }

      return await response.json();
    } catch (error) {
      console.warn(error);
      return fallback;
    }
  }

  /* CLOCK */

  function updateSystemClock() {
    const now = new Date();
    const use24 = setting("clock24", "false") === "true";

    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24
    });

    if ($("lockTime")) {
      $("lockTime").textContent = time;
    }

    if ($("lockDate")) {
      $("lockDate").textContent = now.toLocaleDateString([], {
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

  /* NOTIFICATIONS */

  function renderNotifications() {
    const list = $("notificationList");
    const lockList = $("lockNotifications");

    if (list) list.replaceChildren();
    if (lockList) lockList.replaceChildren();

    if (!notifications.length) {
      if (list) {
        const empty = document.createElement("div");
        empty.className = "notification-empty";
        empty.textContent = "No notifications";
        list.append(empty);
      }

      return;
    }

    notifications.forEach(notification => {
      if (list) {
        const card = document.createElement("div");
        card.className = "notification-card";

        const icon = document.createElement("span");
        icon.className = "material-icons notification-icon";
        icon.textContent = notification.icon;

        const body = document.createElement("div");
        body.className = "notification-body";

        const title = document.createElement("strong");
        title.textContent = notification.title;

        const message = document.createElement("div");
        message.textContent = notification.message;

        const time = document.createElement("small");
        time.textContent = notification.time;

        body.append(title, message, time);

        const dismiss = document.createElement("button");
        dismiss.className = "notification-dismiss";
        dismiss.innerHTML =
          '<span class="material-icons">close</span>';
        dismiss.setAttribute("aria-label", "Dismiss notification");

        dismiss.addEventListener("click", event => {
          event.stopPropagation();
          dismissNotification(notification.id);
        });

        card.append(icon, body, dismiss);

        if (notification.action) {
          card.addEventListener("click", () => {
            notification.action();
            closeShade();
          });
        }

        list.append(card);
      }

      if (lockList) {
        const lockCard = document.createElement("div");
        lockCard.className = "lock-notification";

        lockCard.textContent =
          notification.title +
          (notification.message ? ": " + notification.message : "");

        lockList.append(lockCard);
      }
    });
  }

  function notify(title, message, options = {}) {
    const notification = {
      id: Date.now() + Math.random(),
      title: String(title || "Notification"),
      message: String(message || ""),
      icon: options.icon || "notifications",
      time: options.time || "Now",
      action: typeof options.action === "function"
        ? options.action
        : null
    };

    notifications.unshift(notification);
    notifications = notifications.slice(0, 30);

    renderNotifications();

    return notification.id;
  }

  function dismissNotification(id) {
    notifications = notifications.filter(item => item.id !== id);
    renderNotifications();
  }

  function clearNotifications() {
    notifications = [];
    renderNotifications();
  }

  window.blobosNotify = notify;
  window.blobosClearNotifications = clearNotifications;

  window.blobosGetNotifications = () => notifications.slice();

  /* NOTIFICATION SHADE */

  function openShade() {
    if (locked || screensaverActive) return;

    closeRecentPanel();

    shade.classList.add("open");
    shade.setAttribute("aria-hidden", "false");

    updateSystemClock();
  }

  function closeShade() {
    shade.classList.remove("open");
    shade.setAttribute("aria-hidden", "true");
  }

  function toggleShade() {
    if (shade.classList.contains("open")) {
      closeShade();
    } else {
      openShade();
    }
  }

  function closeRecentPanel() {
    const panel = $("recentPanel");
    if (panel) panel.classList.remove("open");
  }

  if ($("shadeClose")) {
    $("shadeClose").addEventListener("click", closeShade);
  }

  if ($("clearNotifications")) {
    $("clearNotifications").addEventListener("click", clearNotifications);
  }

  if ($("shadeSettings")) {
    $("shadeSettings").addEventListener("click", () => {
      closeShade();

      const trayButton = $("trayButton");
      if (trayButton) trayButton.click();
    });
  }

  if ($("shadeLock")) {
    $("shadeLock").addEventListener("click", lockScreen);
  }

  /* QUICK SETTINGS */

  const quickSettings = {
    wifi: true,
    airplane: false,
    sound: true,
    rotation: true,
    homeScreen: true,
  };

  document.querySelectorAll(".quick-tile").forEach(button => {
    const key = button.dataset.setting;

    if (!(key in quickSettings)) return;

const stored = key === "homeScreen"
    ? (localStorage.getItem("homeEnabled") !== "false" ? "true" : "false")
    : setting("quick_" + key, String(quickSettings[key]));

button.classList.toggle("active", stored === "true");

    button.addEventListener("click", () => {
      const active = !button.classList.contains("active");

      button.classList.toggle("active", active);

      localStorage.setItem(
        "blobos_quick_" + key,
        String(active)
      );

      if (key === "homeScreen") {
          setHomeScreen(active);
      }

      if (key === "wifi") {
        localStorage.setItem("blobos_wifi", String(active));

        if (active) {
          localStorage.setItem("blobos_airplane", "false");

          const airplane = document.querySelector(
            '[data-setting="airplane"]'
          );

          if (airplane) {
            airplane.classList.remove("active");
          }

          localStorage.setItem("blobos_quick_airplane", "false");
        }
      }

      if (key === "airplane") {
        localStorage.setItem("blobos_airplane", String(active));

        if (active) {
          localStorage.setItem("blobos_wifi", "false");
          localStorage.setItem("blobos_quick_wifi", "false");

          const wifi = document.querySelector(
            '[data-setting="wifi"]'
          );

          if (wifi) wifi.classList.remove("active");
        }
      }

      showToast(
        button.querySelector("span:last-child").textContent +
        (active ? " enabled" : " disabled")
      );
    });
  });

  /* BRIGHTNESS */

  if ($("brightnessSlider")) {
    const brightness = Number(setting("brightness", "100"));

    $("brightnessSlider").value = brightness;

    document.documentElement.style.setProperty(
      "--blobos-brightness",
      String(brightness / 100)
    );

    $("brightnessSlider").addEventListener("input", event => {
      const value = Number(event.target.value);

      document.documentElement.style.setProperty(
        "--blobos-brightness",
        String(value / 100)
      );

      localStorage.setItem("blobos_brightness", String(value));
    });
  }

  /* LOCK SCREEN */

  function lockScreen() {
    if (locked) return;

    closeShade();

    if (screensaverActive) {
      exitDaydream();
    }

    locked = true;

    lock.classList.add("visible");
    lock.setAttribute("aria-hidden", "false");

    if ($("pinPanel")) {
      $("pinPanel").classList.toggle("visible", Boolean(pin));
    }

    if ($("pinInput")) {
      $("pinInput").value = "";
    }

    if ($("pinError")) {
      $("pinError").textContent = "";
    }

    document.body.classList.add("system-locked");

    updateSystemClock();
  }

  function unlockScreen() {
    if (!locked) return;

    if (pin) {
      const entered = $("pinInput").value;

      if (entered !== pin) {
        $("pinError").textContent = "Incorrect PIN";
        $("pinInput").value = "";
        return;
      }
    }

    locked = false;

    lock.classList.remove("visible");
    lock.setAttribute("aria-hidden", "true");

    document.body.classList.remove("system-locked");

    if ($("pinError")) {
      $("pinError").textContent = "";
    }

    resetIdleTimer();
  }

  if ($("pinUnlock")) {
    $("pinUnlock").addEventListener("click", unlockScreen);
  }

  if ($("pinInput")) {
    $("pinInput").addEventListener("keydown", event => {
      if (event.key === "Enter") unlockScreen();
    });
  }

  let lockTouchY = 0;

  lock.addEventListener("touchstart", event => {
    lockTouchY = event.touches[0].clientY;
  }, { passive: true });

  lock.addEventListener("touchend", event => {
    const difference =
      event.changedTouches[0].clientY - lockTouchY;

    if (difference < -65 && !pin) {
      unlockScreen();
    }
  }, { passive: true });

  lock.addEventListener("mousedown", event => {
    lockTouchY = event.clientY;
  });

  lock.addEventListener("mouseup", event => {
    const difference = event.clientY - lockTouchY;

    if (difference < -65 && !pin) {
      unlockScreen();
    }
  });

  window.blobosLock = lockScreen;
  window.blobosUnlock = unlockScreen;

  window.blobosSetPin = value => {
    const next = String(value || "");

    if (next && !/^\d{4,12}$/.test(next)) {
      showToast("PIN must be 4–12 digits");
      return false;
    }

    pin = next;

    if (pin) {
      localStorage.setItem("blobos_pin", pin);
    } else {
      localStorage.removeItem("blobos_pin");
    }

    showToast(pin ? "Lock PIN updated" : "Lock PIN disabled");

    return true;
  };

  window.blobosSetLockWallpaper = url => {
    const safeURL = String(url).replace(/["\\]/g, "");

    const element = document.querySelector(".lock-wallpaper");

    if (element) {
      element.style.backgroundImage =
        'linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.55)),url("' +
        safeURL + '")';
    }
  };

  /* LIVE WALLPAPERS */

  function stopWallpaper() {
    if (wallpaperFrame) {
      cancelAnimationFrame(wallpaperFrame);
      wallpaperFrame = null;
    }

    wallpaper.replaceChildren();
    wallpaper.classList.remove("active");
  }

  function startLiveWallpaper(config) {
    stopWallpaper();

    if (!config) return;

    currentWallpaper = config;

    wallpaper.classList.add("active");

    const type = config.type || "image";

    if (type === "image") {
      const img = document.createElement("img");

      img.src = config.src;
      img.alt = "";

      wallpaper.append(img);
    }

    if (type === "video") {
      const video = document.createElement("video");

      video.src = config.src;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;

      wallpaper.append(video);

      video.play().catch(() => {});
    }

    if (type === "html") {
      const frame = document.createElement("iframe");

      frame.src = config.src;
      frame.title = config.name || "Live wallpaper";

      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin"
      );

      wallpaper.append(frame);
    }

    if (type === "bubbles") {
      createLiveBubbles();
    }
  }

  function createLiveBubbles() {
    const canvas = document.createElement("canvas");
    canvas.className = "wallpaper-canvas";

    wallpaper.append(canvas);

    const ctx = canvas.getContext("2d");
    const bubbles = [];

    function resize() {
      canvas.width = wallpaper.clientWidth;
      canvas.height = wallpaper.clientHeight;
    }

    resize();

    for (let i = 0; i < 32; i++) {
      bubbles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 5 + Math.random() * 25,
        speed: .3 + Math.random() * 1.1,
        alpha: .1 + Math.random() * .3
      });
    }

    function draw() {
      if (!wallpaper.classList.contains("active")) {
        wallpaperFrame = null;
        return;
      }

      wallpaperFrame = requestAnimationFrame(draw);

      if (document.hidden || locked || screensaverActive) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubbles.forEach(bubble => {
        bubble.y -= bubble.speed;

        if (bubble.y < -bubble.radius) {
          bubble.y = canvas.height + bubble.radius;
          bubble.x = Math.random() * canvas.width;
        }

        ctx.beginPath();
        ctx.arc(
          bubble.x,
          bubble.y,
          bubble.radius,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          "rgba(60,180,230," + bubble.alpha + ")";

        ctx.fill();

        ctx.strokeStyle = "rgba(180,230,255,.25)";
        ctx.stroke();
      });
    }

    draw();
  }

  async function selectLiveWallpaper(id) {
    const item = wallpaperConfig.find(w => w.id === id);

    if (!item) {
      showToast("Wallpaper not found");
      return false;
    }

    localStorage.setItem("blobos_live_wallpaper", id);

    startLiveWallpaper(item);

    showToast("Live wallpaper applied");

    return true;
  }

  window.blobosSetLiveWallpaper = selectLiveWallpaper;

  window.blobosGetLiveWallpapers = () => wallpaperConfig.slice();

  window.blobosClearLiveWallpaper = () => {
    localStorage.removeItem("blobos_live_wallpaper");
    stopWallpaper();
  };

  /* DAYDREAM SCREENSAVERS */

  function stopDaydreamAnimation() {
    if (bubbleFrame) {
      cancelAnimationFrame(bubbleFrame);
      bubbleFrame = null;
    }

    clearInterval(daydreamTimer);
    daydreamTimer = null;

    const video = daydream.querySelector("video");

    if (video) video.pause();
  }

  function exitDaydream() {
    if (!screensaverActive) return;

    screensaverActive = false;

    stopDaydreamAnimation();

    daydream.classList.remove("active");
    daydream.setAttribute("aria-hidden", "true");

    resetIdleTimer();
  }

  
function startDaydream(id) {
    if (
        locked ||
        setting("screensaver_enabled", "true") === "false"
    ) {
        return;
    }

    // Save a newly selected screensaver.
    if (id) {
        const selected = screensaverConfig.find(
            item => item.id === id
        );

        if (!selected) {
            showToast("Screensaver not found");
            return;
        }

        localStorage.setItem("blobos_screensaver_id", id);
    }

    // Use the saved screensaver, not automatically the first one.
    const savedId = setting("screensaver_id", "");
    const config =
        screensaverConfig.find(item => item.id === savedId) ||
        screensaverConfig[0];

    if (!config) return;

    closeShade();
    screensaverActive = true;

    stopDaydreamAnimation();

    const content = $("daydreamContent");
    content.replaceChildren();

    daydream.classList.add("active");
    daydream.setAttribute("aria-hidden", "false");

    if (config.type === "clock") {
        const clock = document.createElement("div");
        clock.className = "daydream-clock";
        content.append(clock);

        function update() {
            clock.textContent = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: setting("clock24", "false") !== "true"
            });
        }

        update();
        daydreamTimer = setInterval(update, 1000);
    }

    if (config.type === "bubbles") {
        createDaydreamBubbles(content);
    }

    if (config.type === "slideshow") {
        const image = document.createElement("img");
        image.className = "daydream-photo";
        content.append(image);

        const images = Array.isArray(config.images)
            ? config.images
            : [];

        let index = 0;

        if (images.length) {
            function show() {
                image.src = images[index % images.length];
                index++;
            }

            show();
            daydreamTimer = setInterval(
                show,
                Math.max(2000, Number(config.interval) || 8000)
            );
        }
    }

    if (config.type === "html") {
        const frame = document.createElement("iframe");
        frame.src = config.src;
        frame.title = config.name || "Daydream";
        frame.setAttribute(
            "sandbox",
            "allow-scripts allow-same-origin"
        );
        content.append(frame);
    }

    if (config.type === "video") {
        const video = document.createElement("video");
        video.src = config.src;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        content.append(video);
        video.play().catch(() => {});
    }
}


  function createDaydreamBubbles(content) {
    const canvas = document.createElement("canvas");
    canvas.className = "daydream-canvas";

    content.append(canvas);

    const ctx = canvas.getContext("2d");
    const bubbles = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();

    for (let i = 0; i < 40; i++) {
      bubbles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 5 + Math.random() * 30,
        speed: .3 + Math.random() * 1.4
      });
    }

    function draw() {
      if (!screensaverActive) {
        bubbleFrame = null;
        return;
      }

      bubbleFrame = requestAnimationFrame(draw);

      if (document.hidden) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubbles.forEach(bubble => {
        bubble.y -= bubble.speed;

        if (bubble.y < -bubble.radius) {
          bubble.y = canvas.height + bubble.radius;
          bubble.x = Math.random() * canvas.width;
        }

        ctx.beginPath();
        ctx.arc(
          bubble.x,
          bubble.y,
          bubble.radius,
          0,
          Math.PI * 2
        );

        ctx.fillStyle = "rgba(50,170,230,.25)";
        ctx.fill();

        ctx.strokeStyle = "rgba(180,230,255,.3)";
        ctx.stroke();
      });
    }

    draw();
  }

  daydream.addEventListener("pointerdown", exitDaydream);

  window.blobosStartDaydream = startDaydream;
  window.blobosExitDaydream = exitDaydream;

  window.blobosGetScreensavers = () => screensaverConfig.slice();

  /* IDLE DETECTION */

  
function resetIdleTimer() {
    clearTimeout(idleTimer);

    if (
        locked ||
        screensaverActive ||
        setting("screensaver_enabled", "true") === "false"
    ) {
        return;
    }

    const delay = Number(
        setting(
            "screensaver_delay",
            String(DEFAULT_SCREENSAVER_DELAY)
        )
    );

    // Zero means Never.
    if (!Number.isFinite(delay) || delay <= 0) {
        return;
    }

    idleTimer = setTimeout(() => {
        startDaydream();
    }, Math.max(15000, delay));
}


  function handleActivity() {
    if (screensaverActive) {
      exitDaydream();
      return;
    }

    resetIdleTimer();
  }

  [
    "pointerdown",
    "pointermove",
    "keydown",
    "touchstart",
    "wheel"
  ].forEach(type => {
    document.addEventListener(type, handleActivity, {
      passive: true
    });
  });

  
window.blobosSetScreensaverDelay = milliseconds => {
    const value = Number(milliseconds);

    if (!Number.isFinite(value) || value < 0) {
        return false;
    }

    localStorage.setItem(
        "blobos_screensaver_delay",
        String(value)
    );

    resetIdleTimer();
    return true;
};

window.blobosSetScreensaverEnabled = enabled => {
    localStorage.setItem(
        "blobos_screensaver_enabled",
        String(Boolean(enabled))
    );

    if (!enabled && screensaverActive) {
        exitDaydream();
    }

    resetIdleTimer();
};


  /* SWIPE GESTURES */

  document.addEventListener("touchstart", event => {
    if (!event.touches.length) return;

    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchend", event => {
    if (!event.changedTouches.length) return;

    const endY = event.changedTouches[0].clientY;
    const deltaY = endY - touchStartY;

    if (touchStartY < 45 && deltaY > 60) {
      openShade();
    }

    if (shade.classList.contains("open") && deltaY < -60) {
      closeShade();
    }
  }, { passive: true });

  document.addEventListener("mousedown", event => {
    mouseStartY = event.clientY;
  });

  document.addEventListener("mouseup", event => {
    const deltaY = event.clientY - mouseStartY;

    if (mouseStartY < 45 && deltaY > 60) {
      openShade();
    }

    if (shade.classList.contains("open") && deltaY < -60) {
      closeShade();
    }
  });

  /* KEYBOARD */

  document.addEventListener("keydown", event => {
    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "l"
    ) {
      event.preventDefault();
      lockScreen();
    }

    if (event.key === "Escape") {
      if (screensaverActive) {
        exitDaydream();
      } else if (shade.classList.contains("open")) {
        closeShade();
      }
    }
  });

  /* VISIBILITY */

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (wallpaperFrame) {
        cancelAnimationFrame(wallpaperFrame);
        wallpaperFrame = null;
      }
    } else {
      if (currentWallpaper && !locked && !screensaverActive) {
        const item = currentWallpaper;
        startLiveWallpaper(item);
      }

      resetIdleTimer();
    }
  });

  /* RESIZE */

  window.addEventListener("resize", () => {
    const canvas = wallpaper.querySelector("canvas");

    if (canvas) {
      canvas.width = wallpaper.clientWidth;
      canvas.height = wallpaper.clientHeight;
    }
  });

  /* STARTUP */

  async function startSystem() {
    wallpaperConfig = await loadJSON(
      "./livewallpapers.json",
      defaults
    );

    screensaverConfig = await loadJSON(
      "./screensavers.json",
      defaultScreensavers
    );

    if (!Array.isArray(wallpaperConfig)) {
      wallpaperConfig = defaults;
    }

    if (!Array.isArray(screensaverConfig)) {
      screensaverConfig = defaultScreensavers;
    }

    const selected = setting("live_wallpaper", "");

    if (selected) {
      const item = wallpaperConfig.find(
        wallpaper => wallpaper.id === selected
      );

      if (item) {
        startLiveWallpaper(item);
      }
    }

    const savedBrightness = Number(
      setting("brightness", "100")
    );

    document.documentElement.style.setProperty(
      "--blobos-brightness",
      String(Math.max(30, Math.min(100, savedBrightness)) / 100)
    );
setHomeScreen(
    localStorage.getItem("homeEnabled") !== "false"
);
    applyAnimationState();

    updateSystemClock();
    setInterval(updateSystemClock, 1000);

    renderNotifications();

    if (setting("locked", "false") === "true") {
      lockScreen();
    }

    resetIdleTimer();

    window.blobosWallpaperList = wallpaperConfig;
    window.blobosScreensaverList = screensaverConfig;

    window.blobosSystemReady = true;

    console.log("BlobOS system initialized.");
  }



async function firstRun() {
  const dialog = await holoDialog({
    title: 'System',
    message: `Welcome to your new device! App Tray is on the top right.`,
    positiveText: 'OK'
  });

  if (dialog === 'positive') {
      localStorage.setItem("firstRun","false")
  }
}
async function factoryReset() {
  const choice = await holoDialog({
    title: 'Factory Reset?',
    message: 'Are you sure? This can\'t be reversed.',
    negativeText: 'No',
    positiveText: 'Yes'
  });

  if (choice === 'positive') {
holoDialog({
  title: 'Please Wait...',
  message: 'Shutting Down',
  positiveText: 'OK'
});
      localStorage.clear()
      window.location.reload()
      
  }
}

window.factoryReset = factoryReset;
  startSystem();
if (localStorage.getItem("firstRun") !== "false") {firstRun()}
})();
