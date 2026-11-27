
(async () => {
  window.strings = {};

  try {
    const res = await fetch("/strings.json");

    if (!res.ok) {
      throw new Error("Failed to load strings.json: " + res.status);
    }

    window.strings = await res.json();

    
    window.getString = function (key, ...args) {
      let value = window.strings[key];

      if (value === undefined) {
        return "@string/" + key;
      }

      if (Array.isArray(value)) {
        return value;
      }

      return String(value).replace(
        /%(\d+)\$s/g,
        (match, index) => {
          const arg = Number(index) - 1;

          return arg < args.length
            ? String(args[arg])
            : match;
        }
      );
    };

    
    function translateNode(node) {
      if (!node || node.nodeType !== Node.TEXT_NODE) return;

      const original = node.nodeValue;

      if (!original.includes("@string/")) return;

      const translated = original.replace(
        /@string\/([a-zA-Z0-9_.-]+)(?:\|([^@\n]*))?/g,
        (match, key, rawArgs) => {
          const args = rawArgs !== undefined
            ? rawArgs.split("|")
            : [];

          return window.getString(key, ...args);
        }
      );

      if (translated !== original) {
        node.nodeValue = translated;
      }
    }

    
    function translateTree(root) {
      if (root.nodeType === Node.TEXT_NODE) {
        translateNode(root);
        return;
      }

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT
      );

      let node;

      while ((node = walker.nextNode())) {
        translateNode(node);
      }
    }

    translateTree(document.body);

    
    window.stringObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateNode(mutation.target);
        }

        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.TEXT_NODE) {
            translateNode(addedNode);
          } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
            translateTree(addedNode);
          }
        }
      }
    });

    window.stringObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });

    console.log("BlobOS string system loaded!");

  } catch (error) {
    console.error("BlobOS string system error:", error);
  }
})();
